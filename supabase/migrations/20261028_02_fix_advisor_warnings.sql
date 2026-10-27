-- Migration: 20261028_02_fix_advisor_warnings.sql
-- Fixes 4 Supabase advisor warnings:
-- 1. function_search_path_mutable: public.get_inventory_stats
-- 2. anon_security_definer_function_executable: public.reassign_ceo_before_tenant_delete
-- 3. authenticated_security_definer_function_executable: public.reassign_ceo_before_tenant_delete
-- 4. auth_rls_initplan: public.held_invoices ("Tenant isolation for held_invoices")

-- 1. Fix mutable search_path on public.get_inventory_stats(uuid)
ALTER FUNCTION public.get_inventory_stats(uuid) SET search_path = public, pg_temp;

-- 2 & 3. Revoke EXECUTE from PUBLIC, anon, and authenticated on SECURITY DEFINER function
REVOKE EXECUTE ON FUNCTION public.reassign_ceo_before_tenant_delete() FROM PUBLIC, anon, authenticated;

-- 4. Recreate held_invoices RLS policy with (select current_setting(...)) inside one transaction
BEGIN;

DROP POLICY IF EXISTS "Tenant isolation for held_invoices" ON public.held_invoices;

CREATE POLICY "Tenant isolation for held_invoices"
  ON public.held_invoices
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (NULLIF((select current_setting('request.jwt.claims', true)), '')::jsonb ->> 'tenant_id')::uuid
    OR (NULLIF((select current_setting('request.jwt.claims', true)), '')::jsonb ->> 'role') = 'service_role'
  )
  WITH CHECK (
    tenant_id = (NULLIF((select current_setting('request.jwt.claims', true)), '')::jsonb ->> 'tenant_id')::uuid
    OR (NULLIF((select current_setting('request.jwt.claims', true)), '')::jsonb ->> 'role') = 'service_role'
  );

COMMIT;
