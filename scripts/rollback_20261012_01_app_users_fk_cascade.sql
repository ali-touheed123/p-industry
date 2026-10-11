-- ============================================================================
-- Companion Rollback Script: rollback_20261012_01_app_users_fk_cascade.sql
-- Project: PyntFlow Paint Industry POS & Industrial ERP
-- Phase: Tenant Lifecycle — Task 3.2 Rollback
-- Target: Restores public.app_users(tenant_id) -> public.tenants(id) ON DELETE SET NULL
-- Mode: Guarded, Single-Use DDL Transaction (Not idempotent — enforces prior CASCADE state)
-- ============================================================================
-- CRITICAL ARCHITECTURAL RECOVERY LIMITATION:
-- Rolling back to ON DELETE SET NULL only alters FUTURE deletion behavior.
-- It CANNOT restore or resurrect any app_users rows that were already permanently
-- deleted by CASCADE while ON DELETE CASCADE was active. Recovery of cascaded rows
-- requires point-in-time recovery (PITR) or database restoration from backup.
--
-- LOCKING CONSIDERATIONS (PostgreSQL Documentation, §13.3.1):
-- This rollback transaction performs two DDL operations with distinct lock modes.
-- All locks are held until the end of the transaction (per PostgreSQL explicit-locking §13.3.1).
--
-- Operation 1 — ALTER TABLE ... DROP CONSTRAINT (DO block, Guard 4):
--   Acquires ACCESS EXCLUSIVE on public.app_users (child table).
--   ACCESS EXCLUSIVE conflicts with all lock modes, blocking all concurrent reads and writes.
--   Ref: PostgreSQL docs §13.3.1 — "Many forms of ALTER TABLE also acquire a lock at this level."
--
-- Operation 2 — ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... SET NULL:
--   Acquires SHARE ROW EXCLUSIVE on public.app_users (referencing/child table).
--   Acquires SHARE ROW EXCLUSIVE on public.tenants (referenced/parent table).
--   SHARE ROW EXCLUSIVE blocks concurrent INSERT, UPDATE, DELETE (ROW EXCLUSIVE),
--   SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE,
--   while permitting concurrent reads (ACCESS SHARE). Both tables are locked simultaneously.
--   Ref: PostgreSQL docs §13.3.1 — "Acquired by CREATE TRIGGER and some forms of ALTER TABLE."
--
-- Peak (Strongest) Lock in the Complete Transaction:
--   ACCESS EXCLUSIVE on public.app_users — acquired by DROP CONSTRAINT (Operation 1).
--   This is stronger than the SHARE ROW EXCLUSIVE from ADD CONSTRAINT (Operation 2).
--   ACCESS EXCLUSIVE blocks ALL concurrent access including reads. Execute only during
--   an authorized low-traffic maintenance window.
-- ============================================================================

BEGIN;

DO $$
DECLARE
    r_canon RECORD;
    v_fk_count integer;
BEGIN
    -- Guard 0: Abort if orphaned non-NULL tenant_id rows exist in public.app_users
    -- (Recreating the FK would fail with error 23503 if orphans exist)
    IF EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.tenant_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id
          )
    ) THEN
        RAISE EXCEPTION 'Rollback check failed: Orphaned records with non-NULL tenant_id exist in public.app_users. Recreating FK would fail with 23503. Aborting.';
    END IF;

    -- Guard 1: Abort if unexpected composite foreign key on tenant_id exists
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace tn ON t.relnamespace = tn.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE tn.nspname = 'public'
          AND t.relname = 'app_users'
          AND c.contype = 'f'
          AND a.attname = 'tenant_id'
          AND array_length(c.conkey, 1) > 1
    ) THEN
        RAISE EXCEPTION 'Rollback check failed: Unexpected composite foreign key on tenant_id detected. Aborting.';
    END IF;

    -- Guard 2: Verify exactly one FK exists on tenant_id
    SELECT count(*)
    INTO v_fk_count
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE tn.nspname = 'public'
      AND t.relname = 'app_users'
      AND c.contype = 'f'
      AND a.attname = 'tenant_id';

    IF v_fk_count != 1 THEN
        RAISE EXCEPTION 'Rollback check failed: Expected exactly 1 FK on tenant_id, found %. Aborting.', v_fk_count;
    END IF;

    -- Guard 3: Independently inspect canonical constraint definition
    -- Validates constraint type, referenced relation, child column (tenant_id),
    -- referenced column (id), cardinality, and that current delete rule is CASCADE.
    SELECT c.conname, c.contype, c.confrelid, c.confdeltype, c.conkey, c.confkey
    INTO r_canon
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    WHERE tn.nspname = 'public'
      AND t.relname = 'app_users'
      AND c.conname = 'app_users_tenant_id_fkey';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Rollback check failed: Constraint app_users_tenant_id_fkey not found on public.app_users. Aborting.';
    END IF;

    IF r_canon.contype != 'f'
       OR r_canon.confrelid != 'public.tenants'::regclass
       OR r_canon.confdeltype != 'c' -- Must currently be CASCADE before rollback
       OR array_length(r_canon.conkey, 1) != 1
       OR array_length(r_canon.confkey, 1) != 1
       OR (SELECT attname FROM pg_attribute WHERE attrelid = 'public.app_users'::regclass AND attnum = r_canon.conkey[1]) IS DISTINCT FROM 'tenant_id'
       OR (SELECT attname FROM pg_attribute WHERE attrelid = r_canon.confrelid AND attnum = r_canon.confkey[1]) IS DISTINCT FROM 'id'
    THEN
        RAISE EXCEPTION 'Rollback check failed: Constraint app_users_tenant_id_fkey exists but is not the expected single-column CASCADE FK on app_users(tenant_id) -> tenants(id). Aborting.';
    END IF;

    -- Guard 4: Drop verified canonical CASCADE constraint
    RAISE NOTICE 'Dropping verified CASCADE constraint app_users_tenant_id_fkey...';
    ALTER TABLE public.app_users DROP CONSTRAINT app_users_tenant_id_fkey;
END $$;

-- Recreate canonical foreign key with ON DELETE SET NULL
-- (Acquires SHARE ROW EXCLUSIVE on both public.app_users and public.tenants; held until transaction end)
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id)
  ON DELETE SET NULL;

-- In-Transaction Rollback Verification Assertions
-- (Executes inside the transaction; any failure rolls back the entire rollback operation)
DO $$
DECLARE
    v_rb_canon_count integer;
    v_rb_total_fk_count integer;
BEGIN
    -- Check 1: Canonical SET NULL FK present and fully validated
    SELECT count(*)
    INTO v_rb_canon_count
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_class rel_parent ON rel_parent.oid = con.confrelid
    JOIN pg_namespace ns_parent ON ns_parent.oid = rel_parent.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = con.conkey[1]
    JOIN pg_attribute att_parent ON att_parent.attrelid = con.confrelid AND att_parent.attnum = con.confkey[1]
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND ns_parent.nspname = 'public'
      AND rel_parent.relname = 'tenants'
      AND att_parent.attname = 'id'
      AND con.contype = 'f'
      AND con.conname = 'app_users_tenant_id_fkey'
      AND con.confdeltype = 'n' -- 'n' = SET NULL
      AND con.convalidated = true
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1;

    IF v_rb_canon_count != 1 THEN
        RAISE EXCEPTION 'In-transaction rollback verification failed: Canonical SET NULL FK missing or misconfigured. Rolling back.';
    END IF;

    -- Check 2: Exactly 1 FK on tenant_id (no duplicates or residuals)
    SELECT count(*)
    INTO v_rb_total_fk_count
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND con.contype = 'f';

    IF v_rb_total_fk_count != 1 THEN
        RAISE EXCEPTION 'In-transaction rollback verification failed: Expected exactly 1 FK on tenant_id, found %. Rolling back.', v_rb_total_fk_count;
    END IF;

    RAISE NOTICE 'In-transaction rollback verification passed: Canonical SET NULL FK restored and verified.';
END $$;

COMMIT;

-- Post-rollback independent verification (read-only, for operator reporting):
SELECT
    CASE 
        WHEN count(*) = 1 THEN 'ROLLBACK VERIFICATION PASSED: Canonical SET NULL FK restored'
        ELSE 'ROLLBACK VERIFICATION FAILED: Canonical SET NULL FK missing or misconfigured'
    END AS rollback_result
FROM (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_class rel_parent ON rel_parent.oid = con.confrelid
    JOIN pg_namespace ns_parent ON ns_parent.oid = rel_parent.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = con.conkey[1]
    JOIN pg_attribute att_parent ON att_parent.attrelid = con.confrelid AND att_parent.attnum = con.confkey[1]
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND ns_parent.nspname = 'public'
      AND rel_parent.relname = 'tenants'
      AND att_parent.attname = 'id'
      AND con.contype = 'f'
      AND con.conname = 'app_users_tenant_id_fkey'
      AND con.confdeltype = 'n' -- 'n' = SET NULL
      AND con.convalidated = true
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
) rb_match;
