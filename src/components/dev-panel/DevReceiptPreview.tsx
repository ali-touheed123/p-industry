import React from 'react';
import { TemplateJson, PaperSize, PAPER_SIZE_CONFIG } from '@/types/receipt';

export interface ReceiptItemData {
  item_name: string;
  shade_code?: string;
  code?: string;
  qty: number;
  unit_price: number;
  discount?: number;
  total_price: number;
}

export interface ReceiptInvoiceData {
  invoice_no?: string;
  date?: string;
  cashier_name?: string;
  client_name?: string;
  payment_method?: string;
  items?: ReceiptItemData[];
  subtotal?: number;
  discount?: number;
  tax?: number;
  net_total?: number;
  paid_amount?: number;
  due_amount?: number;
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
}

export const MOCK_INVOICE_DATA: ReceiptInvoiceData = {
  invoice_no: 'INV-2026-0842',
  date: '2026-09-05 01:15 PM',
  cashier_name: 'Bilal Ahmed (Counter 1)',
  client_name: 'Ali Raza Paints & Hardware',
  payment_method: 'Cash / Split',
  shop_name: 'Al-Madina Color Center',
  shop_address: 'Shop # 14, Commercial Market, Lahore',
  shop_phone: '+92 300 1234567',
  items: [
    { item_name: 'Weather Shield Matt Finish 4L', shade_code: 'Off-White 101', code: 'WSM-04', qty: 2, unit_price: 3450, discount: 100, total_price: 6800 },
    { item_name: 'Super Gloss Enamel 1L', shade_code: 'Signal Red 303', code: 'SGE-01', qty: 4, unit_price: 1150, discount: 0, total_price: 4600 },
    { item_name: 'Wall Putty Premium 20kg', shade_code: 'White', code: 'WPP-20', qty: 1, unit_price: 1850, discount: 50, total_price: 1800 },
    { item_name: 'Paint Thinner T-100 0.5L', shade_code: '', code: 'THN-50', qty: 3, unit_price: 320, discount: 0, total_price: 960 },
  ],
  subtotal: 14310,
  discount: 150,
  tax: 0,
  net_total: 14160,
  paid_amount: 14000,
  due_amount: 160,
};

interface DevReceiptPreviewProps {
  template: TemplateJson;
  paperSize: PaperSize;
  invoiceData?: ReceiptInvoiceData;
  scale?: number;
  className?: string;
  id?: string;
}

export const DevReceiptPreview: React.FC<DevReceiptPreviewProps> = ({
  template,
  paperSize,
  invoiceData = MOCK_INVOICE_DATA,
  scale = 1,
  className = '',
  id = 'receipt-print-area',
}) => {
  const sizeConfig = PAPER_SIZE_CONFIG[paperSize] || PAPER_SIZE_CONFIG.thermal_80;
  const isThermal = paperSize.startsWith('thermal');

  const {
    header,
    invoiceInfo,
    itemsTable,
    totals,
    footer,
    layout,
  } = template;

  const fontStack =
    layout.fontFamily === 'mono'
      ? '"JetBrains Mono", Consolas, "Courier New", monospace'
      : layout.fontFamily === 'serif'
      ? 'Georgia, Cambria, serif'
      : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const separatorStyle = (style: string): React.CSSProperties => {
    if (style === 'none') return {};
    if (style === 'double') return { borderBottom: '3px double #1e293b' };
    return { borderBottom: `1px ${style} #1e293b` };
  };

  const shopTitle = header.customShopName || invoiceData.shop_name || 'PYNTFLOW PAINTS';
  const shopAddress = header.customAddress || invoiceData.shop_address || 'Industrial Area, Phase 2, Lahore';
  const shopPhone = header.customPhone || invoiceData.shop_phone || '+92 300 0000000';

  const items = invoiceData.items || [];
  const cur = totals.currencySymbol || 'Rs.';

  return (
    <div
      id={id}
      className={`receipt-preview-container ${className}`}
      style={{
        width: isThermal ? `${sizeConfig.widthMm}mm` : '100%',
        maxWidth: isThermal ? `${sizeConfig.defaultWidthPx}px` : `${sizeConfig.defaultWidthPx}px`,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: fontStack,
        fontSize: `${layout.fontSize}px`,
        lineHeight: 1.35,
        padding: `${layout.marginTop}mm ${layout.marginRight}mm ${layout.marginBottom}mm ${layout.marginLeft}mm`,
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
        borderRadius: isThermal ? '4px' : '6px',
        boxSizing: 'border-box',
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        transformOrigin: 'top center',
      }}
    >
      {/* ─── HEADER SECTION ─────────────────────────────────────────── */}
      <div
        style={{
          textAlign: header.align,
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle(header.separator),
        }}
      >
        {header.showLogo && (
          <div
            style={{
              display: 'flex',
              justifyContent: header.align === 'center' ? 'center' : header.align === 'right' ? 'flex-end' : 'flex-start',
              marginBottom: '6px',
            }}
          >
            <img
              src={header.logoUrl || '/logo.png'}
              alt="Logo"
              style={{
                height: `${header.logoSize || 48}px`,
                maxWidth: '100%',
                objectFit: 'contain',
              }}
              onError={(e) => {
                // Fallback to text if logo fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {header.showShopName && (
          <h2
            style={{
              margin: '0 0 2px 0',
              fontSize: `${Math.round(layout.fontSize * 1.25)}px`,
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            {shopTitle}
          </h2>
        )}

        {header.showAddress && (
          <div style={{ fontSize: `${Math.max(9, layout.fontSize - 2)}px`, color: '#475569', marginTop: '2px' }}>
            {shopAddress}
          </div>
        )}

        {header.showPhone && (
          <div style={{ fontSize: `${Math.max(9, layout.fontSize - 2)}px`, color: '#475569', marginTop: '1px' }}>
            Tel: {shopPhone}
          </div>
        )}
      </div>

      {/* ─── INVOICE INFO SECTION ───────────────────────────────────── */}
      <div
        style={{
          fontSize: `${Math.max(10, layout.fontSize - 1)}px`,
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle('dashed'),
        }}
      >
        {invoiceInfo.showInvoiceNo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '2px' }}>
            <span>{invoiceInfo.invoiceLabel || 'Invoice #'}:</span>
            <span>{invoiceData.invoice_no || 'INV-0000'}</span>
          </div>
        )}

        {invoiceInfo.showDate && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '2px' }}>
            <span>Date:</span>
            <span>{invoiceData.date || new Date().toLocaleString()}</span>
          </div>
        )}

        {invoiceInfo.showCashier && invoiceData.cashier_name && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '2px' }}>
            <span>Cashier:</span>
            <span>{invoiceData.cashier_name}</span>
          </div>
        )}

        {invoiceInfo.showCustomer && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '2px' }}>
            <span>Customer:</span>
            <span style={{ fontWeight: 600 }}>{invoiceData.client_name || 'Walk-in Customer'}</span>
          </div>
        )}

        {invoiceInfo.showPaymentMethod && invoiceData.payment_method && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
            <span>Payment:</span>
            <span>{invoiceData.payment_method}</span>
          </div>
        )}
      </div>

      {/* ─── ITEMS TABLE SECTION ────────────────────────────────────── */}
      <div
        style={{
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle(header.separator === 'none' ? 'dashed' : header.separator),
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: `${itemsTable.fontSize || layout.fontSize}px`,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: itemsTable.showBorders ? '1px solid #0f172a' : 'none',
                textAlign: 'left',
              }}
            >
              {itemsTable.columns.includes('code') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, width: '15%' }}>Code</th>
              )}
              {itemsTable.columns.includes('name') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700 }}>Item</th>
              )}
              {itemsTable.columns.includes('qty') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'center', width: '12%' }}>Qty</th>
              )}
              {itemsTable.columns.includes('rate') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: '22%' }}>Rate</th>
              )}
              {itemsTable.columns.includes('discount') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: '16%' }}>Disc</th>
              )}
              {itemsTable.columns.includes('amount') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: '24%' }}>Total</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: itemsTable.showBorders && !itemsTable.compact ? '1px dashed #e2e8f0' : 'none',
                }}
              >
                {itemsTable.columns.includes('code') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, verticalAlign: 'top', fontSize: '0.85em', color: '#64748b' }}>
                    {item.code || '-'}
                  </td>
                )}
                {itemsTable.columns.includes('name') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                    {item.shade_code && (
                      <div style={{ fontSize: '0.85em', color: '#64748b' }}>
                        Shade: {item.shade_code}
                      </div>
                    )}
                  </td>
                )}
                {itemsTable.columns.includes('qty') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'center', verticalAlign: 'top', fontWeight: 600 }}>
                    {item.qty}
                  </td>
                )}
                {itemsTable.columns.includes('rate') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top' }}>
                    {item.unit_price.toLocaleString()}
                  </td>
                )}
                {itemsTable.columns.includes('discount') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top', color: '#dc2626' }}>
                    {item.discount ? `-${item.discount}` : '0'}
                  </td>
                )}
                {itemsTable.columns.includes('amount') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top', fontWeight: 700 }}>
                    {item.total_price.toLocaleString()}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── TOTALS SECTION ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          fontSize: `${layout.fontSize}px`,
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle('dashed'),
        }}
      >
        {totals.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Subtotal:</span>
            <span>{cur} {(invoiceData.subtotal || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showDiscount && (invoiceData.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
            <span>Discount:</span>
            <span>-{cur} {(invoiceData.discount || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showGst && (totals.gstRate || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>GST ({totals.gstRate}%):</span>
            <span>{cur} {Math.round(((invoiceData.subtotal || 0) * (totals.gstRate || 0)) / 100).toLocaleString()}</span>
          </div>
        )}

        {totals.showGrandTotal && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: totals.boldTotal ? `${Math.round(layout.fontSize * 1.2)}px` : `${layout.fontSize}px`,
              fontWeight: totals.boldTotal ? 900 : 700,
              paddingTop: '4px',
              borderTop: '1px solid #0f172a',
              marginTop: '3px',
            }}
          >
            <span>NET TOTAL:</span>
            <span>{cur} {(invoiceData.net_total || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showPaid && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>Paid Amount:</span>
            <span>{cur} {(invoiceData.paid_amount || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showBalance && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              color: totals.highlightBalanceDue && (invoiceData.due_amount || 0) > 0 ? '#b91c1c' : '#0f172a',
              background: totals.highlightBalanceDue && (invoiceData.due_amount || 0) > 0 ? '#fef2f2' : 'transparent',
              padding: totals.highlightBalanceDue && (invoiceData.due_amount || 0) > 0 ? '2px 4px' : '0',
              borderRadius: '2px',
            }}
          >
            <span>Balance Due:</span>
            <span>{cur} {(invoiceData.due_amount || 0).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ─── FOOTER SECTION ─────────────────────────────────────────── */}
      <div
        style={{
          textAlign: 'center',
          fontSize: `${Math.max(9, layout.fontSize - 2)}px`,
          color: '#475569',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {footer.line1 && <div style={{ fontWeight: 600 }}>{footer.line1}</div>}
        {footer.line2 && <div>{footer.line2}</div>}

        {footer.showWhatsapp && footer.whatsappNumber && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '2px', fontWeight: 600, color: '#047857' }}>
            <span>WhatsApp Support:</span>
            <span>{footer.whatsappNumber}</span>
          </div>
        )}

        {footer.showQrCode && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '4px 0' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                border: '1px dashed #cbd5e1',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#94a3b8',
                background: '#f8fafc',
              }}
            >
              [QR Code]
            </div>
            {footer.qrCodeText && (
              <span style={{ fontSize: '8px', color: '#94a3b8', marginTop: '2px' }}>{footer.qrCodeText}</span>
            )}
          </div>
        )}

        {footer.showPoweredBy && (
          <div
            style={{
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#94a3b8',
              marginTop: '4px',
              fontWeight: 700,
            }}
          >
            {footer.poweredByText || 'Powered by Pyntflow ERP'}
          </div>
        )}
      </div>
    </div>
  );
};
