-- Migration: Enforce unique business constraints and single open shift per tenant
-- Fixes DB-07 (invoices, purchases, vouchers uniqueness) and DB-08 (single open shift per tenant)

-- 1. Unique invoice numbers per tenant
ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS uq_invoices_tenant_invoice_no;
ALTER TABLE public.invoices 
  ADD CONSTRAINT uq_invoices_tenant_invoice_no UNIQUE (tenant_id, invoice_no);

-- 2. Unique purchase numbers per tenant
ALTER TABLE public.purchases 
  DROP CONSTRAINT IF EXISTS uq_purchases_tenant_purchase_no;
ALTER TABLE public.purchases 
  ADD CONSTRAINT uq_purchases_tenant_purchase_no UNIQUE (tenant_id, purchase_no);

-- 3. Unique voucher numbers per tenant
ALTER TABLE public.vouchers 
  DROP CONSTRAINT IF EXISTS uq_vouchers_tenant_voucher_no;
ALTER TABLE public.vouchers 
  ADD CONSTRAINT uq_vouchers_tenant_voucher_no UNIQUE (tenant_id, voucher_no);

-- 4. Prevent multiple open shifts per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_open_shift_per_tenant 
  ON public.shifts (tenant_id) 
  WHERE status = 'open';
