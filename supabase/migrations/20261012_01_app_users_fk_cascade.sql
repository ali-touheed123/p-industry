-- ============================================================================
-- Migration: 20261012_01_app_users_fk_cascade.sql
-- Project: PyntFlow Paint Industry POS & Industrial ERP
-- Phase: Tenant Lifecycle — Task 3.2 (Database Foreign Key Cascade)
-- Status: PREPARED & STATICALLY REVIEWED — PENDING SEPARATE EXECUTION AUTHORIZATION
-- Date: October 12, 2026 (Revision 6 — Static Review Corrections & In-Transaction Verification)
-- ============================================================================
-- 
-- DESCRIPTION:
-- Alters the foreign key constraint on `public.app_users(tenant_id)` referencing
-- `public.tenants(id)` from `ON DELETE SET NULL` to `ON DELETE CASCADE`.
--
-- BUSINESS & ARCHITECTURAL RATIONALE:
-- 1. Prevents orphaned user records: When a shop/tenant is deleted (via API, SQL, or dashboard),
--    all associated staff, cashier, and CEO accounts owned by that tenant are permanently deleted.
-- 2. Unblocks username reuse: Because `app_users.username` has a global UNIQUE constraint,
--    orphaned records with `tenant_id = null` previously blocked reusing the same usernames.
-- 3. Protects global developer accounts: Accounts with `tenant_id IS NULL` (e.g. system developers)
--    are structurally immune to foreign-key cascades because NULL is never matched by parent keys.
--
-- WORKFLOW DECOUPLING & ARCHITECTURAL DISTINCTION:
-- - Database FK Cascade Behavior: Specifically and exclusively dictates what occurs when a row
--   in `public.tenants` is deleted. Rows with `tenant_id IS NULL` are structurally ignored by the cascade.
-- - Complete Application Deletion Workflow: `DELETE /api/tenants` runs application-side operations
--   (e.g. deleting associated data via supabaseAdmin). Global developer account survival across the entire
--   deletion lifecycle requires BOTH the database FK immunity AND strict application-level query scoping
--   (`eq('tenant_id', id)`). Neither layer alone replaces the other.
--
-- PERFORMANCE & LOCKING CONSIDERATIONS (PostgreSQL Documentation, §13.3.1):
-- This migration transaction performs three DDL operations with distinct lock modes.
-- All locks are held until the end of the transaction (per PostgreSQL explicit-locking §13.3.1).
--
-- Operation 1 — ALTER TABLE ... DROP CONSTRAINT (Section B, Step 1):
--   Acquires ACCESS EXCLUSIVE on public.app_users (child table).
--   ACCESS EXCLUSIVE conflicts with all lock modes, blocking all concurrent reads and writes.
--   Ref: PostgreSQL docs §13.3.1 — "Many forms of ALTER TABLE also acquire a lock at this level."
--
-- Operation 2 — ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY (Section B, Step 2):
--   Acquires SHARE ROW EXCLUSIVE on public.app_users (referencing/child table).
--   Acquires SHARE ROW EXCLUSIVE on public.tenants (referenced/parent table).
--   SHARE ROW EXCLUSIVE blocks concurrent INSERT, UPDATE, DELETE (ROW EXCLUSIVE),
--   SHARE UPDATE EXCLUSIVE, SHARE, SHARE ROW EXCLUSIVE, EXCLUSIVE, and ACCESS EXCLUSIVE,
--   while permitting concurrent reads (ACCESS SHARE). Both tables are locked simultaneously.
--   Ref: PostgreSQL docs §13.3.1 — "Acquired by CREATE TRIGGER and some forms of ALTER TABLE."
--
-- Operation 3 — CREATE INDEX (non-concurrent) (Section B, Step 3, conditional):
--   Acquires SHARE on public.app_users only if the index does not already exist.
--   SHARE allows concurrent reads but blocks concurrent writes during index build.
--   Ref: PostgreSQL docs §13.3.1 — "Acquired by CREATE INDEX (without CONCURRENTLY)."
--
-- Peak (Strongest) Lock in the Complete Transaction:
--   ACCESS EXCLUSIVE on public.app_users — acquired by DROP CONSTRAINT (Operation 1).
--   This is stronger than the SHARE ROW EXCLUSIVE from ADD CONSTRAINT (Operation 2).
--   ACCESS EXCLUSIVE blocks ALL concurrent access including reads. Plan and execute
--   this migration only during an authorized low-traffic maintenance window.
--
-- No arbitrary timing guarantees (e.g. "< 50ms") can be assumed. Lock hold time depends on
-- active transaction backlog, row count, concurrent workloads, and database hardware capacity.
-- Execution MUST be scheduled during an authorized low-traffic maintenance window.
--
-- SCHEMA STATE SAFETY POLICIES & STARTING STATE BEHAVIORS:
-- 1. State: Composite FK on `tenant_id` exists:
--    -> Aborts with RAISE EXCEPTION. Never modifies or drops composite constraints.
-- 2. State: Single-column FK on `tenant_id` references a table other than `public.tenants`:
--    -> Aborts with RAISE EXCEPTION.
-- 3. State: Single-column FK on `tenant_id` references a column other than `public.tenants(id)`:
--    -> Aborts with RAISE EXCEPTION.
-- 4. State: Canonical constraint name `app_users_tenant_id_fkey` is bound to unexpected definition:
--    -> Aborts with RAISE EXCEPTION.
-- 5. State: Orphaned records with non-NULL `tenant_id` exist in `public.app_users`:
--    -> Aborts with RAISE EXCEPTION (prevents 23503 error on ADD CONSTRAINT).
-- 6. State: Supporting index `idx_app_users_tenant_id` exists with incompatible definition
--    (unique, partial, expression, non-btree, or indexing wrong column):
--    -> Aborts with RAISE EXCEPTION.
-- 7. State: Valid intended single-column FK exists on `tenant_id -> tenants(id)` under any name:
--    -> Drops existing constraint, replaces with canonical name and CASCADE action.
-- 8. State: Multiple duplicate single-column FKs exist on `tenant_id -> tenants(id)`:
--    -> Consolidates duplicates by dropping matches and creating canonical constraint.
-- 9. State: No FK on `tenant_id` exists (fresh database):
--    -> Logs NOTICE, proceeds to add canonical constraint.
--
-- SAFETY & EXECUTION BOUNDARIES:
-- - DO NOT EXECUTE WITHOUT EXPLICIT SEPARATE AUTHORIZATION.
-- - Preflight queries must be executed in read-only mode first.
-- ============================================================================


-- ============================================================================
-- SECTION A: MANDATORY READ-ONLY PREFLIGHT INSPECTION
-- (Execute in read-only mode prior to running transaction block.
--  Explicitly confirmed NOT executed during offline codebase preparation.)
-- ============================================================================

-- A1. Check all existing foreign keys involving public.app_users.tenant_id
SELECT
    con.conname AS constraint_name,
    ns_child.nspname AS table_schema,
    rel_child.relname AS table_name,
    att_child.attname AS column_name,
    ns_parent.nspname AS foreign_table_schema,
    rel_parent.relname AS foreign_table_name,
    att_parent.attname AS foreign_column_name,
    array_length(con.conkey, 1) AS child_key_column_count,
    array_length(con.confkey, 1) AS parent_key_column_count,
    CASE con.confdeltype
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'a' THEN 'NO ACTION'
        ELSE con.confdeltype::text
    END AS delete_action,
    con.convalidated AS is_validated
FROM pg_constraint con
JOIN pg_class rel_child ON rel_child.oid = con.conrelid
JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
JOIN pg_class rel_parent ON rel_parent.oid = con.confrelid
JOIN pg_namespace ns_parent ON ns_parent.oid = rel_parent.relnamespace
JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
JOIN pg_attribute att_parent ON att_parent.attrelid = con.confrelid AND att_parent.attnum = ANY(con.confkey)
WHERE ns_child.nspname = 'public'
  AND rel_child.relname = 'app_users'
  AND att_child.attname = 'tenant_id'
  AND con.contype = 'f';

-- A2. Detect any composite foreign keys involving public.app_users.tenant_id
SELECT
    con.conname AS composite_constraint_name,
    rel_child.relname AS table_name,
    array_length(con.conkey, 1) AS key_column_count,
    con.confdeltype AS delete_action
FROM pg_constraint con
JOIN pg_class rel_child ON rel_child.oid = con.conrelid
JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
WHERE ns_child.nspname = 'public'
  AND rel_child.relname = 'app_users'
  AND att_child.attname = 'tenant_id'
  AND con.contype = 'f'
  AND array_length(con.conkey, 1) > 1;

-- A3. Detect any FK on tenant_id referencing an unexpected relation or column
SELECT
    con.conname AS unexpected_constraint_name,
    ns_parent.nspname AS referenced_schema,
    rel_parent.relname AS referenced_table,
    att_parent.attname AS referenced_column
FROM pg_constraint con
JOIN pg_class rel_child ON rel_child.oid = con.conrelid
JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
JOIN pg_class rel_parent ON rel_parent.oid = con.confrelid
JOIN pg_namespace ns_parent ON ns_parent.oid = rel_parent.relnamespace
JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
JOIN pg_attribute att_parent ON att_parent.attrelid = con.confrelid AND att_parent.attnum = ANY(con.confkey)
WHERE ns_child.nspname = 'public'
  AND rel_child.relname = 'app_users'
  AND att_child.attname = 'tenant_id'
  AND con.contype = 'f'
  AND (ns_parent.nspname != 'public' OR rel_parent.relname != 'tenants' OR att_parent.attname != 'id');

-- A4. Detect orphaned non-NULL tenant_id values in public.app_users
SELECT
    u.id,
    u.username,
    u.role,
    u.tenant_id
FROM public.app_users u
WHERE u.tenant_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id
  );

-- A5. Check definition, access method, uniqueness, validity, readiness, and leading key of idx_app_users_tenant_id
SELECT
    c.relname AS index_name,
    am.amname AS access_method,
    i.indisunique AS is_unique,
    i.indisvalid AS is_valid,
    i.indisready AS is_ready,
    (i.indpred IS NOT NULL) AS is_partial,
    (i.indexprs IS NOT NULL) AS is_expression,
    i.indnatts AS column_count,
    a.attname AS leading_column_name,
    pg_get_indexdef(c.oid) AS index_definition
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_index i ON c.oid = i.indexrelid
JOIN pg_class t ON i.indrelid = t.oid
JOIN pg_namespace tn ON t.relnamespace = tn.oid
LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
JOIN pg_am am ON c.relam = am.oid
WHERE n.nspname = 'public'
  AND c.relname = 'idx_app_users_tenant_id'
  AND tn.nspname = 'public'
  AND t.relname = 'app_users';

-- A6. Check user-defined triggers on public.app_users and public.tenants
-- Note: Trigger presence flags behavior for review; absence does not prove full application safety.
SELECT
    tg.tgname AS trigger_name,
    rel.relname AS table_name,
    p.proname AS function_name,
    CASE tg.tgenabled
        WHEN 'O' THEN 'ENABLED (origin)'
        WHEN 'D' THEN 'DISABLED'
        WHEN 'A' THEN 'ALWAYS'
        WHEN 'R' THEN 'REPLICA'
        ELSE tg.tgenabled::text
    END AS enabled_state,
    CASE tg.tgtype & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END AS timing,
    CASE tg.tgtype & 8 WHEN 8 THEN 'DELETE' ELSE 'OTHER' END AS event
FROM pg_trigger tg
JOIN pg_class rel ON rel.oid = tg.tgrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
JOIN pg_proc p ON p.oid = tg.tgfoid
WHERE ns.nspname = 'public'
  AND rel.relname IN ('app_users', 'tenants')
  AND NOT tg.tgisinternal;

-- A7. Record baseline state of global developer accounts (tenant_id IS NULL)
-- Operator MUST record count and IDs before executing migration.
SELECT count(*) AS preflight_developer_account_count
FROM public.app_users
WHERE tenant_id IS NULL;

SELECT id, username, role, tenant_id, created_at
FROM public.app_users
WHERE tenant_id IS NULL
ORDER BY created_at ASC;


-- ============================================================================
-- SECTION B: ATOMIC FORWARD MIGRATION (Run inside atomic transaction)
-- ============================================================================

BEGIN;

-- 1. Safely discover, guard, and drop foreign key constraint(s) on public.app_users(tenant_id)
DO $$
DECLARE
    v_dropped_count integer := 0;
    r RECORD;
    r_canon RECORD;
BEGIN
    -- Guard 1: Detect orphaned non-NULL tenant_id values before altering constraints
    IF EXISTS (
        SELECT 1
        FROM public.app_users u
        WHERE u.tenant_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id
          )
    ) THEN
        RAISE EXCEPTION 'Pre-migration check failed: Orphaned records with non-NULL tenant_id exist in public.app_users. ADD CONSTRAINT would fail with 23503. Aborting.';
    END IF;

    -- Guard 2: Abort if ANY composite foreign key on public.app_users involves tenant_id
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
        RAISE EXCEPTION 'Pre-migration check failed: Unexpected composite foreign key involving public.app_users.tenant_id detected. Aborting.';
    END IF;

    -- Guard 3: Abort if public.app_users.tenant_id has a foreign key referencing a table OTHER than public.tenants
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace tn ON t.relnamespace = tn.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        WHERE tn.nspname = 'public'
          AND t.relname = 'app_users'
          AND c.contype = 'f'
          AND a.attname = 'tenant_id'
          AND (ftn.nspname != 'public' OR ft.relname != 'tenants')
    ) THEN
        RAISE EXCEPTION 'Pre-migration check failed: Foreign key on public.app_users.tenant_id references unexpected table. Aborting.';
    END IF;

    -- Guard 4: Abort if any FK from public.app_users(tenant_id) to public.tenants references a column OTHER than id
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace tn ON t.relnamespace = tn.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = c.confkey[1]
        WHERE tn.nspname = 'public'
          AND t.relname = 'app_users'
          AND c.contype = 'f'
          AND ftn.nspname = 'public'
          AND ft.relname = 'tenants'
          AND a.attname = 'tenant_id'
          AND fa.attname != 'id'
    ) THEN
        RAISE EXCEPTION 'Pre-migration check failed: Foreign key on public.app_users.tenant_id references column other than tenants.id. Aborting.';
    END IF;

    -- Guard 5: Independently inspect canonical name 'app_users_tenant_id_fkey' without inner joins that could hide unexpected constraint types
    SELECT c.contype, c.confrelid, c.conkey, c.confkey
    INTO r_canon
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    WHERE tn.nspname = 'public'
      AND t.relname = 'app_users'
      AND c.conname = 'app_users_tenant_id_fkey';

    IF FOUND THEN
        IF r_canon.contype != 'f'
           OR r_canon.confrelid != 'public.tenants'::regclass
           OR array_length(r_canon.conkey, 1) != 1
           OR array_length(r_canon.confkey, 1) != 1
           OR (SELECT attname FROM pg_attribute WHERE attrelid = 'public.app_users'::regclass AND attnum = r_canon.conkey[1]) IS DISTINCT FROM 'tenant_id'
           OR (SELECT attname FROM pg_attribute WHERE attrelid = r_canon.confrelid AND attnum = r_canon.confkey[1]) IS DISTINCT FROM 'id'
        THEN
            RAISE EXCEPTION 'Pre-migration check failed: Canonical name app_users_tenant_id_fkey exists on public.app_users with unexpected definition (contype=%, confrelid=%). Aborting.',
                r_canon.contype, r_canon.confrelid;
        END IF;
    END IF;

    -- Drop only verified single-column FKs specifically from public.app_users(tenant_id) to public.tenants(id)
    FOR r IN (
        SELECT c.conname, c.confdeltype
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace tn ON t.relnamespace = tn.oid
        JOIN pg_class ft ON c.confrelid = ft.oid
        JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
        JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = c.confkey[1]
        WHERE tn.nspname = 'public'
          AND t.relname = 'app_users'
          AND c.contype = 'f'
          AND ftn.nspname = 'public'
          AND ft.relname = 'tenants'
          AND a.attname = 'tenant_id'
          AND fa.attname = 'id'
          AND array_length(c.conkey, 1) = 1
          AND array_length(c.confkey, 1) = 1
    ) LOOP
        v_dropped_count := v_dropped_count + 1;
        RAISE NOTICE 'Dropping verified FK constraint % on public.app_users(tenant_id) -> public.tenants(id) (previous rule: %)',
            r.conname, r.confdeltype;
        EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', r.conname);
    END LOOP;

    IF v_dropped_count = 0 THEN
        RAISE NOTICE 'No existing FK constraint matched on public.app_users(tenant_id) -> public.tenants(id). Proceeding to create canonical constraint.';
    ELSIF v_dropped_count > 1 THEN
        RAISE NOTICE 'Consolidated % matching duplicate FK constraints on public.app_users(tenant_id).', v_dropped_count;
    END IF;
END $$;

-- 2. Add canonical foreign key constraint with ON DELETE CASCADE
-- (Acquires SHARE ROW EXCLUSIVE on both public.app_users and public.tenants; held until transaction end)
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id)
  ON DELETE CASCADE;

-- 3. Verify or create supporting index on public.app_users(tenant_id)
-- Fails closed if index exists with incompatible definition (unique, partial, expression, non-btree, or wrong column).
DO $$
DECLARE
    v_idx RECORD;
    v_attname text;
BEGIN
    SELECT 
        i.indisvalid,
        i.indisready,
        i.indisunique,
        (i.indpred IS NOT NULL) AS is_partial,
        (i.indexprs IS NOT NULL) AS is_expression,
        i.indnatts,
        i.indkey[0] AS attnum,
        am.amname
    INTO v_idx
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_index i ON c.oid = i.indexrelid
    JOIN pg_class t ON i.indrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    JOIN pg_am am ON c.relam = am.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_app_users_tenant_id'
      AND tn.nspname = 'public'
      AND t.relname = 'app_users';

    IF FOUND THEN
        SELECT a.attname INTO v_attname
        FROM pg_attribute a
        WHERE a.attrelid = 'public.app_users'::regclass
          AND a.attnum = v_idx.attnum;

        IF NOT v_idx.indisvalid 
           OR NOT v_idx.indisready 
           OR v_idx.indisunique 
           OR v_idx.is_partial 
           OR v_idx.is_expression
           OR v_idx.indnatts != 1 
           OR (v_attname IS DISTINCT FROM 'tenant_id')
           OR v_idx.amname != 'btree' THEN
            RAISE EXCEPTION 'Migration check failed: Index idx_app_users_tenant_id exists with incompatible definition (valid=%, ready=%, unique=%, partial=%, expr=%, natts=%, column=%, am=%). Aborting.',
                v_idx.indisvalid, v_idx.indisready, v_idx.indisunique, v_idx.is_partial, v_idx.is_expression, v_idx.indnatts, v_attname, v_idx.amname;
        ELSE
            RAISE NOTICE 'Index idx_app_users_tenant_id already exists with expected definition (ordinary, non-unique B-tree on public.app_users(tenant_id)).';
        END IF;
    ELSE
        RAISE NOTICE 'Index idx_app_users_tenant_id does not exist. Creating ordinary B-tree index on public.app_users(tenant_id)...';
        CREATE INDEX idx_app_users_tenant_id ON public.app_users USING btree (tenant_id);
    END IF;
END $$;

-- 4. Fail-Fast Transactional Verification Assertions
-- (Executes inside the transaction block; automatically rolls back if any critical assertion fails)
DO $$
DECLARE
    v_canon_count integer;
    v_composite_count integer;
    v_total_fk_count integer;
    v_idx_valid boolean;
BEGIN
    -- Transactional Check 1: Exactly 1 canonical FK with ON DELETE CASCADE and valid catalog state
    SELECT count(*)
    INTO v_canon_count
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
      AND con.confdeltype = 'c'
      AND con.convalidated = true
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1;

    IF v_canon_count != 1 THEN
        RAISE EXCEPTION 'In-transaction verification failed: Canonical CASCADE FK is missing or misconfigured. Rolling back.';
    END IF;

    -- Transactional Check 2: Zero composite FKs on public.app_users.tenant_id
    SELECT count(*)
    INTO v_composite_count
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND con.contype = 'f'
      AND array_length(con.conkey, 1) > 1;

    IF v_composite_count != 0 THEN
        RAISE EXCEPTION 'In-transaction verification failed: Composite FK on tenant_id detected. Rolling back.';
    END IF;

    -- Transactional Check 3: Exactly 1 total FK on public.app_users.tenant_id
    SELECT count(*)
    INTO v_total_fk_count
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND con.contype = 'f';

    IF v_total_fk_count != 1 THEN
        RAISE EXCEPTION 'In-transaction verification failed: Expected exactly 1 FK on tenant_id, found %. Rolling back.', v_total_fk_count;
    END IF;

    -- Transactional Check 4: Supporting index is valid, ready, non-unique, non-partial, non-expression B-tree covering tenant_id
    SELECT (
        i.indisvalid
        AND i.indisready
        AND NOT i.indisunique
        AND i.indpred IS NULL
        AND i.indexprs IS NULL
        AND i.indnatts = 1
        AND a.attname = 'tenant_id'
        AND am.amname = 'btree'
    )
    INTO v_idx_valid
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_index i ON c.oid = i.indexrelid
    JOIN pg_class t ON i.indrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
    JOIN pg_am am ON c.relam = am.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_app_users_tenant_id'
      AND tn.nspname = 'public'
      AND t.relname = 'app_users';

    IF v_idx_valid IS NOT TRUE THEN
        RAISE EXCEPTION 'In-transaction verification failed: Index idx_app_users_tenant_id is missing or fails criteria (must be valid, ready, non-unique, non-partial B-tree on tenant_id). Rolling back.';
    END IF;

    RAISE NOTICE 'In-transaction verification passed: Canonical CASCADE FK, zero composite FKs, single FK uniqueness, and supporting B-tree index verified.';
END $$;

COMMIT;


-- ============================================================================
-- SECTION C: POST-MIGRATION INDEPENDENT VERIFICATION ASSERTIONS
-- (Execute in read-only mode after running transaction block for reporting)
-- ============================================================================

-- Assertion 1: Exact canonical FK exists with single-column tenant_id -> tenants.id and ON DELETE CASCADE
SELECT
    CASE 
        WHEN count(*) = 1 THEN 'ASSERTION 1 PASSED: Canonical CASCADE FK verified'
        ELSE 'ASSERTION 1 FAILED: Canonical CASCADE FK missing, duplicated, or misconfigured'
    END AS assertion_result
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
      AND con.confdeltype = 'c'
      AND con.convalidated = true
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
) matches;

-- Assertion 2: Zero composite foreign keys involving public.app_users.tenant_id exist
SELECT
    CASE 
        WHEN count(*) = 0 THEN 'ASSERTION 2 PASSED: Zero composite FKs on tenant_id'
        ELSE 'ASSERTION 2 FAILED: Unexpected composite FK detected on tenant_id'
    END AS assertion_result
FROM (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND con.contype = 'f'
      AND array_length(con.conkey, 1) > 1
) composites;

-- Assertion 3: Exactly one total foreign key exists on public.app_users.tenant_id
SELECT
    CASE 
        WHEN count(*) = 1 THEN 'ASSERTION 3 PASSED: Exactly 1 FK exists on tenant_id'
        ELSE 'ASSERTION 3 FAILED: Unexpected number of FKs on tenant_id (count != 1)'
    END AS assertion_result
FROM (
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel_child ON rel_child.oid = con.conrelid
    JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
    JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
    WHERE ns_child.nspname = 'public'
      AND rel_child.relname = 'app_users'
      AND att_child.attname = 'tenant_id'
      AND con.contype = 'f'
) fks;

-- Assertion 4: Supporting index idx_app_users_tenant_id is valid, non-unique, non-partial B-tree covering tenant_id
SELECT
    CASE 
        WHEN count(*) = 1 THEN 'ASSERTION 4 PASSED: Index idx_app_users_tenant_id is valid, non-unique, non-partial B-tree on tenant_id'
        ELSE 'ASSERTION 4 FAILED: Index missing, invalid, unique, partial, expression, non-btree, or does not cover tenant_id'
    END AS assertion_result
FROM (
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_index i ON c.oid = i.indexrelid
    JOIN pg_class t ON i.indrelid = t.oid
    JOIN pg_namespace tn ON t.relnamespace = tn.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
    JOIN pg_am am ON c.relam = am.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'idx_app_users_tenant_id'
      AND tn.nspname = 'public'
      AND t.relname = 'app_users'
      AND i.indisvalid = true
      AND i.indisready = true
      AND i.indisunique = false
      AND i.indpred IS NULL
      AND i.indexprs IS NULL
      AND i.indnatts = 1
      AND a.attname = 'tenant_id'
      AND am.amname = 'btree'
) idx_check;

-- Assertion 5: Global developer account current-state inspection
-- ATTENTION OPERATOR: SQL query execution cannot independently verify historical immutability
-- without comparing against the baseline recorded in Section A (Step A7). Compare current count
-- and IDs against the pre-migration baseline. If records differ, investigate before signoff.
SELECT 
    count(*) AS current_developer_account_count
FROM public.app_users
WHERE tenant_id IS NULL;

SELECT id, username, role, tenant_id, created_at
FROM public.app_users
WHERE tenant_id IS NULL
ORDER BY created_at ASC;


-- ============================================================================
-- SECTION D: ROLLBACK SCRIPT & ARCHITECTURAL LIMITATION WARNING
-- (Companion script available at scripts/rollback_20261012_01_app_users_fk_cascade.sql)
-- ============================================================================
-- CRITICAL RECOVERY LIMITATION:
-- Rolling back to ON DELETE SET NULL only changes FUTURE deletion behavior.
-- It CANNOT restore or resurrect any app_users rows that were already deleted by
-- CASCADE while ON DELETE CASCADE was active. Recovery of cascaded rows requires
-- point-in-time recovery (PITR) or restoration from pre-deletion database backup.
--
-- TARGET: Restores public.app_users(tenant_id) -> public.tenants(id) ON DELETE SET NULL
-- MODE: Guarded, Single-Use DDL Transaction (Not idempotent: enforces prior CASCADE state)
-- ============================================================================
/*
BEGIN;

DO $$
DECLARE
    r_canon RECORD;
    v_fk_count integer;
BEGIN
    -- Guard 0: Abort if orphaned non-NULL tenant_id rows exist in public.app_users
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

    -- Guard 1: Check for unexpected composite foreign keys on tenant_id
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
       OR r_canon.confdeltype != 'c' -- Must currently be CASCADE
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

-- 5. Recreate canonical foreign key with ON DELETE SET NULL
-- (Acquires SHARE ROW EXCLUSIVE on both public.app_users and public.tenants; held until transaction end)
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_tenant_id_fkey
  FOREIGN KEY (tenant_id)
  REFERENCES public.tenants(id)
  ON DELETE SET NULL;

-- 6. In-Transaction Rollback Verification Assertions
DO $$
DECLARE
    v_rb_canon_count integer;
    v_rb_total_fk_count integer;
BEGIN
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

-- Post-rollback independent reporting:
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
*/
