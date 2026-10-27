'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Share2,
  Printer,
  CreditCard,
  PlusCircle,
  Info,
  AlertTriangle,
  Pencil,
  X,
  Coins,
  MessageSquare,
  ExternalLink,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
} from 'lucide-react';
import { Client, Supplier } from '@/types';
import { generateLedgerStatementPdf, type LedgerPdfMode } from '@/utils/ledgerPdf';

interface Props {
  tenantId?: string;
  tenantSlug?: string;
  tenantName?: string;
  staffName?: string;
  staffUsername?: string;
}

export interface LedgerTransactionItem {
  item_name: string;
  code?: string;
  shade_code?: string;
  pack_size?: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

interface LedgerTransaction {
  id: string;
  date: string;
  type: string;
  typeClass: string;
  desc: string;
  debit: number;
  credit: number;
  bal: number;
  items?: LedgerTransactionItem[];
}

export default function FinancialLedgers({
  tenantId,
  tenantSlug,
  tenantName = 'Paint House',
  staffName = 'Counter Staff',
  staffUsername,
}: Props) {
  const [activeTab, setActiveTab] = useState<'clients' | 'suppliers' | 'branches'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedParty, setSelectedParty] = useState<any | null>(null);
  const [statement, setStatement] = useState<LedgerTransaction[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Date Range Filter State
  const [datePreset, setDatePreset] = useState<'all' | '30d' | '3m' | '6m' | 'custom'>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Drill-down Accordion for Itemized Invoices/Purchases
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // WhatsApp Statement Image Modal
  const [whatsAppStatementModal, setWhatsAppStatementModal] = useState<{
    party: any;
    phone: string;
    blob: Blob;
    pdfUrl: string;
    mode: LedgerPdfMode;
    pageCount: number;
  } | null>(null);
  const [isGeneratingStatementImage, setIsGeneratingStatementImage] = useState<boolean>(false);
  const [statementMode, setStatementMode] = useState<LedgerPdfMode>('summary');

  // Edit Credit Limit State
  const [isEditingLimit, setIsEditingLimit] = useState(false);
  const [editLimitValue, setEditLimitValue] = useState('');
  const [savingLimit, setSavingLimit] = useState(false);

  // Record Receipt Modal State
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [refNotes, setRefNotes] = useState('');
  const [submittingReceipt, setSubmittingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Supplier Token Stockpile State (for Pay Supplier modal)
  const [availableSupplierTokens, setAvailableSupplierTokens] = useState<any[]>([]);
  const [selectedSupplierTokenIds, setSelectedSupplierTokenIds] = useState<string[]>([]);
  const [selectedSupplierTokenQtys, setSelectedSupplierTokenQtys] = useState<Record<string, number>>({});
  const [filterTokensBySupplier, setFilterTokensBySupplier] = useState<boolean>(true);
  const [loadingSupplierTokens, setLoadingSupplierTokens] = useState<boolean>(false);

  // Quick Add Party Modal State
  const [showAddPartyModal, setShowAddPartyModal] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newPartyPhone, setNewPartyPhone] = useState('');
  const [newPartyAddress, setNewPartyAddress] = useState('');
  const [newPartyReference, setNewPartyReference] = useState('');
  const [newPartyLimit, setNewPartyLimit] = useState('50000');
  const [newPartyPreviousBalance, setNewPartyPreviousBalance] = useState('');
  const [submittingParty, setSubmittingParty] = useState(false);

  // Edit Party Modal State
  const [showEditPartyModal, setShowEditPartyModal] = useState(false);
  const [editPartyId, setEditPartyId] = useState('');
  const [editPartyName, setEditPartyName] = useState('');
  const [editPartyPhone, setEditPartyPhone] = useState('');
  const [editPartyAddress, setEditPartyAddress] = useState('');
  const [editPartyReference, setEditPartyReference] = useState('');
  const [editPartyLimit, setEditPartyLimit] = useState('50000');
  const [editPartyOpeningBalance, setEditPartyOpeningBalance] = useState('');
  const [submittingEditParty, setSubmittingEditParty] = useState(false);
  const [editPartyError, setEditPartyError] = useState('');

  // Fetch Clients & Suppliers
  const fetchParties = async () => {
    if (!tenantId) return;
    try {
      if (activeTab === 'clients') {
        const res = await fetch(`/api/clients?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setClients(data.clients || []);
          if (data.clients?.length > 0) {
            setSelectedParty((prev: any) => {
              if (!prev) return data.clients[0];
              const updated = data.clients.find((c: any) => c.id === prev.id);
              return updated || data.clients[0];
            });
          }
        }
      } else if (activeTab === 'suppliers') {
        const res = await fetch(`/api/suppliers?tenant_id=${tenantId}`);
        const data = await res.json();
        if (data.success) {
          setSuppliers(data.suppliers || []);
          if (data.suppliers?.length > 0) {
            setSelectedParty((prev: any) => {
              if (!prev) return data.suppliers[0];
              const updated = data.suppliers.find((s: any) => s.id === prev.id);
              return updated || data.suppliers[0];
            });
          }
        }
      } else {
        // Fetch Sister Branches (Other shops/godowns)
        const combinedBranches: any[] = [];

        try {
          const res = await fetch('/api/tenants');
          const data = await res.json();
          if (data.success && data.tenants) {
            (data.tenants || []).forEach((t: any) => {
              if (t.id !== tenantId) {
                combinedBranches.push({
                  id: t.id,
                  code: t.slug?.toUpperCase() || 'BR',
                  name: t.name || 'Sister Branch',
                  city: t.city || 'Pakistan',
                  phone: t.phone || t.owner_phone || '—',
                  address: t.address || t.city || 'Commercial Market',
                  type: 'branch',
                  current_balance: 0,
                });
              }
            });
          }
        } catch (e) {
          console.error(e);
        }

        setBranches(combinedBranches);
        if (combinedBranches.length > 0) {
          setSelectedParty((prev: any) => {
            if (!prev) return combinedBranches[0];
            const updated = combinedBranches.find((b: any) => b.id === prev.id);
            return updated || combinedBranches[0];
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchParties();
  }, [tenantId, activeTab]);

  // Fetch Live Ledger Statement for Selected Party
  const fetchLedgerStatement = async (partyId: string) => {
    if (!tenantId || !partyId) return;
    setLoadingLedger(true);
    try {
      const partyTypeParam = activeTab === 'clients' ? 'client' : activeTab === 'suppliers' ? 'supplier' : 'branch';
      const res = await fetch(
        `/api/ledgers?tenant_id=${tenantId}&party_id=${partyId}&party_type=${partyTypeParam}`
      );
      const data = await res.json();
      if (data.success) {
        setStatement(data.statement || []);
      } else {
        setStatement([]);
      }
    } catch (err) {
      console.error(err);
      setStatement([]);
    } finally {
      setLoadingLedger(false);
    }
  };

  useEffect(() => {
    if (selectedParty?.id) {
      fetchLedgerStatement(selectedParty.id);
      setIsEditingLimit(false);
    }
  }, [selectedParty?.id, activeTab]);

  // Fetch available tokens for supplier payment modal
  const fetchAvailableSupplierTokens = async () => {
    if (!tenantId) return;
    setLoadingSupplierTokens(true);
    try {
      const res = await fetch(`/api/tokens?tenant_id=${tenantId}&usage_status=available`);
      const data = await res.json();
      if (data.success) {
        setAvailableSupplierTokens(data.transactions || []);
      } else {
        setAvailableSupplierTokens([]);
      }
    } catch (err) {
      console.error('Failed to load available tokens for supplier payment', err);
      setAvailableSupplierTokens([]);
    } finally {
      setLoadingSupplierTokens(false);
    }
  };

  useEffect(() => {
    if (showReceiptModal && activeTab === 'suppliers') {
      setSelectedSupplierTokenIds([]);
      setSelectedSupplierTokenQtys({});
      fetchAvailableSupplierTokens();
    }
  }, [showReceiptModal, activeTab, selectedParty?.id]);

  // Fuzzy match available tokens against selected supplier / brand
  const matchingSupplierTokens = React.useMemo(() => {
    if (activeTab !== 'suppliers') return [];
    if (!filterTokensBySupplier) return availableSupplierTokens;
    const supName = (selectedParty?.name || '').toLowerCase().trim();
    if (!supName) return availableSupplierTokens;
    return availableSupplierTokens.filter((t: any) => {
      const brand = (t.brand_name || t.brand || '').toLowerCase().trim();
      if (!brand) return false;
      const brandWords = brand.split(/\s+/).filter((w: string) => w.length > 2);
      const supWords = supName.split(/\s+/).filter((w: string) => w.length > 2);
      return (
        supName.includes(brand) ||
        brand.includes(supName) ||
        brandWords.some((w: string) => supName.includes(w)) ||
        supWords.some((w: string) => brand.includes(w))
      );
    });
  }, [availableSupplierTokens, filterTokensBySupplier, selectedParty, activeTab]);

  // Quantity-aware calculation: multiplies unit face value by selected quantity (BUG-FL-01 resolution)
  const supplierTokensAppliedAmount = React.useMemo(() => {
    if (activeTab !== 'suppliers') return 0;
    return availableSupplierTokens
      .filter((t: any) => selectedSupplierTokenIds.includes(t.id))
      .reduce((sum: number, t: any) => {
        const maxQty = Math.max(0, Number(t.remaining_quantity ?? t.quantity ?? 1));
        const rawQty = selectedSupplierTokenQtys[t.id];
        const qty = typeof rawQty === 'number' && Number.isInteger(rawQty) && rawQty > 0
          ? Math.min(rawQty, maxQty)
          : maxQty;
        return sum + ((Number(t.token_value) || 0) * qty);
      }, 0);
  }, [availableSupplierTokens, selectedSupplierTokenIds, selectedSupplierTokenQtys, activeTab]);

  const supplierTokensTotalUnits = React.useMemo(() => {
    if (activeTab !== 'suppliers') return 0;
    return availableSupplierTokens
      .filter((t: any) => selectedSupplierTokenIds.includes(t.id))
      .reduce((sum: number, t: any) => {
        const maxQty = Math.max(0, Number(t.remaining_quantity ?? t.quantity ?? 1));
        const rawQty = selectedSupplierTokenQtys[t.id];
        const qty = typeof rawQty === 'number' && Number.isInteger(rawQty) && rawQty > 0
          ? Math.min(rawQty, maxQty)
          : maxQty;
        return sum + qty;
      }, 0);
  }, [availableSupplierTokens, selectedSupplierTokenIds, selectedSupplierTokenQtys, activeTab]);

  // Record Payment Receipt / Payment with structured payment_mode & tokens
  const handleRecordReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty || !tenantId) return;

    const cash = parseFloat(receiptAmount) || 0;
    const tokensValue = activeTab === 'suppliers' ? supplierTokensAppliedAmount : 0;
    const totalSettlement = cash + tokensValue;

    if (totalSettlement <= 0) {
      setReceiptError('Please enter a payment amount or select at least one stockpiled token.');
      return;
    }

    // Validate token allocations if selected
    let tokenAllocations: { token_id: string; quantity: number }[] = [];
    if (activeTab === 'suppliers' && selectedSupplierTokenIds.length > 0) {
      for (const id of selectedSupplierTokenIds) {
        const token = availableSupplierTokens.find((t: any) => t.id === id);
        if (!token) {
          setReceiptError('One or more selected tokens are no longer available. Please refresh.');
          return;
        }
        const maxQty = Math.max(0, Number(token.remaining_quantity ?? token.quantity ?? 0));
        if (maxQty <= 0 || token.usage_status === 'used') {
          setReceiptError(`Token batch "${token.brand_name || 'Token'}" is depleted and cannot be applied.`);
          return;
        }
        const rawQty = selectedSupplierTokenQtys[id] ?? maxQty;
        if (typeof rawQty !== 'number' || !Number.isInteger(rawQty) || rawQty < 1) {
          setReceiptError(`Please enter a valid positive integer quantity for token batch "${token.brand_name || 'Token'}".`);
          return;
        }
        if (rawQty > maxQty) {
          setReceiptError(`Requested quantity (${rawQty}) exceeds available stock (${maxQty}) for token batch "${token.brand_name || 'Token'}".`);
          return;
        }
        if (rawQty > 2147483647) {
          setReceiptError('Quantity exceeds maximum 32-bit integer limit (2,147,483,647).');
          return;
        }
        tokenAllocations.push({ token_id: id, quantity: rawQty });
      }
    }

    setSubmittingReceipt(true);
    setReceiptError('');

    try {
      const partyTypeParam = activeTab === 'clients' ? 'client' : activeTab === 'suppliers' ? 'supplier' : 'branch';
      const voucherTypeParam = activeTab === 'clients' ? 'receipt' : 'payment';
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          voucher_type: voucherTypeParam,
          party_type: partyTypeParam,
          party_id: selectedParty.id,
          party_name: selectedParty.name,
          amount: cash,
          payment_mode: paymentMode,
          reference_no: paymentMode !== 'Cash' ? refNotes : null,
          remarks: refNotes ? `${refNotes}` : undefined,
          created_by: staffName,
          applied_token_ids: activeTab === 'suppliers' ? selectedSupplierTokenIds : [],
          token_allocations: activeTab === 'suppliers' && tokenAllocations.length > 0 ? tokenAllocations : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowReceiptModal(false);
        setReceiptAmount('');
        setRefNotes('');
        setSelectedSupplierTokenIds([]);
        setSelectedSupplierTokenQtys({});
        // Refresh parties and statement
        await fetchParties();
        await fetchLedgerStatement(selectedParty.id);
      } else {
        setReceiptError(data.error || 'Failed to record receipt');
      }
    } catch (err: any) {
      setReceiptError(err.message || 'Error recording payment receipt');
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Update Client Credit Limit
  const handleUpdateCreditLimit = async () => {
    if (!selectedParty || !tenantId || activeTab !== 'clients') return;
    setSavingLimit(true);
    try {
      const newLimit = parseFloat(editLimitValue) || 0;
      const res = await fetch('/api/clients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedParty.id,
          tenant_id: tenantId,
          credit_limit: newLimit,
        }),
      });
      const data = await res.json();
      if (data.success && data.client) {
        setSelectedParty((prev: any) => ({ ...prev, credit_limit: newLimit }));
        setClients((prev) =>
          prev.map((c) => (c.id === selectedParty.id ? { ...c, credit_limit: newLimit } : c))
        );
        setIsEditingLimit(false);
      }
    } catch (err) {
      console.error('Failed to update credit limit', err);
    } finally {
      setSavingLimit(false);
    }
  };

  // Create New Client / Supplier
  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartyName || !tenantId) return;
    setSubmittingParty(true);

    try {
      const endpoint = activeTab === 'clients' ? '/api/clients' : '/api/suppliers';
      const bodyPayload = activeTab === 'clients'
        ? {
            tenant_id: tenantId,
            name: newPartyName,
            phone: newPartyPhone,
            address: newPartyAddress,
            city: newPartyAddress,
            reference: newPartyReference.trim() || undefined,
            credit_limit: parseFloat(newPartyLimit) || 50000,
            previous_balance: parseFloat(newPartyPreviousBalance) || 0,
          }
        : {
            tenant_id: tenantId,
            name: newPartyName,
            phone: newPartyPhone,
            address: newPartyAddress,
            city: newPartyAddress,
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddPartyModal(false);
        setNewPartyName('');
        setNewPartyPhone('');
        setNewPartyAddress('');
        setNewPartyReference('');
        setNewPartyPreviousBalance('');
        await fetchParties();
        if (data.client) setSelectedParty(data.client);
        if (data.supplier) setSelectedParty(data.supplier);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingParty(false);
    }
  };

  // Open Edit Party Modal
  const handleOpenEditParty = (party: any) => {
    if (!party) return;
    setEditPartyId(party.id);
    setEditPartyName(party.name || '');
    setEditPartyPhone(party.phone || '');
    setEditPartyAddress(party.address || party.city || '');
    setEditPartyReference(party.reference || '');
    setEditPartyLimit(party.credit_limit !== undefined ? String(party.credit_limit) : '50000');
    // Pre-fill opening balance only if it hasn't been set yet (so user can fix it)
    setEditPartyOpeningBalance('');
    setEditPartyError('');
    setShowEditPartyModal(true);
  };

  // Save Edit Party Details
  const handleSaveEditParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPartyId || !tenantId) return;
    if (!editPartyName.trim()) {
      setEditPartyError('Customer name is required');
      return;
    }
    setSubmittingEditParty(true);
    setEditPartyError('');

    try {
      const endpoint = activeTab === 'clients' ? '/api/clients' : '/api/suppliers';
      const payload: any = {
        id: editPartyId,
        tenant_id: tenantId,
        name: editPartyName.trim(),
        phone: editPartyPhone.trim() || null,
        address: editPartyAddress.trim() || null,
        city: editPartyAddress.trim() || null,
      };

      if (activeTab === 'clients') {
        payload.reference = editPartyReference.trim() || null;
        payload.credit_limit = parseFloat(editPartyLimit) || 0;
        // Only send opening_balance if user typed a value (to avoid overwriting existing)
        const ob = parseFloat(editPartyOpeningBalance);
        if (!isNaN(ob) && editPartyOpeningBalance.trim() !== '') {
          payload.opening_balance = ob;
        }
      }

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update details');
      }

      const updatedRecord = data.client || data.supplier;

      // Update in local state
      if (activeTab === 'clients') {
        setClients((prev) =>
          prev.map((c) => (c.id === editPartyId ? { ...c, ...updatedRecord } : c))
        );
      } else if (activeTab === 'suppliers') {
        setSuppliers((prev) =>
          prev.map((s) => (s.id === editPartyId ? { ...s, ...updatedRecord } : s))
        );
      }

      if (selectedParty?.id === editPartyId) {
        setSelectedParty((prev: any) => ({ ...prev, ...updatedRecord }));
      }

      setShowEditPartyModal(false);
      await fetchParties();
    } catch (err: any) {
      setEditPartyError(err.message || 'Error updating details');
    } finally {
      setSubmittingEditParty(false);
    }
  };

  // WhatsApp Statement PDF (Summary / Detailed, multi-page) for Clients, Suppliers and Branches
  const handleSendWhatsAppLedger = async () => {
    if (!selectedParty) return;

    try {
      setIsGeneratingStatementImage(true);
      const partyTypeParam: 'client' | 'supplier' | 'branch' =
        activeTab === 'suppliers' ? 'supplier' : activeTab === 'branches' ? 'branch' : 'client';

      // Closing balance: live party balance when the period reaches the latest entry, else running balance at period end
      const lastFiltered = filteredStatement[filteredStatement.length - 1];
      const lastFull = statement[statement.length - 1];
      const closingBalance =
        lastFiltered && lastFull && lastFiltered.id === lastFull.id
          ? Number(selectedParty.current_balance ?? lastFiltered.bal)
          : lastFiltered
          ? lastFiltered.bal
          : undefined;

      const { blob, pageCount } = await generateLedgerStatementPdf({
        party: selectedParty,
        partyType: partyTypeParam,
        transactions: filteredStatement,
        tenantName,
        dateRangeLabel,
        mode: statementMode,
        closingBalance,
      });
      const pdfUrl = URL.createObjectURL(blob);

      const rawPhone = selectedParty.phone || '';
      let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '92' + cleanPhone.slice(1);
      }

      setWhatsAppStatementModal({
        party: selectedParty,
        phone: cleanPhone,
        blob,
        pdfUrl,
        mode: statementMode,
        pageCount,
      });
    } catch (err: any) {
      console.error('Error generating ledger statement PDF:', err);
      alert('Could not generate statement PDF. Please check party details.');
    } finally {
      setIsGeneratingStatementImage(false);
    }
  };

  const handleDownloadStatementPdf = () => {
    if (!whatsAppStatementModal) return;
    const a = document.createElement('a');
    a.href = whatsAppStatementModal.pdfUrl;
    const safeName = (whatsAppStatementModal.party.name || 'Statement').replace(/\s+/g, '_');
    a.download = `Statement_${safeName}_${whatsAppStatementModal.mode}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenStatementWhatsAppChat = () => {
    if (!whatsAppStatementModal) return;
    const phone = whatsAppStatementModal.phone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('Please enter a valid phone number for this party (e.g. 923001234567).');
      return;
    }
    window.open(`https://wa.me/${phone}`, '_blank');
  };

  const closeWhatsAppStatementModal = () => {
    if (whatsAppStatementModal) {
      URL.revokeObjectURL(whatsAppStatementModal.pdfUrl);
    }
    setWhatsAppStatementModal(null);
  };

  const partiesList = activeTab === 'clients' ? clients : activeTab === 'suppliers' ? suppliers : branches;
  const filteredParties = partiesList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.phone?.includes(searchQuery)
  );

  // ── Date Range Filter Logic ──────────────────────────────────────────────────
  const dateRangeLabel = (() => {
    if (datePreset === '30d') return 'Last 30 Days';
    if (datePreset === '3m') return 'Last 3 Months';
    if (datePreset === '6m') return 'Last 6 Months';
    if (datePreset === 'custom' && customFrom && customTo) return `${customFrom} to ${customTo}`;
    if (datePreset === 'custom' && customFrom) return `From ${customFrom}`;
    if (datePreset === 'custom' && customTo) return `Up to ${customTo}`;
    return 'All Transactions';
  })();

  const filteredStatement = statement.filter((t) => {
    if (datePreset === 'all') return true;
    if (!t.date) return true;
    const tDate = new Date(t.date);
    if (isNaN(tDate.getTime())) return true;
    const now = new Date();
    if (datePreset === '30d') {
      return tDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    if (datePreset === '3m') {
      return tDate >= new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    }
    if (datePreset === '6m') {
      return tDate >= new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    }
    if (datePreset === 'custom') {
      if (customFrom && tDate < new Date(customFrom)) return false;
      if (customTo) {
        const toDate = new Date(customTo);
        toDate.setHours(23, 59, 59, 999);
        if (tDate > toDate) return false;
      }
      return true;
    }
    return true;
  });

  const totalDebit = filteredStatement.reduce((s, t) => s + t.debit, 0);
  const totalCredit = filteredStatement.reduce((s, t) => s + t.credit, 0);

  // Balance & Reconciliation
  const currentPartyBalance = selectedParty?.current_balance || 0;
  const fullDebit = statement.reduce((s, t) => s + t.debit, 0);
  const fullCredit = statement.reduce((s, t) => s + t.credit, 0);
  const calculatedStatementNet = fullDebit - fullCredit;
  const hasReconciliationVariance = statement.length > 0 && Math.abs(currentPartyBalance - calculatedStatementNet) > 0.01;

  // Consistent 80% threshold
  const OVERDUE_THRESHOLD = 0.8;
  const creditLimit = selectedParty?.credit_limit || 0;
  const hasCreditLimit = activeTab === 'clients' && creditLimit > 0;
  const utilizationPct = hasCreditLimit ? Math.min(100, Math.round((currentPartyBalance / creditLimit) * 100)) : 0;
  const exceedsThreshold = hasCreditLimit && currentPartyBalance >= creditLimit * OVERDUE_THRESHOLD;

  return (
    <div className="financial-ledgers-container" style={{ display: 'grid', gridTemplateColumns: '300px 1fr 280px', gap: '1.25rem', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .role-tab {
          flex: 1;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--on-surface-variant);
          font-weight: 600;
          font-size: 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s;
        }
        .role-tab.active {
          background: var(--surface);
          color: var(--on-surface);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
      `}</style>
      
      {/* Print Styles for Isolated Ledger Statement */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-ledger-statement, #printable-ledger-statement * {
            visibility: visible !important;
          }
          #printable-ledger-statement {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 24px !important;
            margin: 0 !important;
            z-index: 999999 !important;
            overflow: visible !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ── Left Col: Directory Panel ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 className="headline-sm">Directory</h3>
            {activeTab !== 'branches' && (
              <button
                onClick={() => setShowAddPartyModal(true)}
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', background: 'var(--secondary)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title={`Add New ${activeTab === 'clients' ? 'Client' : 'Supplier'}`}
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)', padding: '3px', marginBottom: '0.75rem', gap: '2px' }}>
            <button
              onClick={() => { setActiveTab('clients'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'clients' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Clients ({clients.length})
            </button>
            <button
              onClick={() => { setActiveTab('suppliers'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'suppliers' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Suppliers ({suppliers.length})
            </button>
            <button
              onClick={() => { setActiveTab('branches'); setSelectedParty(null); }}
              className={`role-tab ${activeTab === 'branches' ? 'active' : ''}`}
              style={{ fontSize: '11px', padding: '6px 8px' }}
            >
              Branches ({branches.length})
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.625rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="form-input"
              placeholder={`Filter ${activeTab}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '34px' }}
            />
          </div>
        </div>

        {/* Directory List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredParties.map(party => {
            const isSelected = selectedParty?.id === party.id;
            const bal = party.current_balance || 0;
            const partyLimit = 'credit_limit' in party ? (party as any).credit_limit : null;
            const isOverdue = activeTab === 'clients' && partyLimit && partyLimit > 0 && bal > partyLimit * OVERDUE_THRESHOLD;
            return (
              <div
                key={party.id}
                onClick={() => setSelectedParty(party)}
                style={{
                  padding: '0.875rem 1rem',
                  borderBottom: '1px solid rgba(198,198,205,0.3)',
                  borderLeft: isSelected ? '4px solid var(--secondary)' : '4px solid transparent',
                  background: isSelected ? 'var(--surface-container)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--on-background)', lineHeight: 1.3 }}>
                    {party.name}
                  </span>
                  <span
                    className="badge"
                    style={{
                      background: isOverdue ? 'var(--error-container)' : bal === 0 ? '#d1fae5' : 'var(--surface-container-high)',
                      color: isOverdue ? 'var(--error)' : bal === 0 ? '#065f46' : 'var(--on-surface)',
                      fontSize: '10px',
                    }}
                  >
                    {activeTab === 'branches' ? 'BRANCH' : isOverdue ? 'OVERDUE' : bal === 0 ? 'SETTLED' : 'ACTIVE'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)' }}>
                  <span>ID: {party.code || party.city || '—'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="font-mono font-bold" style={{ color: isOverdue ? 'var(--error)' : 'inherit', fontSize: '12px' }}>
                      Rs. {bal.toLocaleString()}
                    </span>
                    {activeTab !== 'branches' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedParty(party);
                          handleOpenEditParty(party);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--on-surface-variant)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px',
                        }}
                        title={`Edit ${party.name}`}
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredParties.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
              No {activeTab} found.
            </div>
          )}
        </div>
      </div>

      {/* ── Middle Col: Statement of Account Table ── */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedParty ? (
          <div id="printable-ledger-statement" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--outline-variant)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 className="headline-sm">{selectedParty.name}</h3>
                  <span className="badge badge-secondary" style={{ fontSize: '10px' }}>
                    {activeTab === 'clients' ? 'Client' : activeTab === 'suppliers' ? 'Supplier' : 'Sister Branch'}
                  </span>
                  {activeTab !== 'branches' && (
                    <button
                      onClick={() => handleOpenEditParty(selectedParty)}
                      style={{
                        background: 'var(--surface-container-high)',
                        border: '1px solid var(--outline-variant)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--on-surface)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.15s',
                      }}
                      title={`Edit ${activeTab === 'clients' ? 'Client' : 'Supplier'} Info`}
                    >
                      <Pencil size={11} />
                      Edit Info
                    </button>
                  )}
                </div>
                <p className="text-muted text-xs font-mono" style={{ marginTop: '2px' }}>
                  ID: {selectedParty.code || '—'} • Tel: {selectedParty.phone || 'No phone'}{selectedParty.reference ? ` • Ref: ${selectedParty.reference}` : ''}
                </p>
              </div>

              <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
                {/* ── Quick Preset Buttons ── */}
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {(['all', '30d', '3m', '6m', 'custom'] as const).map((p) => {
                    const labels: Record<string, string> = { all: 'All', '30d': '30d', '3m': '3m', '6m': '6m', custom: 'Custom' };
                    const isActive = datePreset === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setDatePreset(p)}
                        style={{
                          height: '28px',
                          padding: '0 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '6px',
                          border: isActive ? '1.5px solid var(--secondary)' : '1px solid var(--outline-variant)',
                          background: isActive ? 'var(--secondary)' : 'var(--surface)',
                          color: isActive ? '#fff' : 'var(--on-surface-variant)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {labels[p]}
                      </button>
                    );
                  })}
                  <div style={{ width: '1px', height: '20px', background: 'var(--outline-variant)', margin: '0 2px' }} />
                  <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--outline-variant)' }} title="Statement PDF type">
                    {(['summary', 'detailed'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setStatementMode(m)}
                        style={{
                          height: '26px',
                          padding: '0 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: 'none',
                          cursor: 'pointer',
                          background: statementMode === m ? '#16A34A' : 'var(--surface)',
                          color: statementMode === m ? '#fff' : 'var(--on-surface-variant)',
                        }}
                      >
                        {m === 'summary' ? 'Summary' : 'Detailed'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSendWhatsAppLedger}
                    disabled={isGeneratingStatementImage}
                    className="btn btn-secondary"
                    style={{ height: '28px', padding: '0 8px', color: '#16A34A', borderColor: '#BBF7D0', background: '#F0FDF4' }}
                    title="Generate Statement PDF (multi-page) for WhatsApp"
                  >
                    {isGeneratingStatementImage ? (
                      <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Share2 size={15} />
                    )}
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="btn btn-secondary"
                    style={{ height: '28px', padding: '0 8px' }}
                    title="Print Ledger Statement"
                  >
                    <Printer size={15} />
                  </button>
                </div>

                {/* ── Custom Date Range Inputs (shown only when preset === 'custom') ── */}
                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>From</label>
                    <input
                      type="date"
                      value={customFrom}
                      onChange={e => setCustomFrom(e.target.value)}
                      className="form-input"
                      style={{ height: '28px', fontSize: '11px', padding: '0 6px' }}
                    />
                    <label style={{ fontSize: '11px', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap' }}>To</label>
                    <input
                      type="date"
                      value={customTo}
                      onChange={e => setCustomTo(e.target.value)}
                      className="form-input"
                      style={{ height: '28px', fontSize: '11px', padding: '0 6px' }}
                    />
                    {(customFrom || customTo) && (
                      <button
                        onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                        style={{ fontSize: '11px', color: 'var(--on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}
                        title="Clear custom range"
                      >✕</button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Table Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loadingLedger ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem', borderColor: '#f97316', borderTopColor: 'transparent' }} />
                  <p className="text-muted text-sm font-mono">Loading statement of account...</p>
                </div>
              ) : filteredStatement.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                  No transactions found for this party.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '28px', padding: '8px 4px', textAlign: 'center' }}></th>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Ref / Description</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStatement.map((t, idx) => {
                      const hasItems = t.items && t.items.length > 0;
                      const isExpanded = expandedTxId === t.id;
                      return (
                        <React.Fragment key={t.id || idx}>
                          <tr style={{ background: isExpanded ? 'rgba(249, 115, 22, 0.04)' : undefined }}>
                            <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                              {hasItems ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedTxId(isExpanded ? null : t.id)}
                                  title={isExpanded ? 'Collapse items breakdown' : 'Drill down to view itemized breakdown'}
                                  style={{
                                    background: isExpanded ? '#0F172A' : '#F1F5F9',
                                    color: isExpanded ? '#FFFFFF' : '#475569',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '4px',
                                    width: '20px',
                                    height: '20px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontSize: '11px',
                                  }}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              ) : null}
                            </td>
                            <td className="font-mono text-muted" style={{ fontSize: '12px' }}>{t.date}</td>
                            <td><span className={`badge ${t.typeClass}`}>{t.type}</span></td>
                            <td style={{ fontSize: '13px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span>{t.desc}</span>
                                {hasItems && (
                                  <span
                                    onClick={() => setExpandedTxId(isExpanded ? null : t.id)}
                                    style={{
                                      fontSize: '10.5px',
                                      color: '#2563EB',
                                      background: '#EFF6FF',
                                      border: '1px solid #BFDBFE',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {isExpanded ? 'Hide items' : `${t.items!.length} items ▼`}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="text-right font-mono font-bold" style={{ color: t.debit > 0 ? 'var(--error)' : 'inherit' }}>
                              {t.debit > 0 ? t.debit.toLocaleString() : '-'}
                            </td>
                            <td className="text-right font-mono font-bold" style={{ color: t.credit > 0 ? '#065f46' : 'inherit' }}>
                              {t.credit > 0 ? t.credit.toLocaleString() : '-'}
                            </td>
                            <td className="text-right font-mono font-bold">
                              {t.bal.toLocaleString()}
                            </td>
                          </tr>

                          {/* Accordion Item Breakdown */}
                          {isExpanded && hasItems && (
                            <tr style={{ background: '#F8FAFC' }}>
                              <td colSpan={7} style={{ padding: '8px 16px 14px 16px', borderBottom: '2px solid #E2E8F0' }}>
                                <div
                                  style={{
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>📦 Itemized Breakdown ({t.items!.length} items)</span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                      Ref: {t.desc.split('(')[0].trim()}
                                    </div>
                                  </div>

                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                    <thead>
                                      <tr style={{ background: '#F8FAFC', color: '#475569', borderBottom: '1px solid #E2E8F0' }}>
                                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700 }}>Item &amp; Code</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700 }}>Shade</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'left', fontWeight: 700 }}>Pack</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>Qty</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>Rate</th>
                                        <th style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700 }}>Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {t.items!.map((it, iIdx) => (
                                        <tr key={iIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                          <td style={{ padding: '5px 8px', fontWeight: 600, color: '#0F172A' }}>
                                            {it.code && (
                                              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#64748B', marginRight: '5px', fontSize: '10px' }}>
                                                [{it.code}]
                                              </span>
                                            )}
                                            {it.item_name}
                                          </td>
                                          <td style={{ padding: '5px 8px', color: '#475569' }}>
                                            {it.shade_code || '—'}
                                          </td>
                                          <td style={{ padding: '5px 8px', color: '#64748B' }}>
                                            {it.pack_size || 'Standard'}
                                          </td>
                                          <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                                            {it.qty}
                                          </td>
                                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                                            {Number(it.unit_price || 0) > 0 || Number(it.total_price || 0) > 0 ? `Rs. ${Number(it.unit_price || 0).toLocaleString()}` : '—'}
                                          </td>
                                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#0F172A' }}>
                                            {Number(it.unit_price || 0) > 0 || Number(it.total_price || 0) > 0 ? `Rs. ${Number(it.total_price || (it.qty * it.unit_price)).toLocaleString()}` : '—'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
            {/* Footer Totals */}
            <div style={{ padding: '0.75rem 1.25rem', background: 'var(--surface-container-high)', borderTop: '1px solid var(--outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div>
                <span className="text-muted">TOTAL DEBIT: </span>
                <strong className="font-mono" style={{ color: 'var(--on-surface)', marginLeft: '4px' }}>Rs. {totalDebit.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-muted">TOTAL CREDIT: </span>
                <strong className="font-mono" style={{ color: '#065f46', marginLeft: '4px' }}>Rs. {totalCredit.toLocaleString()}</strong>
              </div>
            </div>

            {/* Client Statement Footer */}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--on-surface-variant)' }}>
            Select an account from the directory.
          </div>
        )}
      </div>

      {/* ── Right Col: Financial Summary & Actions ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Record Receipt / Payment / Settlement Button */}
        <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius-md)', background: 'var(--secondary-fixed)', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
            <CreditCard size={24} />
          </div>
          <h4 style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
            {activeTab === 'clients' ? 'Receive Payment' : activeTab === 'suppliers' ? 'Pay Supplier' : 'Branch Settlement'}
          </h4>
          <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
            {activeTab === 'clients' ? 'Post cash, online or cheque payment to client ledger' : activeTab === 'suppliers' ? 'Record payment disbursed to vendor' : 'Settle inter-branch transfer balance'}
          </p>
          <button
            onClick={() => setShowReceiptModal(true)}
            disabled={!selectedParty}
            className="btn btn-primary btn-full"
            style={{ opacity: !selectedParty ? 0.5 : 1 }}
          >
            <PlusCircle size={18} />
            {activeTab === 'clients' ? 'Record Receipt' : activeTab === 'suppliers' ? 'Record Payment' : 'Record Settlement'}
          </button>
        </div>

        {/* Financial Summary Card */}
        {selectedParty && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h4 className="headline-sm" style={{ marginBottom: '1rem' }}>Financial Summary</h4>
            
            <div style={{ marginBottom: '1.25rem' }}>
              <div className="label-caps" style={{ color: 'var(--on-surface-variant)', marginBottom: '4px' }}>Total Outstanding</div>
              <div className="font-mono" style={{ fontSize: '26px', fontWeight: 800, color: currentPartyBalance > 0 ? 'var(--error)' : '#065f46' }}>
                Rs. {currentPartyBalance.toLocaleString()}
              </div>
              {hasReconciliationVariance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, marginTop: '6px' }} title={`Calculated statement balance: Rs. ${calculatedStatementNet.toLocaleString()}`}>
                  <Info size={14} style={{ flexShrink: 0 }} />
                  Statement balance: Rs. {calculatedStatementNet.toLocaleString()}
                </div>
              )}
              {exceedsThreshold && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--error)', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  Exceeds credit threshold (80%)
                </div>
              )}
            </div>


            {/* Credit Utilization (Clients Only) */}
            {activeTab === 'clients' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--on-surface-variant)', marginBottom: '6px' }}>
                  <span>CREDIT UTILIZATION</span>
                  <strong className="font-mono">{hasCreditLimit ? `${utilizationPct}%` : '—'}</strong>
                </div>
                {hasCreditLimit ? (
                  <div style={{ height: '8px', background: 'var(--surface-container-high)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${utilizationPct}%`,
                        background: utilizationPct > 80 ? 'var(--error)' : 'var(--secondary)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--on-surface-variant)', fontStyle: 'italic' }}>
                    No credit limit set
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--on-surface-variant)', marginTop: '6px' }}>
                  {isEditingLimit ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '26px', fontSize: '11px', padding: '2px 6px', flex: 1 }}
                        value={editLimitValue}
                        onChange={(e) => setEditLimitValue(e.target.value)}
                        placeholder="Enter limit"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleUpdateCreditLimit}
                        disabled={savingLimit}
                        className="btn btn-primary"
                        style={{ padding: '2px 6px', fontSize: '11px', height: '26px' }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingLimit(false)}
                        className="btn btn-secondary-outline"
                        style={{ padding: '2px 6px', fontSize: '11px', height: '26px' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>Limit: Rs. {hasCreditLimit ? creditLimit.toLocaleString() : '0'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditLimitValue(String(creditLimit || ''));
                          setIsEditingLimit(true);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--secondary)', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', padding: 0 }}
                        title="Edit Credit Limit"
                      >
                        <Pencil size={13} />
                        Edit Limit
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Contact Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', borderTop: '1px solid var(--outline-variant)', paddingTop: '1rem', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span className="label-caps" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>Contact Info</span>
                {activeTab !== 'branches' && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditParty(selectedParty)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--secondary)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0,
                    }}
                    title="Edit Contact & Info"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Account Code:</span>
                <strong className="font-mono">{selectedParty.code || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Phone Contact:</span>
                <strong className="font-mono">{selectedParty.phone || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">City / Location:</span>
                <strong>{selectedParty.city || selectedParty.address || '—'}</strong>
              </div>
              {selectedParty.reference && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-muted">Reference / Agent:</span>
                  <strong style={{ color: 'var(--primary, #0284c7)' }}>{selectedParty.reference}</strong>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Record Receipt / Supplier Payment Modal ── */}
      {showReceiptModal && selectedParty && (() => {
        const cashAmountNum = Math.max(0, parseFloat(receiptAmount) || 0);
        const tokensAmountNum = activeTab === 'suppliers' ? supplierTokensAppliedAmount : 0;
        const totalPaymentNum = cashAmountNum + tokensAmountNum;
        const remainingAfterTokens = Math.max(0, currentPartyBalance - tokensAmountNum);
        const projectedBalanceAfter = Math.max(0, currentPartyBalance - totalPaymentNum);

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
            <div className="card" style={{ width: '100%', maxWidth: activeTab === 'suppliers' ? '480px' : '420px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="headline-sm">
                  {activeTab === 'clients' ? 'Record Payment Receipt' : activeTab === 'suppliers' ? 'Record Supplier Payment' : 'Record Inter-Branch Settlement'}
                </h3>
                <button
                  onClick={() => {
                    setShowReceiptModal(false);
                    setSelectedSupplierTokenIds([]);
                    setSelectedSupplierTokenQtys({});
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Balance Summary Header */}
              <div style={{ padding: '0.75rem 1rem', background: 'var(--surface-container-low)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Party:</span>
                  <strong>{selectedParty.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--error)', fontWeight: 600 }}>
                  <span>Current Outstanding Balance:</span>
                  <span className="font-mono">Rs. {currentPartyBalance.toLocaleString()}</span>
                </div>

                {activeTab === 'suppliers' && tokensAmountNum > 0 && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309', fontWeight: 600, fontSize: '12px' }}>
                      <span>Token Value Applied:</span>
                      <span className="font-mono">- Rs. {tokensAmountNum.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0F172A', fontWeight: 700, fontSize: '12px', borderTop: '1px dashed #CBD5E1', paddingTop: '4px' }}>
                      <span>Balance After Tokens:</span>
                      <span className="font-mono">Rs. {remainingAfterTokens.toLocaleString()}</span>
                    </div>
                  </>
                )}

                {activeTab === 'suppliers' && (tokensAmountNum > 0 || cashAmountNum > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534', fontWeight: 700, fontSize: '12px', borderTop: '1px solid #E2E8F0', paddingTop: '4px' }}>
                    <span>Projected Balance After Payment:</span>
                    <span className="font-mono">Rs. {projectedBalanceAfter.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {receiptError && (
                <div style={{ background: 'var(--error-container)', border: '1px solid rgba(186,26,26,0.3)', borderRadius: 'var(--radius-sm)', padding: '0.625rem 0.875rem', fontSize: '13px', color: 'var(--on-error-container)', marginBottom: '1rem' }}>
                  {receiptError}
                </div>
              )}

              <form onSubmit={handleRecordReceipt} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* ── SUPPLIERS ONLY: STOCKPILED TOKENS CHECKLIST ── */}
                {activeTab === 'suppliers' && (
                  <div
                    style={{
                      background: '#FFFDF5',
                      border: '1px solid #FDE68A',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Coins size={16} style={{ color: '#D97706' }} />
                        <span style={{ fontSize: '11px', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', color: '#92400E', fontWeight: 800, letterSpacing: '0.04em' }}>
                          PAY VIA STOCKPILED TOKENS
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          onClick={() => setFilterTokensBySupplier(!filterTokensBySupplier)}
                          style={{
                            fontSize: '10.5px',
                            color: '#475569',
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {filterTokensBySupplier ? 'Showing Brand-Matched' : 'All Brands'}
                        </button>

                        {matchingSupplierTokens.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const eligibleTokens = matchingSupplierTokens.filter(
                                (t: any) => Number(t.remaining_quantity ?? t.quantity ?? 0) > 0 && t.usage_status !== 'used'
                              );
                              const eligibleIds = eligibleTokens.map((t: any) => t.id);
                              const allSelected = eligibleIds.length > 0 && eligibleIds.every((id: string) => selectedSupplierTokenIds.includes(id));
                              if (allSelected) {
                                setSelectedSupplierTokenIds((prev) => prev.filter((id) => !eligibleIds.includes(id)));
                                setSelectedSupplierTokenQtys((prev) => {
                                  const next = { ...prev };
                                  eligibleIds.forEach((id) => delete next[id]);
                                  return next;
                                });
                              } else {
                                setSelectedSupplierTokenIds((prev) => Array.from(new Set([...prev, ...eligibleIds])));
                                setSelectedSupplierTokenQtys((prev) => {
                                  const next = { ...prev };
                                  eligibleTokens.forEach((t: any) => {
                                    if (!next[t.id]) {
                                      next[t.id] = Number(t.remaining_quantity ?? t.quantity ?? 1);
                                    }
                                  });
                                  return next;
                                });
                              }
                            }}
                            style={{
                              fontSize: '10.5px',
                              color: '#D97706',
                              background: '#FEF3C7',
                              border: '1px solid #FDE68A',
                              borderRadius: '4px',
                              padding: '2px 6px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {matchingSupplierTokens.some((t: any) => Number(t.remaining_quantity ?? t.quantity ?? 0) > 0 && t.usage_status !== 'used') &&
                            matchingSupplierTokens
                              .filter((t: any) => Number(t.remaining_quantity ?? t.quantity ?? 0) > 0 && t.usage_status !== 'used')
                              .every((t: any) => selectedSupplierTokenIds.includes(t.id))
                              ? 'Deselect All'
                              : 'Select All'}
                          </button>
                        )}
                      </div>
                    </div>

                    {loadingSupplierTokens ? (
                      <div style={{ padding: '8px', fontSize: '11.5px', color: '#64748B', textAlign: 'center' }}>
                        Loading available tokens...
                      </div>
                    ) : matchingSupplierTokens.length === 0 ? (
                      <div style={{ padding: '8px 10px', background: '#FFFFFF', borderRadius: '6px', fontSize: '11px', color: '#64748B', border: '1px dashed #CBD5E1' }}>
                        {filterTokensBySupplier
                          ? `No available stockpiled tokens matching "${selectedParty.name}". Click "All Brands" to view tokens from other brands.`
                          : 'No available stockpiled tokens in stock.'}
                      </div>
                    ) : (
                      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {matchingSupplierTokens.map((t: any) => {
                          const isChecked = selectedSupplierTokenIds.includes(t.id);
                          const maxQty = Math.max(0, Number(t.remaining_quantity ?? t.quantity ?? 0));
                          const isDepleted = maxQty <= 0 || t.usage_status === 'used';
                          const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString('en-PK') : '';
                          const originLabel = (t.type || t.transaction_type) === 'shop_retained' ? 'Retained' : (t.type || t.transaction_type) === 'opening_stock' ? 'Opening' : 'Redeemed';
                          const currentQty = selectedSupplierTokenQtys[t.id] ?? maxQty;
                          const unitVal = Number(t.token_value || 0);
                          const lineTotal = unitVal * (isChecked ? currentQty : maxQty);

                          return (
                            <div
                              key={t.id}
                              onClick={() => {
                                if (isDepleted) return;
                                if (isChecked) {
                                  setSelectedSupplierTokenIds((prev) => prev.filter((id) => id !== t.id));
                                } else {
                                  setSelectedSupplierTokenIds((prev) => [...prev, t.id]);
                                  if (!selectedSupplierTokenQtys[t.id]) {
                                    setSelectedSupplierTokenQtys((prev) => ({
                                      ...prev,
                                      [t.id]: maxQty > 0 ? maxQty : 1,
                                    }));
                                  }
                                }
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 8px',
                                background: isDepleted ? '#F8FAFC' : isChecked ? '#FEF3C7' : '#FFFFFF',
                                border: isDepleted ? '1px solid #E2E8F0' : isChecked ? '1px solid #F59E0B' : '1px solid #E2E8F0',
                                borderRadius: '6px',
                                cursor: isDepleted ? 'not-allowed' : 'pointer',
                                opacity: isDepleted ? 0.6 : 1,
                                transition: 'all 0.15s ease',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
                                <input
                                  type="checkbox"
                                  disabled={isDepleted}
                                  checked={isChecked && !isDepleted}
                                  onChange={() => {}} // handled by parent onClick
                                  style={{ cursor: isDepleted ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                                />
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: isDepleted ? '#94A3B8' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {t.brand_name || t.brand || 'General'} · <span style={{ fontWeight: 500, color: '#475569' }}>{[t.series_name, t.unit_name].filter(Boolean).join(' · ') || t.item_name || 'Paint Token'}</span>
                                    {isDepleted && (
                                      <span style={{ marginLeft: '6px', fontSize: '9px', background: '#FEE2E2', color: '#DC2626', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                                        DEPLETED
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: '9.5px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {dateStr} · {originLabel} · Avail: {maxQty}
                                  </div>
                                </div>
                              </div>

                              {/* Quantity selector & line total calculation */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                {isChecked && !isDepleted && (
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <label style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>Qty:</label>
                                    <input
                                      type="number"
                                      min="1"
                                      max={maxQty}
                                      step="1"
                                      value={currentQty}
                                      onChange={(e) => {
                                        const parsed = parseInt(e.target.value, 10);
                                        if (isNaN(parsed)) {
                                          setSelectedSupplierTokenQtys((prev) => ({ ...prev, [t.id]: 1 }));
                                        } else {
                                          const clamped = Math.max(1, Math.min(maxQty, Math.min(parsed, 2147483647)));
                                          setSelectedSupplierTokenQtys((prev) => ({ ...prev, [t.id]: clamped }));
                                        }
                                      }}
                                      style={{
                                        width: '52px',
                                        padding: '2px 4px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        fontFamily: 'JetBrains Mono, monospace',
                                        textAlign: 'center',
                                        border: '1px solid #D97706',
                                        borderRadius: '4px',
                                        background: '#FFFFFF',
                                        color: '#0F172A',
                                      }}
                                    />
                                  </div>
                                )}

                                <div style={{ textAlign: 'right', minWidth: '75px' }}>
                                  <span
                                    style={{
                                      fontFamily: 'JetBrains Mono, monospace',
                                      fontWeight: 800,
                                      color: isDepleted ? '#94A3B8' : '#D97706',
                                      fontSize: '11.5px',
                                      display: 'block',
                                    }}
                                  >
                                    Rs. {(isChecked ? lineTotal : unitVal).toLocaleString()}
                                  </span>
                                  <span style={{ fontSize: '9px', color: '#94A3B8', display: 'block' }}>
                                    {isChecked ? `(${currentQty} × Rs. ${unitVal.toLocaleString()})` : `@ Rs. ${unitVal.toLocaleString()}`}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {tokensAmountNum > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          background: '#DCFCE7',
                          border: '1px solid #86EFAC',
                          borderRadius: '6px',
                          fontSize: '11px',
                        }}
                      >
                        <span style={{ fontWeight: 700, color: '#166534' }}>
                          {selectedSupplierTokenIds.length} Token Batch(es) Selected ({supplierTokensTotalUnits} Unit{supplierTokensTotalUnits === 1 ? '' : 's'})
                        </span>
                        <span style={{ fontWeight: 800, color: '#166534', fontFamily: 'JetBrains Mono, monospace' }}>
                          - Rs. {tokensAmountNum.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── CASH / BANK PAYMENT FIELDS ── */}
                <div>
                  <label className="form-label">
                    {activeTab === 'branches'
                      ? 'Settlement Amount (Rs.) *'
                      : activeTab === 'suppliers'
                      ? tokensAmountNum > 0
                        ? 'Remaining Cash / Bank Payment (Rs.)'
                        : 'Payment Amount (Rs.) *'
                      : 'Payment Amount (Rs.) *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    required={tokensAmountNum === 0}
                    className="form-input"
                    placeholder={activeTab === 'suppliers' && tokensAmountNum > 0 ? '0 (or enter cash balance)' : '0'}
                    value={receiptAmount}
                    onChange={e => setReceiptAmount(e.target.value)}
                    autoFocus={tokensAmountNum === 0}
                  />
                </div>

                <div>
                  <label className="form-label">Payment Mode {tokensAmountNum > 0 && cashAmountNum === 0 ? '(for cash/bank balance if any)' : ''}</label>
                  <select
                    className="form-select"
                    value={paymentMode}
                    onChange={e => setPaymentMode(e.target.value)}
                  >
                    <option value="Cash">Cash in Hand</option>
                    <option value="Online Bank Transfer">Online Bank Transfer (Meezan / HBL)</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="EasyPaisa / JazzCash">EasyPaisa / JazzCash</option>
                  </select>
                </div>

                {paymentMode !== 'Cash' && cashAmountNum > 0 && (
                  <div>
                    <label className="form-label">
                      {paymentMode === 'Cheque' ? 'Cheque Number / Bank Details *' : 'Reference No / Transaction ID *'}
                    </label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder={paymentMode === 'Cheque' ? 'e.g. Cheque #881920 (Meezan Bank)' : 'e.g. HBL-992810 / TRX-8921'}
                      value={refNotes}
                      onChange={e => setRefNotes(e.target.value)}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReceiptModal(false);
                      setSelectedSupplierTokenIds([]);
                      setSelectedSupplierTokenQtys({});
                    }}
                    className="btn btn-secondary-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReceipt}
                    className="btn btn-primary"
                  >
                    {submittingReceipt
                      ? 'Posting to Ledger...'
                      : activeTab === 'branches'
                      ? 'Post Settlement'
                      : activeTab === 'suppliers'
                      ? tokensAmountNum > 0
                        ? `Post Payment (Rs. ${totalPaymentNum.toLocaleString()})`
                        : 'Post Payment'
                      : 'Post Receipt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Quick Add Client / Supplier Modal ── */}
      {showAddPartyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 2500 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 className="headline-sm">
                Add New {activeTab === 'clients' ? 'Client / Contractor' : 'Supplier'}
              </h3>
              <button onClick={() => setShowAddPartyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateParty} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label">Full Name / Business Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. BuildWell Builders / Master Paints"
                  value={newPartyName}
                  onChange={e => setNewPartyName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label">Phone Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0300-1234567"
                  value={newPartyPhone}
                  onChange={e => setNewPartyPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Address / Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. DHA Phase 5, Lahore"
                  value={newPartyAddress}
                  onChange={e => setNewPartyAddress(e.target.value)}
                />
              </div>

              {activeTab === 'clients' && (
                <>
                  <div>
                    <label className="form-label">Reference / Referrer / Agent</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Agent name, Contractor, Walk-in..."
                      value={newPartyReference}
                      onChange={e => setNewPartyReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Credit Limit (PKR)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={newPartyLimit}
                      onChange={e => setNewPartyLimit(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Previous Balance / Pehla Udhar (PKR)</span>
                      <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>Optional</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="form-input"
                      placeholder="0.00 (agar pehle se udhar chalta aa raha hai)"
                      value={newPartyPreviousBalance}
                      onChange={e => setNewPartyPreviousBalance(e.target.value)}
                    />
                    <span style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', display: 'block' }}>
                      Agar customer ka pehle se koi udhar/credit chal raha tha to yahan darj karein.
                    </span>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddPartyModal(false)}
                  className="btn btn-secondary-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingParty}
                  className="btn btn-primary"
                >
                  {submittingParty ? 'Saving...' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT PARTY / CLIENT MODAL ── */}
      {showEditPartyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500, padding: '1rem' }}>
          <div className="card" style={{ width: '440px', maxWidth: '94vw', padding: '1.5rem', background: '#FFFFFF', borderRadius: '14px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'var(--secondary-fixed, #e0f2fe)', color: 'var(--secondary, #0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Pencil size={17} />
                </div>
                <div>
                  <h3 className="headline-sm" style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                    {activeTab === 'clients' ? 'Edit Customer Profile' : 'Edit Supplier Profile'}
                  </h3>
                  <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'JetBrains Mono, monospace' }}>
                    {selectedParty?.code ? `Account Code: ${selectedParty.code}` : 'Update customer information'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditPartyModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {editPartyError && (
              <div style={{ padding: '8px 12px', background: '#FEE2E2', color: '#B91C1C', borderRadius: '6px', fontSize: '12px', marginBottom: '1rem', fontWeight: 600 }}>
                {editPartyError}
              </div>
            )}

            <form onSubmit={handleSaveEditParty} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: '#334155' }}>
                  Customer Name / Business <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Al-Madina Hardware"
                  value={editPartyName}
                  onChange={e => setEditPartyName(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: '#334155' }}>
                  Phone Number
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="0300-1234567"
                  value={editPartyPhone}
                  onChange={e => setEditPartyPhone(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '13px' }}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: '#334155' }}>
                  Address / City Location
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Shop #12, Commercial Market, Lahore"
                  value={editPartyAddress}
                  onChange={e => setEditPartyAddress(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '13px' }}
                />
              </div>

              {activeTab === 'clients' && (
                <>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: '#334155' }}>
                      Reference / Referrer / Agent
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Contractor Bilal, Agent..."
                      value={editPartyReference}
                      onChange={e => setEditPartyReference(e.target.value)}
                      style={{ width: '100%', height: '36px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'block', color: '#334155' }}>
                      Credit Limit (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="form-input"
                      value={editPartyLimit}
                      onChange={e => setEditPartyLimit(e.target.value)}
                      style={{ width: '100%', height: '36px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace' }}
                    />
                  </div>
                  <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#92400E' }}>
                      <span>⚠ Previous Balance / Pehla Udhar (PKR)</span>
                      <span style={{ fontSize: '10px', fontWeight: 500, color: '#B45309' }}>Baad mein bhi set karen</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="form-input"
                      placeholder="0.00 — khali chhoren agar change nahi karna"
                      value={editPartyOpeningBalance}
                      onChange={e => setEditPartyOpeningBalance(e.target.value)}
                      style={{ width: '100%', height: '36px', fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', borderColor: editPartyOpeningBalance ? '#F59E0B' : undefined }}
                    />
                    <p style={{ fontSize: '11px', color: '#92400E', marginTop: '4px', marginBottom: 0 }}>
                      Agar pehle balance bhuul gaye thay — yahan likhein. Sirf ek baar set hoga (dobara set karne se voucher add hoga).
                    </p>
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  onClick={() => setShowEditPartyModal(false)}
                  className="btn btn-secondary-outline"
                  style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEditParty}
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {submittingEditParty ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── WHATSAPP LEDGER STATEMENT IMAGE MODAL ── */}
      {whatsAppStatementModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            zIndex: 2500,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '720px',
              background: '#FFFFFF',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '92vh',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: '#16A34A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                  }}
                >
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0 }}>
                    WhatsApp Statement PDF
                  </h3>
                  <div style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
                    {whatsAppStatementModal.party.name} · {activeTab === 'suppliers' ? 'Supplier Statement' : activeTab === 'branches' ? 'Branch Statement' : 'Customer Khata'} · {whatsAppStatementModal.mode === 'detailed' ? 'Detailed' : 'Summary'} · {whatsAppStatementModal.pageCount} page{whatsAppStatementModal.pageCount === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeWhatsAppStatementModal}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#CBD5E1',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Phone Input & Chat Trigger */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>
                  Recipient WhatsApp Number (e.g. 923001234567)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={whatsAppStatementModal.phone}
                    onChange={(e) => setWhatsAppStatementModal({ ...whatsAppStatementModal, phone: e.target.value })}
                    placeholder="923001234567"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontFamily: 'JetBrains Mono, monospace',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleOpenStatementWhatsAppChat}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '8px 14px',
                      background: '#16A34A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <ExternalLink size={15} />
                    Open Chat
                  </button>
                </div>
              </div>

              {/* Instructions Notice */}
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#1E40AF',
                }}
              >
                <Download size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
                <span>
                  Click &quot;Download PDF&quot;, phir WhatsApp chat mein file attach karein (paperclip icon ya drag &amp; drop). Saare pages ek hi PDF mein hain.
                </span>
              </div>

              {/* Statement PDF Preview */}
              <div
                style={{
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                }}
              >
                <iframe
                  src={whatsAppStatementModal.pdfUrl}
                  title={`Statement for ${whatsAppStatementModal.party.name}`}
                  style={{ width: '100%', height: '460px', border: 'none', display: 'block' }}
                />
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div
              style={{
                background: '#F8FAFC',
                borderTop: '1px solid #E2E8F0',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDownloadStatementPdf}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 14px',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={15} />
                  <span>Download PDF</span>
                </button>
              </div>

              <button
                type="button"
                onClick={closeWhatsAppStatementModal}
                style={{
                  padding: '8px 14px',
                  background: '#E2E8F0',
                  color: '#0F172A',
                  border: 'none',
                  borderRadius: '7px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
