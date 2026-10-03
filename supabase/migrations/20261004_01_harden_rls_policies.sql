-- Migration: 20261004_01_harden_rls_policies.sql
-- Phase 2 Implementation — FINDING-DB-001, FINDING-DB-002, FINDING-DB-004
-- Purpose: Restrict overly permissive RLS policies on token, brand, and AI settings tables
--          to service_role only, and add SET search_path to SECURITY DEFINER stock functions.
-- Applied: 2026-10-04
-- Safety: Non-destructive — alters policy role scope only, no data change.
--         supabaseAdmin (service_role) continues to operate normally.
--         Direct anon-key PostgREST access to sensitive tables is blocked.

-- ============================================================
-- PART 1: FINDING-DB-002
-- Add SET search_path to SECURITY DEFINER stock adjust functions
-- (Prevents search path hijacking — zero regression risk)
-- ============================================================

ALTER FUNCTION public.adjust_item_stock(UUID, NUMERIC)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.adjust_item_stock_by_code(UUID, TEXT, NUMERIC)
  SET search_path = public, pg_temp;

-- ============================================================
-- PART 2: FINDING-DB-001
-- Restrict permissive RLS policies on token & brand tables
-- to service_role (backend API use via supabaseAdmin only)
-- ============================================================

-- brands
DROP POLICY IF EXISTS brands_all ON brands;
CREATE POLICY brands_service_role ON brands
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- brand_series
DROP POLICY IF EXISTS brand_series_all ON brand_series;
CREATE POLICY brand_series_service_role ON brand_series
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- custom_units
DROP POLICY IF EXISTS custom_units_all ON custom_units;
CREATE POLICY custom_units_service_role ON custom_units
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- series_token_configs
DROP POLICY IF EXISTS series_token_configs_all ON series_token_configs;
CREATE POLICY series_token_configs_service_role ON series_token_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- token_redemptions
DROP POLICY IF EXISTS token_redemptions_all ON token_redemptions;
CREATE POLICY token_redemptions_service_role ON token_redemptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- token_redemption_items
DROP POLICY IF EXISTS token_redemption_items_all ON token_redemption_items;
CREATE POLICY token_redemption_items_service_role ON token_redemption_items
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- token_transactions
DROP POLICY IF EXISTS token_transactions_all ON token_transactions;
CREATE POLICY token_transactions_service_role ON token_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- PART 3: FINDING-DB-004
-- Fix AI settings policies to explicitly scope to service_role
-- (Policies exist in migration file but lack TO service_role clause;
--  AI tables are applied separately in 20261004_02_apply_ai_system.sql
--  only if they are missing. The statements below are idempotent via
--  DROP IF EXISTS and are safe to include here for forward compatibility.)
-- ============================================================

-- NOTE: The AI settings tables (global_ai_settings, tenant_ai_settings,
--       ai_usage_ledger) were NOT applied to the live database.
--       They will be created and correctly scoped in the next migration file.
--       The policies below are included as a safeguard if partial apply occurred.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'global_ai_settings' AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $q$
      DROP POLICY IF EXISTS "Service role full access on global_ai_settings" ON public.global_ai_settings;
      CREATE POLICY "Service role full access on global_ai_settings"
        ON public.global_ai_settings FOR ALL TO service_role USING (true);
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'tenant_ai_settings' AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $q$
      DROP POLICY IF EXISTS "Service role full access on tenant_ai_settings" ON public.tenant_ai_settings;
      CREATE POLICY "Service role full access on tenant_ai_settings"
        ON public.tenant_ai_settings FOR ALL TO service_role USING (true);
    $q$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ai_usage_ledger' AND relnamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $q$
      DROP POLICY IF EXISTS "Service role full access on ai_usage_ledger" ON public.ai_usage_ledger;
      CREATE POLICY "Service role full access on ai_usage_ledger"
        ON public.ai_usage_ledger FOR ALL TO service_role USING (true);
    $q$;
  END IF;
END $$;
