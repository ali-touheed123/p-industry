-- ============================================================================
-- Migration: 20261009_01_supabase_advisor_reconciliation.sql
-- Description: Supabase Advisor Live-Verified Remediation
-- Scope: 59 Advisor Findings (6 search_path, 36 RPC EXECUTE, 17 RLS policies)
-- Target System: PyntFlow POS & Industrial ERP (p-industry)
-- Mode: Idempotent Database DDL
-- ============================================================================

-- ----------------------------------------------------------------------------
-- WAVE 1: Function Search Path Hardening (SA-TASK-01)
-- ----------------------------------------------------------------------------

ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_default_receipt_template(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.reset_rate_limit_atomic(text) SET search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- WAVE 2: Function Execution Privilege Hardening (SA-TASK-02 & SA-TASK-03)
-- Revoke EXECUTE from PUBLIC, anon, authenticated. Grant EXECUTE to service_role.
-- ----------------------------------------------------------------------------

-- REM-F01: adjust_item_stock
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) TO service_role;

-- REM-F02: adjust_item_stock_by_code
REVOKE EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) TO service_role;

-- REM-F03: cancel_invoice_atomic
REVOKE EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) TO service_role;

-- REM-F04: cancel_purchase_atomic
REVOKE EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) TO service_role;

-- REM-F05: check_rate_limit_atomic
REVOKE EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) TO service_role;

-- REM-F06: create_invoice_atomic
REVOKE EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO service_role;

-- REM-F07: create_purchase_atomic
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;

-- REM-F08: create_voucher_atomic
REVOKE EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) TO service_role;

-- REM-F09: get_ceo_branches_kpi_summary
REVOKE EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) TO service_role;

-- REM-F10: process_branch_dispatch_atomic
REVOKE EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) TO service_role;

-- REM-F11: process_branch_receive_atomic
REVOKE EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) TO service_role;

-- REM-F12: receive_goods_atomic
REVOKE EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) TO service_role;

-- REM-F13: redeem_tokens_atomic
REVOKE EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) TO service_role;

-- REM-F14: reserve_ai_usage
REVOKE EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) TO service_role;

-- REM-F15: reset_rate_limit_atomic
REVOKE EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) TO service_role;

-- REM-F16: set_default_receipt_template
REVOKE EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) TO service_role;

-- REM-F17: settle_tokens_atomic
REVOKE EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) TO service_role;

-- REM-F18: update_invoice_atomic
REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) TO service_role;

-- ----------------------------------------------------------------------------
-- WAVE 3: Explicit Service Role RLS Policies (SA-TASK-04 — 17 Tables)
-- Document intentional access model for service_role and satisfy linter hygiene.
-- ----------------------------------------------------------------------------

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'app_users' AND policyname = 'app_users_service_role') THEN
    CREATE POLICY "app_users_service_role" ON public."app_users" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_logs' AND policyname = 'audit_logs_service_role') THEN
    CREATE POLICY "audit_logs_service_role" ON public."audit_logs" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branch_order_items' AND policyname = 'branch_order_items_service_role') THEN
    CREATE POLICY "branch_order_items_service_role" ON public."branch_order_items" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'branch_orders' AND policyname = 'branch_orders_service_role') THEN
    CREATE POLICY "branch_orders_service_role" ON public."branch_orders" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clients' AND policyname = 'clients_service_role') THEN
    CREATE POLICY "clients_service_role" ON public."clients" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoice_items' AND policyname = 'invoice_items_service_role') THEN
    CREATE POLICY "invoice_items_service_role" ON public."invoice_items" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'invoices_service_role') THEN
    CREATE POLICY "invoices_service_role" ON public."invoices" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'items' AND policyname = 'items_service_role') THEN
    CREATE POLICY "items_service_role" ON public."items" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'petty_expenses' AND policyname = 'petty_expenses_service_role') THEN
    CREATE POLICY "petty_expenses_service_role" ON public."petty_expenses" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchase_items' AND policyname = 'purchase_items_service_role') THEN
    CREATE POLICY "purchase_items_service_role" ON public."purchase_items" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'purchases' AND policyname = 'purchases_service_role') THEN
    CREATE POLICY "purchases_service_role" ON public."purchases" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'receipt_templates' AND policyname = 'receipt_templates_service_role') THEN
    CREATE POLICY "receipt_templates_service_role" ON public."receipt_templates" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shifts' AND policyname = 'shifts_service_role') THEN
    CREATE POLICY "shifts_service_role" ON public."shifts" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'suppliers' AND policyname = 'suppliers_service_role') THEN
    CREATE POLICY "suppliers_service_role" ON public."suppliers" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenant_receipt_template' AND policyname = 'tenant_receipt_template_service_role') THEN
    CREATE POLICY "tenant_receipt_template_service_role" ON public."tenant_receipt_template" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenants_service_role') THEN
    CREATE POLICY "tenants_service_role" ON public."tenants" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'vouchers' AND policyname = 'vouchers_service_role') THEN
    CREATE POLICY "vouchers_service_role" ON public."vouchers" AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

/*
===============================================================================
VALIDATED ROLLBACK STATEMENTS (FOR EMERGENCY RECOVERY ONLY)
===============================================================================

-- ROLLBACK WAVE 1: RESET search_path on 6 functions
ALTER FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) RESET search_path;
ALTER FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) RESET search_path;
ALTER FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) RESET search_path;
ALTER FUNCTION public.set_default_receipt_template(uuid) RESET search_path;
ALTER FUNCTION public.check_rate_limit_atomic(text, integer, integer) RESET search_path;
ALTER FUNCTION public.reset_rate_limit_atomic(text) RESET search_path;

-- ROLLBACK WAVE 2: RESTORE ORIGINAL ACL (GRANT EXECUTE to PUBLIC, anon, authenticated)
GRANT EXECUTE ON FUNCTION public.adjust_item_stock(uuid, numeric) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_item_stock_by_code(uuid, text, numeric) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(uuid, uuid, text, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_purchase_atomic(uuid, uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit_atomic(text, integer, integer) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(jsonb, jsonb, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_voucher_atomic(uuid, jsonb, uuid[]) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ceo_branches_kpi_summary(uuid[], date) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_dispatch_atomic(uuid, uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_branch_receive_atomic(uuid, uuid, uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_goods_atomic(uuid, uuid, numeric, text, text, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_tokens_atomic(jsonb, jsonb) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, text, text, text, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_rate_limit_atomic(text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_receipt_template(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic(uuid, uuid, jsonb, jsonb) TO PUBLIC, anon, authenticated;

-- ROLLBACK WAVE 3: DROP 17 SERVICE ROLE POLICIES
DROP POLICY IF EXISTS "app_users_service_role" ON public."app_users";
DROP POLICY IF EXISTS "audit_logs_service_role" ON public."audit_logs";
DROP POLICY IF EXISTS "branch_order_items_service_role" ON public."branch_order_items";
DROP POLICY IF EXISTS "branch_orders_service_role" ON public."branch_orders";
DROP POLICY IF EXISTS "clients_service_role" ON public."clients";
DROP POLICY IF EXISTS "invoice_items_service_role" ON public."invoice_items";
DROP POLICY IF EXISTS "invoices_service_role" ON public."invoices";
DROP POLICY IF EXISTS "items_service_role" ON public."items";
DROP POLICY IF EXISTS "petty_expenses_service_role" ON public."petty_expenses";
DROP POLICY IF EXISTS "purchase_items_service_role" ON public."purchase_items";
DROP POLICY IF EXISTS "purchases_service_role" ON public."purchases";
DROP POLICY IF EXISTS "receipt_templates_service_role" ON public."receipt_templates";
DROP POLICY IF EXISTS "shifts_service_role" ON public."shifts";
DROP POLICY IF EXISTS "suppliers_service_role" ON public."suppliers";
DROP POLICY IF EXISTS "tenant_receipt_template_service_role" ON public."tenant_receipt_template";
DROP POLICY IF EXISTS "tenants_service_role" ON public."tenants";
DROP POLICY IF EXISTS "vouchers_service_role" ON public."vouchers";
===============================================================================
*/
