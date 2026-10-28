'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '@/types';
import { ceoFetch } from '@/lib/ceoApprovalClient';

interface Props {
  items: Item[];
  tenantId: string;
  staffName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  allowNegativeStock?: boolean;
}

interface AdjRow {
  key: string;
  code: string;
  item: Item | null;
  sign: 1 | -1;
  qty: string;
  status: 'idle' | 'error';
  error?: string;
}

const REASONS = [
  'Physical Audit Discrepancy',
  'Damaged / Leaked Cans',
  'Opening Stock Correction',
  'Sample / Tester Consumption',
];

const newRow = (): AdjRow => ({
  key: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  code: '',
  item: null,
  sign: 1,
  qty: '',
  status: 'idle',
});

export default function StockAdjustmentGrid({
  items,
  tenantId,
  staffName,
  onClose,
  onSaved,
  allowNegativeStock = true,
}: Props) {
  const [rows, setRows] = useState<AdjRow[]>([newRow()]);
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [batchRef, setBatchRef] = useState<string>(
    () => `BATCH-${new Date().toISOString().slice(2, 7).replace('-', '')}-A9`
  );
  const [saving, setSaving] = useState<boolean>(false);

  const codeRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const qtyRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pendingFocus = useRef<{ key: string; field: 'code' | 'qty' } | null>(null);

  const itemByCode = useMemo(() => {
    const m = new Map<string, Item>();
    items.forEach((i) => m.set(String(i.code || '').trim().toLowerCase(), i));
    return m;
  }, [items]);

  // Apply queued focus after render
  useEffect(() => {
    const pf = pendingFocus.current;
    if (!pf) return;
    pendingFocus.current = null;
    const el = pf.field === 'code' ? codeRefs.current[pf.key] : qtyRefs.current[pf.key];
    el?.focus();
    el?.select?.();
  });

  const updateRow = (key: string, patch: Partial<AdjRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const resultStock = (r: AdjRow): number | null => {
    if (!r.item) return null;
    const q = Number(r.qty);
    if (!Number.isFinite(q) || q <= 0) return null;
    return Number(r.item.stock_qty || 0) + r.sign * q;
  };

  const resolveCode = (row: AdjRow) => {
    const code = row.code.trim();
    if (!code) return;
    const found = itemByCode.get(code.toLowerCase());
    if (!found) {
      updateRow(row.key, { item: null, status: 'error', error: `Code "${code}" not found` });
      return;
    }
    const dup = rows.some((r) => r.key !== row.key && r.item?.id === found.id);
    if (dup) {
      updateRow(row.key, { item: null, status: 'error', error: `${found.code} already added in another row` });
      return;
    }
    updateRow(row.key, { item: found, code: found.code, status: 'idle', error: undefined });
    pendingFocus.current = { key: row.key, field: 'qty' };
  };

  const commitQty = (row: AdjRow) => {
    const q = Number(row.qty);
    if (!row.item) return;
    if (!Number.isFinite(q) || q <= 0) {
      updateRow(row.key, { status: 'error', error: 'Enter a quantity greater than 0' });
      return;
    }
    const res = Number(row.item.stock_qty || 0) + row.sign * q;
    // Only block if this is a subtraction (sign === -1) AND branch has strict stock mode (!allowNegativeStock)
    // Additions (sign === 1) increase stock / reduce deficit and must never be blocked!
    if (row.sign === -1 && !allowNegativeStock && res < 0) {
      updateRow(row.key, { status: 'error', error: `Stock cannot go below 0 (current ${row.item.stock_qty})` });
      return;
    }
    updateRow(row.key, { status: 'idle', error: undefined });
    const last = rows[rows.length - 1];
    if (last.key === row.key) {
      const nr = newRow();
      pendingFocus.current = { key: nr.key, field: 'code' };
      setRows((prev) => [...prev, nr]);
    } else {
      const idx = rows.findIndex((r) => r.key === row.key);
      pendingFocus.current = { key: rows[idx + 1].key, field: 'code' };
      setRows((prev) => [...prev]);
    }
  };

  const removeRow = (key: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [newRow()];
    });
  };

  const handleApply = async () => {
    if (saving) return;

    // validate rows (ignore completely empty ones)
    const filled = rows.filter((r) => r.code.trim() || r.qty.trim());
    if (filled.length === 0) return;

    let hasInvalid = false;
    const validated = rows.map((r) => {
      if (!r.code.trim() && !r.qty.trim()) return r;
      const q = Number(r.qty);
      if (!r.item) {
        hasInvalid = true;
        return { ...r, status: 'error' as const, error: r.error || 'Select a valid item code (press Enter)' };
      }
      if (!Number.isFinite(q) || q <= 0) {
        hasInvalid = true;
        return { ...r, status: 'error' as const, error: 'Enter a quantity greater than 0' };
      }
      const res = Number(r.item.stock_qty || 0) + r.sign * q;
      if (r.sign === -1 && !allowNegativeStock && res < 0) {
        hasInvalid = true;
        return { ...r, status: 'error' as const, error: `Stock cannot go below 0 (current ${r.item.stock_qty})` };
      }
      return { ...r, status: 'idle' as const, error: undefined };
    });
    setRows(validated);

    const toSend = validated.filter((r) => r.item && r.status === 'idle' && Number(r.qty) > 0);
    if (toSend.length === 0) return;

    setSaving(true);
    try {
      const res = await ceoFetch('/api/items/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          reason,
          batch_ref: batchRef.trim(),
          adjusted_by: staffName || 'Inventory Staff',
          adjustments: toSend.map((r) => ({
            row_id: r.key,
            item_id: r.item!.id,
            delta: r.sign * Number(r.qty),
          })),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setRows((prev) =>
          prev.map((r) =>
            toSend.some((t) => t.key === r.key)
              ? { ...r, status: 'error', error: data.error || 'Failed to save adjustment' }
              : r
          )
        );
        return;
      }

      const okKeys = new Set<string>();
      const errByKey = new Map<string, string>();
      (data.results || []).forEach((x: any) => {
        if (x.success) okKeys.add(x.row_id);
        else errByKey.set(x.row_id, x.error || 'Failed');
      });

      const remaining = validated
        .filter((r) => !okKeys.has(r.key))
        .map((r) => (errByKey.has(r.key) ? { ...r, status: 'error' as const, error: errByKey.get(r.key) } : r));

      if (okKeys.size > 0) {
        onSaved(
          errByKey.size === 0 && !hasInvalid
            ? `Stock adjusted for ${okKeys.size} product(s).`
            : `Stock adjusted for ${okKeys.size} product(s). Some rows need attention.`
        );
      }

      const stillHasWork = remaining.some((r) => r.code.trim() || r.qty.trim());
      if (!stillHasWork) {
        onClose();
      } else {
        setRows(remaining.length ? remaining : [newRow()]);
      }
    } catch (err: any) {
      setRows((prev) =>
        prev.map((r) =>
          toSend.some((t) => t.key === r.key) ? { ...r, status: 'error', error: err.message || 'Network error' } : r
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // Esc closes, Ctrl+Enter applies all
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleApply();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const cell: React.CSSProperties = { padding: '6px 8px', fontSize: '12px', verticalAlign: 'middle' };
  const th: React.CSSProperties = {
    ...cell,
    textAlign: 'left',
    fontSize: '10px',
    textTransform: 'uppercase',
    color: '#64748B',
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 700,
    background: '#F8FAFC',
    position: 'sticky',
    top: 0,
  };

  return (
    <div className="pos-modal-overlay">
      <div className="pos-modal-card" style={{ maxWidth: '980px', width: '96vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <div>
            <h3 style={{ fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', color: '#0F172A' }}>
              Stock Adjustment (+ / -)
            </h3>
            <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#64748B' }}>
              Type item code → Enter → Qty (use + / − button or press + / − key) → Enter for next row • Ctrl+Enter = Apply All • Esc = close
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '12px 1rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
          <div>
            <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Adjustment Reason (whole batch):</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="pos-text-input">
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>Audit Batch Ref / Notes:</label>
            <input
              type="text"
              value={batchRef}
              onChange={(e) => setBatchRef(e.target.value)}
              placeholder="e.g. Audit Notes / Shelf 4 verification"
              className="pos-text-input"
            />
          </div>
        </div>

        <div style={{ padding: '12px 1rem', overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...th, width: '28px' }}>#</th>
                <th style={{ ...th, width: '150px' }}>Item Code</th>
                <th style={th}>Product</th>
                <th style={{ ...th, width: '110px' }}>Unit</th>
                <th style={{ ...th, width: '70px' }}>Current</th>
                <th style={{ ...th, width: '56px' }}>+ / −</th>
                <th style={{ ...th, width: '90px' }}>Qty</th>
                <th style={{ ...th, width: '110px' }}>New Stock</th>
                <th style={{ ...th, width: '32px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const res = resultStock(r);
                const isErr = r.status === 'error';
                return (
                  <React.Fragment key={r.key}>
                    <tr style={{ background: isErr ? '#FEF2F2' : 'transparent', borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ ...cell, color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>{idx + 1}</td>
                      <td style={cell}>
                        <input
                          ref={(el) => { codeRefs.current[r.key] = el; }}
                          type="text"
                          autoFocus={idx === 0}
                          value={r.code}
                          disabled={saving}
                          placeholder="e.g. PNT-140"
                          onChange={(e) =>
                            updateRow(r.key, { code: e.target.value, item: null, status: 'idle', error: undefined })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              if (r.item) {
                                pendingFocus.current = { key: r.key, field: 'qty' };
                                setRows((prev) => [...prev]);
                              } else {
                                resolveCode(r);
                              }
                            }
                          }}
                          className="pos-text-input"
                          style={{ fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}
                        />
                      </td>
                      <td style={{ ...cell, fontWeight: 600, color: '#0F172A' }}>{r.item ? r.item.name : '—'}</td>
                      <td style={{ ...cell, color: '#64748B' }}>{r.item ? (r.item.pack_size || r.item.unit) : '—'}</td>
                      <td style={{ ...cell, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                        {r.item ? r.item.stock_qty : '—'}
                      </td>
                      <td style={cell}>
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled={saving}
                          onClick={() => updateRow(r.key, { sign: r.sign === 1 ? -1 : 1 })}
                          style={{
                            width: '40px',
                            padding: '6px 0',
                            fontWeight: 800,
                            fontSize: '14px',
                            borderRadius: '6px',
                            border: '1px solid',
                            cursor: 'pointer',
                            background: r.sign === 1 ? '#DCFCE7' : '#FEE2E2',
                            color: r.sign === 1 ? '#166534' : '#991B1B',
                            borderColor: r.sign === 1 ? '#86EFAC' : '#FCA5A5',
                          }}
                          title="Toggle add / subtract"
                        >
                          {r.sign === 1 ? '+' : '−'}
                        </button>
                      </td>
                      <td style={cell}>
                        <input
                          ref={(el) => { qtyRefs.current[r.key] = el; }}
                          type="number"
                          min={0}
                          step="any"
                          value={r.qty}
                          disabled={saving || !r.item}
                          onChange={(e) => updateRow(r.key, { qty: e.target.value.replace('-', ''), status: 'idle', error: undefined })}
                          onKeyDown={(e) => {
                            if (e.key === '+') {
                              e.preventDefault();
                              updateRow(r.key, { sign: 1 });
                            } else if (e.key === '-') {
                              e.preventDefault();
                              updateRow(r.key, { sign: -1 });
                            } else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                              e.preventDefault();
                              commitQty(r);
                            }
                          }}
                          className="pos-text-input"
                          style={{ fontWeight: 700, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ ...cell, fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: res !== null && res < 0 ? '#B91C1C' : '#0F172A' }}>
                        {res === null ? '—' : res}
                      </td>
                      <td style={cell}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => removeRow(r.key)}
                          disabled={saving}
                          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '14px' }}
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                    {isErr && r.error && (
                      <tr style={{ background: '#FEF2F2' }}>
                        <td></td>
                        <td colSpan={8} style={{ padding: '0 8px 6px', fontSize: '11px', color: '#B91C1C', fontWeight: 600 }}>
                          {r.error}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ padding: '1rem', display: 'flex', gap: '8px', borderTop: '1px solid #E2E8F0' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#334155', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid #CBD5E1', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleApply}
            style={{ flex: 2, padding: '10px', background: '#F97316', color: '#ffffff', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            {saving ? 'Saving Adjustments...' : 'Apply All Adjustments (Ctrl+Enter)'}
          </button>
        </div>
      </div>
    </div>
  );
}
