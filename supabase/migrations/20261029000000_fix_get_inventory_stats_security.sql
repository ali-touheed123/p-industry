-- Migration: 20261029000000_fix_get_inventory_stats_security.sql
-- Purpose: Remediate 3 Supabase Database Linter security warnings on public.get_inventory_stats(uuid):
--   1. function_search_path_mutable (0011): Fix mutable search_path by adding SET search_path = ''
--   2. anon_security_definer_function_executable (0028): Switch to SECURITY INVOKER & revoke from anon
--   3. authenticated_security_definer_function_executable (0029): Switch to SECURITY INVOKER & revoke from authenticated
--
-- Architecture Decision:
--   - Switched from SECURITY DEFINER to SECURITY INVOKER.
--   - In this project, all application calls route through Next.js server endpoints (src/app/api/items/route.ts)
--     which authenticate the tenant via requireTenantAuth() and invoke the function using supabaseAdmin (service_role).
--   - As SECURITY INVOKER, service_role retains full access to compute stats, while direct calls via PostgREST
--     cannot bypass RLS policies on public.items.
--   - Table references are schema-qualified (public.items) with SET search_path = ''.

CREATE OR REPLACE FUNCTION public.get_inventory_stats(p_tenant_id uuid)
RETURNS TABLE(
  total_skus integer,
  total_stock_units numeric,
  total_valuation numeric,
  low_stock_count integer
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    count(*)::int as total_skus,
    coalesce(sum(stock_qty), 0)::numeric as total_stock_units,
    coalesce(sum(GREATEST(0, stock_qty) * cost_price), 0)::numeric as total_valuation,
    count(*) filter (where stock_qty <= coalesce(min_stock_alert, 5))::int as low_stock_count
  FROM public.items
  WHERE tenant_id = p_tenant_id;
$$;

-- Only the server (service_role) may call this function
REVOKE EXECUTE ON FUNCTION public.get_inventory_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_inventory_stats(uuid) TO service_role;

