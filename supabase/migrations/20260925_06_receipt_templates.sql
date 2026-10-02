-- Migration: 20260925_06_receipt_templates
-- Purpose : Create receipt_templates and tenant_receipt_template tables
--           that back the Aura Dev Hub Receipt Template Designer.
-- Run     : Apply via Supabase Dashboard > SQL Editor, or `supabase db push`.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. receipt_templates  (global catalogue of layout configurations)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  paper_size    TEXT NOT NULL DEFAULT 'thermal_80'
                  CHECK (paper_size IN ('thermal_80', 'thermal_58', 'a4', 'a5')),
  template_json JSONB NOT NULL DEFAULT '{}',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one template may be the platform default at a time
CREATE UNIQUE INDEX IF NOT EXISTS receipt_templates_single_default_idx
  ON public.receipt_templates (is_default)
  WHERE is_default = TRUE AND is_deleted = FALSE;

-- Performance: filter deleted, order by creation
CREATE INDEX IF NOT EXISTS idx_receipt_templates_active
  ON public.receipt_templates (is_deleted, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. tenant_receipt_template  (many-to-one: each tenant has at most one
--    explicitly assigned template; absence means inherit platform default)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenant_receipt_template (
  tenant_id    UUID PRIMARY KEY
                 REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id  UUID NOT NULL
                 REFERENCES public.receipt_templates(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coverage index for reverse lookups (which tenants use a given template)
CREATE INDEX IF NOT EXISTS idx_tenant_receipt_template_template_id
  ON public.tenant_receipt_template (template_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed the default 80mm thermal template (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.receipt_templates (
  name, description, paper_size, is_default, is_deleted, template_json
)
SELECT
  'Standard Thermal 80mm',
  'Default 80mm thermal roll receipt with logo, invoice details, and footer.',
  'thermal_80',
  TRUE,
  FALSE,
  '{
    "header": {
      "showLogo": true, "logoUrl": "", "logoSize": 56, "align": "center",
      "showShopName": true, "showAddress": true, "showPhone": true,
      "separator": "dashed"
    },
    "invoiceInfo": {
      "showInvoiceNo": true, "invoiceLabel": "Invoice #",
      "showDate": true, "showCashier": true,
      "showCustomer": true, "showPaymentMethod": true
    },
    "itemsTable": {
      "columns": ["name", "qty", "rate", "amount"],
      "fontSize": 12, "rowPadding": 4, "compact": false, "showBorders": false
    },
    "totals": {
      "showSubtotal": true, "showDiscount": true, "showGst": false,
      "gstRate": 0, "showGrandTotal": true, "showPaid": true,
      "showBalance": true, "boldTotal": true, "highlightBalanceDue": true,
      "currencySymbol": "Rs."
    },
    "footer": {
      "line1": "Thank you for your business!",
      "line2": "Returns accepted within 7 days with receipt.",
      "showWhatsapp": false, "whatsappNumber": "",
      "showPoweredBy": true, "poweredByText": "Powered by Pyntflow",
      "showQrCode": false
    },
    "layout": {
      "marginTop": 4, "marginBottom": 4, "marginLeft": 4, "marginRight": 4,
      "fontSize": 12, "fontFamily": "mono", "scale": 1
    },
    "locks": {}
  }'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.receipt_templates WHERE is_default = TRUE AND is_deleted = FALSE
);
