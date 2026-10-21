import React from 'react';
import { TemplateJson, PaperSize, PAPER_SIZE_CONFIG, DEFAULT_TEMPLATE_JSON } from '@/types/receipt';

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
  delivery_charge?: number;
  tax?: number;
  net_total?: number;
  paid_amount?: number;
  due_amount?: number;
  change_returned?: number;
  shop_name?: string;
  shop_address?: string;
  shop_phone?: string;
  token_claim_code?: string;
  token_claim_details?: string;
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
  delivery_charge: 0,
  tax: 0,
  net_total: 14160,
  paid_amount: 14000,
  due_amount: 160,
  change_returned: 0,
  token_claim_code: 'CLM-DEMO99',
  token_claim_details: 'Super Gloss Enamel 1L (x4) - Rs. 200 token value',
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

  const tokenClaimSlip = template.tokenClaimSlip ?? DEFAULT_TEMPLATE_JSON.tokenClaimSlip;
  const isSlipEnabled = tokenClaimSlip?.enabled !== false;

  const fontStack =
    layout.fontFamily === 'mono'
      ? '"JetBrains Mono", Consolas, "Courier New", monospace'
      : layout.fontFamily === 'serif'
      ? 'Georgia, Cambria, serif'
      : 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const separatorStyle = (style: string): React.CSSProperties => {
    if (style === 'none') return {};
    if (style === 'double') return { borderBottom: '3px double #000000' };
    return { borderBottom: `1px ${style} #000000` };
  };

  const shopTitle = header.customShopName || invoiceData.shop_name || 'PYNTFLOW PAINTS';
  const shopAddress = header.customAddress || invoiceData.shop_address || 'Industrial Area, Phase 2, Lahore';
  const shopPhone = header.customPhone || invoiceData.shop_phone || '+92 300 0000000';

  const items = invoiceData.items || [];
  const cur = totals.currencySymbol || 'Rs.';

  // Calculate synchronized column widths matching receiptRenderCore
  const hasCol = (colId: string) => itemsTable.columns.includes(colId as any);
  const withCode = hasCol('code');
  const withDisc = hasCol('discount');
  let colWidths: Record<string, string> = { name: '56%', qty: '12%', rate: '16%', amount: '16%' };
  if (withCode && withDisc) {
    colWidths = { code: '15%', name: '32%', qty: '10%', rate: '15%', discount: '12%', amount: '16%' };
  } else if (withCode && !withDisc) {
    colWidths = { code: '15%', name: '42%', qty: '11%', rate: '16%', amount: '16%' };
  } else if (!withCode && withDisc) {
    colWidths = { name: '45%', qty: '11%', rate: '16%', discount: '12%', amount: '16%' };
  } else {
    colWidths = { name: '56%', qty: '12%', rate: '16%', amount: '16%' };
  }

  const effectiveScale = (typeof scale === 'number' && scale !== 1) ? scale : (layout.scale || 1);
  const fontRatio = (layout.fontSize || 12) / 12;

  return (
    <div
      id={id}
      className={`receipt-preview-container ${className}`}
      style={{
        width: isThermal ? `${sizeConfig.widthMm}mm` : '100%',
        maxWidth: isThermal ? `${sizeConfig.defaultWidthPx}px` : `${sizeConfig.defaultWidthPx}px`,
        margin: '0 auto',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: fontStack,
        fontSize: `${layout.fontSize}px`,
        lineHeight: 1.35,
        padding: `${layout.marginTop}mm ${layout.marginRight}mm ${layout.marginBottom}mm ${layout.marginLeft}mm`,
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
        borderRadius: isThermal ? '4px' : '6px',
        boxSizing: 'border-box',
        transform: effectiveScale !== 1 ? `scale(${effectiveScale})` : undefined,
        transformOrigin: 'top center',
        transition: 'transform 0.15s ease',
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
              fontSize: `${header.shopNameSize ? Math.round(header.shopNameSize * fontRatio) : Math.round(layout.fontSize * 1.25)}px`,
              fontWeight: 800,
              letterSpacing: typeof header.shopNameLetterSpacing === 'number' ? `${header.shopNameLetterSpacing}em` : '0.5px',
              textTransform: header.shopNameUppercase !== false ? 'uppercase' : 'none',
              color: '#000000',
            }}
          >
            {shopTitle}
          </h2>
        )}

        {header.showAddress && (
          <div style={{ fontSize: `${header.addressSize ? Math.round(header.addressSize * fontRatio) : Math.max(9, layout.fontSize - 2)}px`, color: '#000000', marginTop: '2px' }}>
            {shopAddress}
          </div>
        )}

        {header.showPhone && (
          <div style={{ fontSize: `${header.phoneSize ? Math.round(header.phoneSize * fontRatio) : Math.max(9, layout.fontSize - 2)}px`, color: '#000000', marginTop: '1px' }}>
            {header.phonePrefix?.trim() || 'Tel:'} {shopPhone}
          </div>
        )}
      </div>

      {/* ─── INVOICE INFO SECTION ───────────────────────────────────── */}
      <div
        style={{
          fontSize: `${invoiceInfo.fontSize ? Math.round(invoiceInfo.fontSize * fontRatio) : Math.max(10, layout.fontSize - 1)}px`,
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle('dashed'),
          color: '#000000',
        }}
      >
        {/* T-19 Strict Compliance Lock: Invoice Number is mandatory and always visible */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: '2px', color: '#000000' }}>
          <span>{invoiceInfo.invoiceLabel || 'Invoice #'}:</span>
          <span>{invoiceData.invoice_no || 'INV-0000'}</span>
        </div>

        {invoiceInfo.showDate !== false && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', marginBottom: '2px' }}>
            <span>{invoiceInfo.dateLabel || 'Date:'}</span>
            <span>{invoiceData.date || new Date().toLocaleString()}</span>
          </div>
        )}

        {invoiceInfo.showCashier && invoiceData.cashier_name && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', marginBottom: '2px' }}>
            <span>{invoiceInfo.cashierLabel || 'Cashier:'}</span>
            <span>{invoiceData.cashier_name}</span>
          </div>
        )}

        {invoiceInfo.showCustomer && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', marginBottom: '2px' }}>
            <span>{invoiceInfo.customerLabel || 'Customer:'}</span>
            <span style={{ fontWeight: 600 }}>{invoiceData.client_name || 'Walk-in Customer'}</span>
          </div>
        )}

        {invoiceInfo.showPaymentMethod && invoiceData.payment_method && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
            <span>{invoiceInfo.paymentLabel || 'Payment:'}</span>
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
          color: '#000000',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: `${itemsTable.fontSize ? Math.round(itemsTable.fontSize * fontRatio) : layout.fontSize}px`,
            tableLayout: 'fixed',
            color: '#000000',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: itemsTable.showBorders ? '1px solid #000000' : 'none',
                textAlign: 'left',
                color: '#000000',
              }}
            >
              {itemsTable.columns.includes('code') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, width: colWidths.code || '15%' }}>
                  {itemsTable.colLabelCode || 'Code'}
                </th>
              )}
              {itemsTable.columns.includes('name') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, width: colWidths.name || '50%' }}>
                  {itemsTable.colLabelName || 'Item'}
                </th>
              )}
              {itemsTable.columns.includes('qty') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'center', width: colWidths.qty || '12%' }}>
                  {itemsTable.colLabelQty || 'Qty'}
                </th>
              )}
              {itemsTable.columns.includes('rate') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: colWidths.rate || '18%' }}>
                  {itemsTable.colLabelRate || 'Rate'}
                </th>
              )}
              {itemsTable.columns.includes('discount') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: colWidths.discount || '12%' }}>
                  {itemsTable.colLabelDiscount || 'Disc'}
                </th>
              )}
              {itemsTable.columns.includes('amount') && (
                <th style={{ padding: `${itemsTable.rowPadding}px 2px`, fontWeight: 700, textAlign: 'right', width: colWidths.amount || '18%' }}>
                  {itemsTable.colLabelAmount || 'Total'}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={idx}
                style={{
                  borderBottom: itemsTable.showBorders && !itemsTable.compact ? '1px dashed #000000' : 'none',
                  color: '#000000',
                }}
              >
                {itemsTable.columns.includes('code') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, verticalAlign: 'top', fontSize: '0.85em', color: '#000000', width: colWidths.code, wordBreak: 'break-all' }}>
                    {item.code || '-'}
                  </td>
                )}
                {itemsTable.columns.includes('name') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, verticalAlign: 'top', width: colWidths.name, wordBreak: 'break-word', color: '#000000' }}>
                    <div style={{ fontWeight: 600 }}>{item.item_name}</div>
                    {item.shade_code && (
                      <div style={{ fontSize: '0.85em', color: '#000000' }}>
                        Shade: {item.shade_code}
                      </div>
                    )}
                  </td>
                )}
                {itemsTable.columns.includes('qty') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'center', verticalAlign: 'top', fontWeight: 600, width: colWidths.qty, color: '#000000' }}>
                    {item.qty}
                  </td>
                )}
                {itemsTable.columns.includes('rate') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top', width: colWidths.rate, color: '#000000' }}>
                    {item.unit_price.toLocaleString()}
                  </td>
                )}
                {itemsTable.columns.includes('discount') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top', color: '#000000', width: colWidths.discount }}>
                    {item.discount ? `-${item.discount}` : '0'}
                  </td>
                )}
                {itemsTable.columns.includes('amount') && (
                  <td style={{ padding: `${itemsTable.rowPadding}px 2px`, textAlign: 'right', verticalAlign: 'top', fontWeight: 700, width: colWidths.amount, color: '#000000' }}>
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
          fontSize: `${totals.fontSize ? Math.round(totals.fontSize * fontRatio) : layout.fontSize}px`,
          paddingBottom: '8px',
          marginBottom: '8px',
          ...separatorStyle('dashed'),
          color: '#000000',
        }}
      >
        {totals.showSubtotal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
            <span>{totals.subtotalLabel || 'Subtotal:'}</span>
            <span>{cur} {(invoiceData.subtotal || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showDiscount && (invoiceData.discount || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
            <span>{totals.discountLabel || 'Discount:'}</span>
            <span>-{cur} {(invoiceData.discount || 0).toLocaleString()}</span>
          </div>
        )}

        {(invoiceData.delivery_charge || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
            <span>{totals.deliveryLabel || 'Delivery:'}</span>
            <span>+{cur} {(invoiceData.delivery_charge || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showGst && (totals.gstRate || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000' }}>
            <span>GST ({totals.gstRate}%):</span>
            <span>+{cur} {Math.round(((invoiceData.subtotal || 0) * (totals.gstRate || 0)) / 100).toLocaleString()}</span>
          </div>
        )}

        {/* T-19 Strict Compliance Lock: Grand Total is mandatory and always visible */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: totals.grandTotalFontSize ? `${Math.round(totals.grandTotalFontSize * fontRatio)}px` : (totals.boldTotal ? `${Math.round(layout.fontSize * 1.2)}px` : `${totals.fontSize ? Math.round(totals.fontSize * fontRatio) : layout.fontSize}px`),
            fontWeight: totals.boldTotal ? 900 : 700,
            paddingTop: '4px',
            borderTop: '1px solid #000000',
            marginTop: '3px',
            color: '#000000',
          }}
        >
          <span>{totals.netTotalLabel || 'NET TOTAL:'}</span>
          <span>{cur} {(invoiceData.net_total || 0).toLocaleString()}</span>
        </div>

        {totals.showPaid && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#000000' }}>
            <span>{totals.paidLabel || 'Paid Amount:'}</span>
            <span>{cur} {(invoiceData.paid_amount || 0).toLocaleString()}</span>
          </div>
        )}

        {(invoiceData.change_returned || 0) > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#000000', fontWeight: 700 }}>
            <span>{totals.changeLabel || 'Change Returned:'}</span>
            <span>{cur} {(invoiceData.change_returned || 0).toLocaleString()}</span>
          </div>
        )}

        {totals.showBalance && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              color: '#000000',
              padding: '0',
            }}
          >
            <span>{totals.balanceDueLabel || 'Balance Due:'}</span>
            <span>{cur} {(invoiceData.due_amount || 0).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* ─── FOOTER SECTION ─────────────────────────────────────────── */}
      <div
        style={{
          textAlign: footer.align || 'center',
          fontSize: `${Math.max(9, layout.fontSize - 2)}px`,
          color: '#000000',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {footer.line1 && (
          <div style={{ fontWeight: 600, fontSize: `${footer.line1Size ?? Math.max(9, layout.fontSize - 2)}px`, color: '#000000' }}>
            {footer.line1}
          </div>
        )}
        {footer.line2 && (
          <div style={{ fontSize: `${footer.line2Size ?? Math.max(9, layout.fontSize - 2)}px`, color: '#000000' }}>
            {footer.line2}
          </div>
        )}

        {footer.showWhatsapp && footer.whatsappNumber && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: footer.align === 'left' ? 'flex-start' : footer.align === 'right' ? 'flex-end' : 'center',
              gap: '4px',
              marginTop: '2px',
              fontWeight: 600,
              color: '#000000',
              fontSize: `${footer.whatsappSize ?? Math.max(9, layout.fontSize - 2)}px`,
            }}
          >
            <span>{footer.whatsappLabel || 'WhatsApp Support:'}</span>
            <span>{footer.whatsappNumber}</span>
          </div>
        )}

        {footer.showQrCode && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: footer.align === 'left' ? 'flex-start' : footer.align === 'right' ? 'flex-end' : 'center',
              margin: '4px 0',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                border: '1px dashed #000000',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                color: '#000000',
                background: 'transparent',
              }}
            >
              [QR Code]
            </div>
            {footer.qrCodeText && (
              <span style={{ fontSize: '8px', color: '#000000', marginTop: '2px' }}>{footer.qrCodeText}</span>
            )}
          </div>
        )}

        {footer.showPoweredBy && (
          <div
            style={{
              fontSize: '8px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: '#000000',
              marginTop: '4px',
              fontWeight: 700,
            }}
          >
            {footer.poweredByText || 'Powered by Pyntflow ERP'}
          </div>
        )}
      </div>

      {/* ─── TOKEN CLAIM SLIP (PREVIEW WITH DEMO WATERMARK) ────────── */}
      {isSlipEnabled && (
        <div
          style={{
            border: '1px dashed #000000',
            padding: '8px',
            marginTop: '12px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '2px',
            color: '#000000',
          }}
        >
          <div
            style={{
              fontSize: '9.5px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '3px',
              color: '#000000',
            }}
          >
            &#127915; {tokenClaimSlip?.title || 'Token Claim Slip'}
          </div>
          <div
            style={{
              fontSize: '8.5px',
              color: '#000000',
              marginBottom: '5px',
            }}
          >
            {tokenClaimSlip?.instructions || 'Present this code on your next visit to redeem your token'}
          </div>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 900,
              letterSpacing: '0.12em',
              border: '1px solid #000000',
              padding: '3px 8px',
              display: 'inline-block',
              margin: '3px 0',
              fontFamily: 'monospace',
              backgroundColor: '#ffffff',
              color: '#000000',
            }}
          >
            {invoiceData.token_claim_code || 'CLM-DEMO99'}
          </div>
          <div
            style={{
              fontSize: '8px',
              fontWeight: 800,
              color: '#000000',
              letterSpacing: '0.04em',
              margin: '3px 0',
              textTransform: 'uppercase',
            }}
          >
            [SAMPLE / PREVIEW ONLY — NOT REDEEMABLE]
          </div>
          {tokenClaimSlip?.showDetails && (invoiceData.token_claim_details || 'Super Gloss Enamel 1L (x4) - Rs. 200 token value') && (
            <div
              style={{
                fontSize: '8.5px',
                color: '#000000',
                marginTop: '3px',
                fontStyle: 'italic',
              }}
            >
              {invoiceData.token_claim_details || 'Super Gloss Enamel 1L (x4) - Rs. 200 token value'}
            </div>
          )}
          <div
            style={{
              fontSize: '7.5px',
              color: '#000000',
              marginTop: '4px',
            }}
          >
            {tokenClaimSlip?.footerNotice || 'Keep this receipt — code cannot be reissued'}
          </div>
        </div>
      )}
    </div>
  );
};
