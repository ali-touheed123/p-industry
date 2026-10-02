-- Migration: Add missing columns and indexes to audit_logs and suppliers
-- Fixes DB-01 (audit_logs.action_type) and DB-02 (suppliers.last_payment_amount, suppliers.last_payment_date)

-- 1. Add action_type and indexes to public.audit_logs
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS action_type TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);

-- 2. Add last_payment_amount and last_payment_date to public.suppliers
ALTER TABLE public.suppliers 
  ADD COLUMN IF NOT EXISTS last_payment_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_date DATE;
