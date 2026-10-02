-- Migration: Secure RLS on held_invoices table
-- Fixes DB-03 and DB-04 (Eliminates public wildcard exposure on held_invoices)

-- 1. Drop the insecure public wildcard policy
DROP POLICY IF EXISTS "Allow public all on held_invoices" ON public.held_invoices;

-- 2. Create authenticated, tenant-isolated policy
-- Ensures anonymous clients using the public anon key cannot read, modify, or delete held carts
CREATE POLICY "Tenant isolation for held_invoices" 
  ON public.held_invoices
  FOR ALL 
  TO authenticated
  USING (
    tenant_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'
  )
  WITH CHECK (
    tenant_id = (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id')::uuid
    OR (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'service_role'
  );
