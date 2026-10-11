# PyntFlow — Tenant Lifecycle & Shop Provisioning Master Task Register

**Document Path:** `docs/tasks/PYNTFLOW_TENANT_LIFECYCLE_TASK_REGISTER.md`  
**Related Audit:** [`docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md`](file:///d:/bestow/p-industry/docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md)  
**Related Implementation Plan:** [`docs/plans/PYNTFLOW_TENANT_LIFECYCLE_IMPLEMENTATION_PLAN.md`](file:///d:/bestow/p-industry/docs/plans/PYNTFLOW_TENANT_LIFECYCLE_IMPLEMENTATION_PLAN.md)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Status:** `PHASES 1–3 IMPLEMENTED & OFFLINE VERIFIED — LIVE TEST PENDING AUTHORIZATION`  
**Execution Mode:** Application code & offline suites implemented; zero live DB mutations or network requests executed  
**Date:** October 12, 2026 (Revision 6 — Owner Decision on Task 3.2 & FK Migration Prepared)  

---

## 1. Master Task Overview & Execution Matrix

```
┌──────────┬────────────────────────────────────────────────────────────────────────┬──────────┬───────────────────────────────┐
│ Task ID  │ Task Title                                                             │ Priority │ Current Status                │
├──────────┼────────────────────────────────────────────────────────────────────────┼──────────┼───────────────────────────────┤
│ Task 1.1 │ Canonical Cashier Ingestion & Duplicate-Username Validation Fix        │ P0       │ COMPLETED (Phase 1)           │
│ Task 1.2 │ Excise Obsolete `ceo_tenants` Queries in `POST /api/tenants`           │ P0       │ COMPLETED (Phase 1)           │
│ Task 2.1 │ Modernize Dev Panel Account Assembly & Typescript Interfaces          │ P1       │ COMPLETED (Phase 1)           │
│ Task 3.1 │ Harden Provisioning Pre-Flight Checks, Password Hashing & Rollback     │ P2       │ COMPLETED (Phase 2)           │
│ Task 3.2 │ Prepare `app_users` FK Cascade Migration (`ON DELETE CASCADE`) │ P2       │ APPROVED — MIGRATION PREPARED │
│ Task 4.1 │ Safe End-to-End Tenant Provisioning & Deletion Regression Test Script  │ P1       │ COMPLETED (Phase 3 — Offline) │
└──────────┴────────────────────────────────────────────────────────────────────────┴──────────┴───────────────────────────────┘
```

---

## 2. Detailed Task Specifications

---

### Task 1.1: Canonical Cashier Ingestion & Duplicate-Username Validation Fix

* **Task ID**: `Task 1.1`
* **Title**: Canonical Cashier Ingestion & Duplicate-Username Validation Fix
* **Priority**: `P0 - Blocker`
* **Status**: `COMPLETED (Phase 1)` (Implemented and verified via automated test suite)
* **Problem & Supporting Evidence**:
  - *Problem*: Submitting a valid shop provisioning form with 1 CEO and 1 Cashier (`counter1`) fails with HTTP 400: `Duplicate usernames provided in request. Each user account must have a unique username.`
  - *Evidence*: [`src/app/api/tenants/route.ts#L158-L177`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L158-L177) unconditionally pushes both `staff_username` and all items in `body.counters`. In [`src/components/dev-panel/DevBranchModal.tsx#L147-L153`](file:///d:/bestow/p-industry/src/components/dev-panel/DevBranchModal.tsx#L147-L153), `staffUsername` is initialized to `counters[0].username`, causing `proposedUsernames` to have duplicate entries (`['ceo', 'counter1', 'counter1']`). `uniqueUsernames.length < proposedUsernames.length` evaluates to `true` (2 < 3) and aborts before database writes.
* **Exact Affected Files & Database Objects**:
  - File: [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts) (Lines 158–177, 252–288)
* **Proposed Changes**:
  1. **Strict Counter Validation**:
     - Iterate `body.counters`. If an entry has a missing/blank `username` or `password`, return HTTP 400 (`"All counter registers must have a valid username and password."`). Do **not** silently skip invalid accounts.
  2. **Canonical Account List Assembly**:
     - Add CEO account (if `ceo_username` provided).
     - If `body.counters` is non-empty, add each counter register.
     - Else fallback to legacy `staff_username` / `staff_password`.
  3. **Duplicate Detection**:
     - Normalize all usernames (`.trim().toLowerCase()`).
     - Compare `uniqueUsernames.length < proposedUsernames.length`. If true, return HTTP 400 with `"Duplicate usernames provided in request. Each user account must have a unique username."`.
  4. **Database Uniqueness Check**:
     - Check `app_users` for global collisions. If taken, return HTTP 400 with `"Username(s) already taken globally: <list>. Please choose different usernames."`.
  5. **Account Insertion**:
     - If `body.counters` is provided, iterate and insert all counters into `public.app_users`.
     - Else fallback to inserting single `staff_username`.
* **Dependencies**: None.
* **Risks & Compatibility Considerations**:
  - *Risk*: Must not suppress genuine collisions.
  - *Mitigation*: Collisions between CEO and cashier (e.g. `ceo` and `ceo`) or between counter registers (e.g. `c1` and `c1`) will remain duplicates in the canonical list and be properly rejected with HTTP 400.
  - *Compatibility*: Legacy callers submitting only `staff_username` without `counters` continue to function as single-cashier shops.
* **Test Cases & Verification Commands**:
  - *Test 1 (Dual Payload Pass)*: `{ ceo_username: 'ceo', staff_username: 'counter1', counters: [{ username: 'counter1', password: '123' }] }` &rarr; Expect HTTP 200.
  - *Test 2 (Internal CEO/Cashier Collision)*: `{ ceo_username: 'c1', staff_username: 'c1', counters: [{ username: 'c1', password: '123' }] }` &rarr; Expect HTTP 400 (`Duplicate usernames provided in request`).
  - *Test 3 (Multi-Counter Collision)*: `{ ceo_username: 'ceo', counters: [{ username: 'c1', password: '123' }, { username: 'c1', password: '123' }] }` &rarr; Expect HTTP 400 (`Duplicate usernames provided in request`).
  - *Test 4 (Blank Counter Password)*: `{ ceo_username: 'ceo', counters: [{ username: 'c1', password: '' }] }` &rarr; Expect HTTP 400 (`All counter registers must have a valid username and password`).
  - *Test 5 (Global Collision)*: `{ ceo_username: 'admin', counters: [{ username: 'c1', password: '123' }] }` &rarr; Expect HTTP 400 (`Username(s) already taken globally: admin`).
* **Objective Acceptance Criteria**:
  - `POST /api/tenants` successfully provisions shops where `staff_username` matches `counters[0].username`.
  - Genuine internal duplicates return HTTP 400.
  - Incomplete counters return HTTP 400 without silent skipping.
* **Rollback & Recovery Considerations**:
  - Git revert of edits in `src/app/api/tenants/route.ts`.
* **Required User Approval**: Standard application implementation authorization.
* **Completion Evidence Required**: Automated test assertions verifying all 5 test cases.

---

### Task 1.2: Excise Obsolete `ceo_tenants` Queries in `POST /api/tenants`

* **Task ID**: `Task 1.2`
* **Title**: Excise Obsolete `ceo_tenants` Queries in `POST /api/tenants`
* **Priority**: `P0 - Blocker`
* **Status**: `COMPLETED (Phase 1)` (Excised from route and rollback; zero remaining references)
* **Problem & Supporting Evidence**:
  - *Problem*: Provisioning a shop with a CEO account crashes at Step 2 because line 243 attempts an insert into `public.ceo_tenants`, a table that does not exist in PostgreSQL.
  - *Evidence*: PostgreSQL catalog query `SELECT table_name FROM information_schema.tables WHERE table_name = 'ceo_tenants'` returned `[]`. Lines 241–249 throw `42P01` relation does not exist, triggering catch-block rollback (line 342) and returning HTTP 500: `Failed to provision branch accounts: relation "ceo_tenants" does not exist. Tenant creation was rolled back.`
* **Exact Affected Files & Database Objects**:
  - File: [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts) (Lines 241–249, Line 342)
* **Proposed Changes**:
  1. Remove lines 241–249 (`supabaseAdmin.from('ceo_tenants').insert(...)`).
  2. Remove line 342 (`supabaseAdmin.from('ceo_tenants').delete().eq('tenant_id', tenant.id)`).
* **Dependencies**: Task 1.1.
* **Risks & Compatibility Considerations**:
  - *Risk*: Low. Verification confirmed `ceo_tenants` has 0 database existence and was already removed from [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts) in commit `e8fb92fe0f9ea859e66ef00e01f33adf7835c82a` (Task 3.1). Multi-branch CEO authorization is dynamically handled via `owner_name` and `email` matching in [`src/app/api/auth/login/route.ts#L120-L136`](file:///d:/bestow/p-industry/src/app/api/auth/login/route.ts#L120-L136) and [`src/lib/session.ts#L158-L183`](file:///d:/bestow/p-industry/src/lib/session.ts#L158-L183).
* **Test Cases & Verification Commands**:
  - Submit `POST /api/tenants` with CEO credentials.
  - Verify CEO row is created in `public.app_users` with `role = 'ceo'` and `tenant_id = tenant.id`.
  - Verify no PostgreSQL table exception is logged.
* **Objective Acceptance Criteria**:
  - CEO account insertion succeeds without throwing table-missing exceptions.
  - Zero queries are dispatched to non-existent table `ceo_tenants`.
* **Rollback & Recovery Considerations**:
  - Git revert of lines removed.
* **Required User Approval**: Standard application implementation authorization.
* **Completion Evidence Required**: Successful provisioning of a shop with a CEO user verified in `public.app_users`.

---

### Task 2.1: Modernize Dev Panel Account Assembly & TypeScript Interfaces

* **Task ID**: `Task 2.1`
* **Title**: Modernize Dev Panel Account Assembly & TypeScript Interfaces
* **Priority**: `P1 - High`
* **Status**: `COMPLETED (Phase 1)` (Typed in dev.ts, DevBranchModal updated, any-cast removed)
* **Problem & Supporting Evidence**:
  - *Problem*: `DevBranchModal.tsx` submits dual representation (`staffUsername` scalar + `counters` array), and `InitialAccountsData` in `src/types/dev.ts` does not officially type `counters`, forcing `(initialAccounts as any)?.counters` casting.
  - *Evidence*: [`src/types/dev.ts#L34-L39`](file:///d:/bestow/p-industry/src/types/dev.ts#L34-L39), [`DevBranchModal.tsx#L147-L153`](file:///d:/bestow/p-industry/src/components/dev-panel/DevBranchModal.tsx#L147-L153), [`AuraDevPanel.tsx#L143`](file:///d:/bestow/p-industry/src/components/dev-panel/AuraDevPanel.tsx#L143).
* **Exact Affected Files & Database Objects**:
  - [`src/types/dev.ts`](file:///d:/bestow/p-industry/src/types/dev.ts)
  - [`src/components/dev-panel/DevBranchModal.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/DevBranchModal.tsx)
  - [`src/components/dev-panel/AuraDevPanel.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/AuraDevPanel.tsx)
* **Proposed Changes**:
  1. Update `InitialAccountsData` in `src/types/dev.ts` to include typed `counters?: Array<{ username: string; password: string; name: string }>`.
  2. In `DevBranchModal.tsx`, treat `counters` as canonical. Stop passing redundant `staffUsername` / `staffPassword` when `counters` is present.
  3. In `AuraDevPanel.tsx`, remove `as any` type casting.
* **Dependencies**: Tasks 1.1 and 1.2.
* **Risks & Compatibility Considerations**:
  - Low frontend-only refactor. `POST /api/tenants` remains backward compatible with any callers that still submit `staff_username`.
* **Test Cases & Verification Commands**:
  - Run `npx tsc --noEmit`.
  - Open Dev Panel modal, add 2 cash counters, submit, and verify successful branch creation.
* **Objective Acceptance Criteria**:
  - Clean TypeScript compilation with 0 errors (`npx tsc --noEmit` exit code 0).
  - Dev Panel form cleanly provisions multi-counter branches.
* **Rollback & Recovery Considerations**:
  - Git revert of frontend component edits.
* **Required User Approval**: Standard application implementation authorization.
* **Completion Evidence Required**: `npx tsc --noEmit` exits with 0.

---

### Task 3.1: Harden Provisioning Pre-Flight Checks, Password Hashing & Rollback

* **Task ID**: `Task 3.1`
* **Title**: Harden Provisioning Pre-Flight Checks, Password Hashing & Rollback
* **Priority**: `P2 - Medium`
* **Status**: `COMPLETED (Phase 2)`
* **Problem & Supporting Evidence**:
  - *Problem*: In `POST /api/tenants`, password hashing occurred *after* tenant creation, rollback was broad (tenant-ID-scoped delete), and slug collisions were only caught after a failed insert attempt.
  - *Evidence*: Pre-Phase-2 source at [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts) (now remediated).
* **Exact Affected Files & Database Objects**:
  - [`src/app/api/tenants/route.ts`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts) — POST handler hardened.
  - [`scripts/test-provisioning-safety.mjs`](file:///d:/bestow/p-industry/scripts/test-provisioning-safety.mjs) — 9 new focused safety tests created.
* **Implemented Changes**:
  1. **Pre-flight Slug Check (Step 0b)**: `supabase.from('tenants').select('id').eq('slug', cleanSlug).maybeSingle()` before any DB write. Returns HTTP 400 on match.
  2. **Authoritative Constraint Retention**: PostgreSQL `23505` on tenant insert still caught and mapped to HTTP 400 (concurrency boundary preserved).
  3. **Upfront Password Hashing**: All `hashPassword()` calls moved to before `INSERT INTO tenants`. Hashing failure prevents any DB writes.
  4. **Explicit Record Tracking**: `createdTenantId: string | null` and `createdUserIds: string[]` populated only from successful DB responses; never pre-populated.
  5. **Scoped Independent Rollback (R1 + R2)**: R1 deletes exact `createdUserIds` via `.in('id', [...])`. R2 deletes tenant by exact `createdTenantId`. Each step is in its own `try/catch`; R1 failure does not prevent R2.
  6. **Privacy-safe Error Reporting**: Rollback logs include `tenantId`, `createdUserCount`, and `error.message` only. Passwords, hashes, PINs, tokens, and session secrets are never logged.
* **Dependencies**: Task 1.2 (COMPLETED).
* **Risks & Compatibility Considerations**:
  - Adds one lightweight pre-flight read query before insert. All existing session, CEO, cashier, and catalog-seeding behaviors preserved.
  - Application-level compensating cleanup is not equivalent to an atomic DB transaction. A process crash between tenant insert and user insert would leave an orphaned tenant. This is acknowledged and documented as a known limitation (true ACID requires a PostgreSQL stored procedure, which is out of scope for this phase).
* **Objective Acceptance Criteria — VERIFIED**:
  - ✅ Upfront password hashing: bcrypt failure prevents any DB writes (S-2, 9/9 pass).
  - ✅ Rollback purges created records by exact tracked IDs (S-4, S-5).
  - ✅ Slug collision returns HTTP 400 before any DB write (S-1).
  - ✅ R1 failure does not suppress R2 (S-6).
  - ✅ `23505` maps correctly; other errors propagate (S-7).
  - ✅ Error response never exposes secrets (S-8).
  - ✅ Phase 1 regression guard passes (S-9).
* **Completion Evidence**:
  - `npx tsc --noEmit` → **exit 0** (no type errors).
  - `node scripts/test-provisioning-safety.mjs` → **9/9 pass, exit 0**.
  - `node scripts/test-provisioning-contract.mjs` → **8/8 pass, exit 0** (Phase 1 regression).
  - `node scripts/test-t22-adapters.mjs` → **23/23 pass, exit 0** (unrelated regression guard).
* **Rollback & Recovery Considerations**:
  - `git revert` of changes to `src/app/api/tenants/route.ts` restores pre-Phase-2 behavior.
* **Required User Approval**: Standard application implementation authorization.
* **Completion Date**: 2026-10-12.

---

### Task 3.2: Prepare `app_users` FK Cascade Migration

* **Task ID**: `Task 3.2`
* **Title**: Prepare `app_users` FK Cascade Migration (`ON DELETE CASCADE`)
* **Priority**: `P2 - Medium`
* **Status**: `APPROVED — MIGRATION PREPARED & STATICALLY REVIEWED (EXECUTION PENDING SEPARATE AUTHORIZATION)`
* **Owner Decision Recorded (October 12, 2026)**:
  - **Decision**: Approved `ON DELETE CASCADE` for `public.app_users(tenant_id)` (permanently purges tenant-owned users on shop deletion; supersedes previous discussion of retaining `SET NULL`).
  - **Behavior**: When a tenant is deleted, all `app_users` records owned by that tenant (including CEO, cashier, and godown staff accounts) must be permanently deleted.
  - **Developer Account Isolation**: Global developer accounts with `tenant_id IS NULL` remain completely unaffected (NULL in child columns is structurally immune to foreign-key cascades).
* **Problem & Supporting Evidence**:
  - *Problem*: Constraint `app_users_tenant_id_fkey` historically had `ON DELETE SET NULL`. If a tenant was deleted directly in PostgreSQL, its accounts were orphaned with `tenant_id = null`, permanently occupying their global usernames due to `app_users_username_key`.
  - *Prior Production Catalog Audit Evidence*: Direct catalog queries on production database `ignspvajzblmsbertmmv` (documented in [`docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md#L315`](file:///d:/bestow/p-industry/docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md#L315)) confirmed `app_users_tenant_id_fkey` with `delete_rule = 'SET NULL'` and 1 global developer account `admin` with `tenant_id = null`.
  - *Current Offline Review Evidence*: Verified via static codebase inspection and tracked migrations; zero live database connections or queries were executed during this review session. Tracked migration [`supabase/migrations/20260924_03_performance_indexes.sql#L44`](file:///d:/bestow/p-industry/supabase/migrations/20260924_03_performance_indexes.sql#L44) declares `CREATE INDEX IF NOT EXISTS idx_app_users_tenant_id ON public.app_users(tenant_id);`.
* **Workflow Decoupling & Architectural Distinction**:
  - *Database FK Cascade Layer*: Specifically dictates what occurs when a row in `public.tenants` is deleted. Rows with `tenant_id IS NULL` are structurally ignored by the cascade.
  - *Complete Application Deletion Workflow*: `DELETE /api/tenants` runs application-side operations (e.g. deleting associated data via `supabaseAdmin`). Global developer account survival across the entire deletion lifecycle requires BOTH the database FK immunity AND strict application-level query scoping (`eq('tenant_id', id)`). Neither layer alone replaces the other.
* **Exact Affected Files & Database Objects**:
  - PostgreSQL Table: `public.app_users`
  - Constraint: `app_users_tenant_id_fkey` (single-column FK on `tenant_id` referencing `public.tenants(id)`)
  - Prepared Migration File: [`supabase/migrations/20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261012_01_app_users_fk_cascade.sql)
  - Companion Rollback Script: [`scripts/rollback_20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/scripts/rollback_20261012_01_app_users_fk_cascade.sql)
* **Application-Side Interaction & Redundancy Review**:
  - In [`src/app/api/tenants/route.ts#L502`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L502), `DELETE /api/tenants` explicitly calls:
    `await supabaseAdmin.from('app_users').delete().eq('tenant_id', id);`
    prior to deleting the tenant row at line 513.
  - *Conflict Check*: Zero conflict. If the application deletes the users first, the database cascade encounters zero child rows when deleting the tenant and succeeds normally.
  - *Redundancy & Defense-in-Depth*: Retaining application-side deletion ensures explicit API cleanup and auditability, while schema-level `ON DELETE CASCADE` guarantees that direct SQL deletions, dashboard deletions, or partial route executions can never leave orphaned accounts behind.
* **Mandatory Read-Only Preflight Inspection (Section A of Migration Artifact)**:
  1. *Check Existing FKs on `app_users(tenant_id)`*: Inspect `pg_constraint` to confirm constraint name, owning/referenced schemas, child and parent columns, key cardinality, delete action, and validation status.
  2. *Check Composite FKs on `tenant_id`*: Detect multi-column foreign keys involving `tenant_id`.
  3. *Check Unexpected References*: Detect FKs on `tenant_id` referencing an unexpected relation or column other than `public.tenants(id)`.
  4. *Check Orphaned `tenant_id` Values*: Query `app_users` where `tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenants WHERE id = tenant_id)`. If rows exist, STOP; `ADD CONSTRAINT` will fail with error 23503. Do not auto-delete data.
  5. *Check Index Coverage & Definition*: Inspect `pg_index` for `idx_app_users_tenant_id` (confirming `indisvalid`, `indisready`, non-partial, and leading column `tenant_id`).
  6. *Check Triggers*: Query `pg_trigger` on `app_users` and `tenants` (custom triggers flag behavior for review; absence does not prove full application safety).
  7. *Record Baseline Developer Accounts*: Inspect `app_users` where `tenant_id IS NULL` (operator must securely record count and IDs before proceeding).
* **Migration SQL (Section B of Migration Artifact)**:
  ```sql
  BEGIN;

  DO $$
  DECLARE
      v_dropped_count integer := 0;
      r RECORD;
      r_canon RECORD;
  BEGIN
      -- Guard 1: Detect orphaned non-NULL tenant_id values before altering constraints
      IF EXISTS (
          SELECT 1 FROM public.app_users u
          WHERE u.tenant_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = u.tenant_id)
      ) THEN
          RAISE EXCEPTION 'Pre-migration check failed: Orphaned records with non-NULL tenant_id exist in public.app_users. ADD CONSTRAINT would fail with 23503. Aborting.';
      END IF;

      -- Guard 2: Abort if ANY composite foreign key on public.app_users involves tenant_id
      IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace tn ON t.relnamespace = tn.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
          WHERE tn.nspname = 'public' AND t.relname = 'app_users' AND c.contype = 'f'
            AND a.attname = 'tenant_id' AND array_length(c.conkey, 1) > 1
      ) THEN
          RAISE EXCEPTION 'Pre-migration check failed: Unexpected composite foreign key involving public.app_users.tenant_id detected. Aborting.';
      END IF;

      -- Guard 3: Abort if public.app_users.tenant_id has an FK referencing a table other than public.tenants
      IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace tn ON t.relnamespace = tn.oid
          JOIN pg_class ft ON c.confrelid = ft.oid
          JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
          WHERE tn.nspname = 'public' AND t.relname = 'app_users' AND c.contype = 'f'
            AND a.attname = 'tenant_id' AND (ftn.nspname != 'public' OR ft.relname != 'tenants')
      ) THEN
          RAISE EXCEPTION 'Pre-migration check failed: Foreign key on public.app_users.tenant_id references unexpected table. Aborting.';
      END IF;

      -- Guard 4: Abort if any FK from public.app_users(tenant_id) references a column other than tenants.id
      IF EXISTS (
          SELECT 1 FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace tn ON t.relnamespace = tn.oid
          JOIN pg_class ft ON c.confrelid = ft.oid
          JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
          JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = c.confkey[1]
          WHERE tn.nspname = 'public' AND t.relname = 'app_users' AND c.contype = 'f'
            AND ftn.nspname = 'public' AND ft.relname = 'tenants'
            AND a.attname = 'tenant_id' AND fa.attname != 'id'
      ) THEN
          RAISE EXCEPTION 'Pre-migration check failed: Foreign key on public.app_users.tenant_id references column other than tenants.id. Aborting.';
      END IF;

      -- Guard 5: Independently inspect canonical name 'app_users_tenant_id_fkey' without inner joins that hide unexpected definitions
      SELECT c.contype, c.confrelid, c.conkey, c.confkey
      INTO r_canon
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      JOIN pg_namespace tn ON t.relnamespace = tn.oid
      WHERE tn.nspname = 'public' AND t.relname = 'app_users' AND c.conname = 'app_users_tenant_id_fkey';

      IF FOUND THEN
          IF r_canon.contype != 'f'
             OR r_canon.confrelid != 'public.tenants'::regclass
             OR array_length(r_canon.conkey, 1) != 1
             OR array_length(r_canon.confkey, 1) != 1
             OR (SELECT attname FROM pg_attribute WHERE attrelid = 'public.app_users'::regclass AND attnum = r_canon.conkey[1]) != 'tenant_id'
             OR (SELECT attname FROM pg_attribute WHERE attrelid = r_canon.confrelid AND attnum = r_canon.confkey[1]) != 'id'
          THEN
              RAISE EXCEPTION 'Pre-migration check failed: Canonical name app_users_tenant_id_fkey exists on public.app_users with unexpected definition. Aborting.';
          END IF;
      END IF;

      -- Drop only verified single-column FKs specifically from public.app_users(tenant_id) -> public.tenants(id)
      FOR r IN (
          SELECT c.conname, c.confdeltype FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          JOIN pg_namespace tn ON t.relnamespace = tn.oid
          JOIN pg_class ft ON c.confrelid = ft.oid
          JOIN pg_namespace ftn ON ft.relnamespace = ftn.oid
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.conkey[1]
          JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = c.confkey[1]
          WHERE tn.nspname = 'public' AND t.relname = 'app_users' AND c.contype = 'f'
            AND ftn.nspname = 'public' AND ft.relname = 'tenants'
            AND a.attname = 'tenant_id' AND fa.attname = 'id'
            AND array_length(c.conkey, 1) = 1 AND array_length(c.confkey, 1) = 1
      ) LOOP
          v_dropped_count := v_dropped_count + 1;
          EXECUTE format('ALTER TABLE public.app_users DROP CONSTRAINT %I', r.conname);
      END LOOP;

      IF v_dropped_count = 0 THEN
          RAISE NOTICE 'No existing FK matched. Proceeding to create canonical constraint.';
      ELSIF v_dropped_count > 1 THEN
          RAISE NOTICE 'Consolidated % matching duplicate FK constraints on public.app_users(tenant_id).', v_dropped_count;
      END IF;
  END $$;

  ALTER TABLE public.app_users ADD CONSTRAINT app_users_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

  -- 3. Verify or create supporting index on public.app_users(tenant_id)
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

  COMMIT;
  ```
* **Post-Migration Independent Verification Assertions (Section C of Migration Artifact)**:
  1. *Assertion 1 (Canonical CASCADE FK Verified)*:
     ```sql
     SELECT
         CASE WHEN count(*) = 1 THEN 'ASSERTION 1 PASSED: Canonical CASCADE FK verified'
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
         WHERE ns_child.nspname = 'public' AND rel_child.relname = 'app_users' AND att_child.attname = 'tenant_id'
           AND ns_parent.nspname = 'public' AND rel_parent.relname = 'tenants' AND att_parent.attname = 'id'
           AND con.contype = 'f' AND con.conname = 'app_users_tenant_id_fkey' AND con.confdeltype = 'c'
           AND con.convalidated = true AND array_length(con.conkey, 1) = 1 AND array_length(con.confkey, 1) = 1
     ) matches;
     ```
  2. *Assertion 2 (Zero Composite FKs on tenant_id)*:
     ```sql
     SELECT
         CASE WHEN count(*) = 0 THEN 'ASSERTION 2 PASSED: Zero composite FKs on tenant_id'
              ELSE 'ASSERTION 2 FAILED: Unexpected composite FK detected on tenant_id'
         END AS assertion_result
     FROM (
         SELECT con.conname
         FROM pg_constraint con
         JOIN pg_class rel_child ON rel_child.oid = con.conrelid
         JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
         JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
         WHERE ns_child.nspname = 'public' AND rel_child.relname = 'app_users' AND att_child.attname = 'tenant_id'
           AND con.contype = 'f' AND array_length(con.conkey, 1) > 1
     ) composites;
     ```
  3. *Assertion 3 (Exactly 1 FK Exists on tenant_id)*:
     ```sql
     SELECT
         CASE WHEN count(*) = 1 THEN 'ASSERTION 3 PASSED: Exactly 1 FK exists on tenant_id'
              ELSE 'ASSERTION 3 FAILED: Unexpected number of FKs on tenant_id (count != 1)'
         END AS assertion_result
     FROM (
         SELECT con.conname
         FROM pg_constraint con
         JOIN pg_class rel_child ON rel_child.oid = con.conrelid
         JOIN pg_namespace ns_child ON ns_child.oid = rel_child.relnamespace
         JOIN pg_attribute att_child ON att_child.attrelid = con.conrelid AND att_child.attnum = ANY(con.conkey)
         WHERE ns_child.nspname = 'public' AND rel_child.relname = 'app_users' AND att_child.attname = 'tenant_id'
           AND con.contype = 'f'
     ) fks;
     ```
  4. *Assertion 4 (Supporting Index Definition Verified)*:
     ```sql
     SELECT
         CASE WHEN count(*) = 1 THEN 'ASSERTION 4 PASSED: Index idx_app_users_tenant_id is valid, non-unique, non-partial B-tree on tenant_id'
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
         WHERE n.nspname = 'public' AND c.relname = 'idx_app_users_tenant_id'
           AND tn.nspname = 'public' AND t.relname = 'app_users'
           AND i.indisvalid = true AND i.indisready = true AND i.indisunique = false
           AND i.indpred IS NULL AND i.indexprs IS NULL
           AND i.indnatts = 1 AND a.attname = 'tenant_id' AND am.amname = 'btree'
     ) idx_check;
     ```
  5. *Assertion 5 (Developer Accounts Current State & Comparison Instructions)*:
     ```sql
     SELECT count(*) AS current_developer_account_count FROM public.app_users WHERE tenant_id IS NULL;
     SELECT id, username, role, tenant_id, created_at FROM public.app_users WHERE tenant_id IS NULL ORDER BY created_at ASC;
     ```
     *Operator Guidance*: SQL cannot prove immutability without an established pre-migration baseline. Compare current count and records against the Section A preflight baseline.
* **Dependencies**: Tasks 1.1, 1.2, 2.1, 3.1.
* **Risks & Performance Considerations**:
  - **Per-operation lock modes (PostgreSQL Documentation, §13.3.1)** (all held until transaction end):
    - `ALTER TABLE ... DROP CONSTRAINT` (Section B, Step 1): `ACCESS EXCLUSIVE` on `public.app_users` — conflicts with all lock modes; blocks all concurrent reads and writes.
    - `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` (Section B, Step 2): `SHARE ROW EXCLUSIVE` on both `public.app_users` (referencing/child) and `public.tenants` (referenced/parent). Blocks concurrent writes (INSERT/UPDATE/DELETE); permits concurrent reads. Ref: pg docs §13.3.1 — "Acquired by `CREATE TRIGGER` and some forms of `ALTER TABLE`."
    - `CREATE INDEX` (non-concurrent, Section B, Step 3, conditional): `SHARE` on `public.app_users` only if the index does not exist. Permits concurrent reads; blocks concurrent writes during build.
    - **Peak lock for the complete transaction**: `ACCESS EXCLUSIVE` on `public.app_users`, acquired by `DROP CONSTRAINT` (Operation 1) — stronger than the `SHARE ROW EXCLUSIVE` from `ADD CONSTRAINT` (Operation 2).
  - Actual lock hold time and operational impact cannot be promised with arbitrary timing claims (e.g. "< 50ms"); duration depends on active transaction backlog, table sizes, concurrent workloads, and database hardware.
  - Execution requires a completed read-only preflight inspection and an authorized low-traffic maintenance window.
  - Unexpected composite foreign keys or conflicting constraint definitions will trigger safe transaction abortion (`RAISE EXCEPTION`).
* **Rollback & Recovery Considerations**:
  - Revert migration via companion script [`scripts/rollback_20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/scripts/rollback_20261012_01_app_users_fk_cascade.sql) or Section D:
    ```sql
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
        ALTER TABLE public.app_users DROP CONSTRAINT app_users_tenant_id_fkey;
    END $$;

    -- Recreate canonical foreign key with ON DELETE SET NULL
    ALTER TABLE public.app_users
      ADD CONSTRAINT app_users_tenant_id_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.tenants(id)
      ON DELETE SET NULL;

    -- In-Transaction Rollback Verification Assertions
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
          AND con.confdeltype = 'n'
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
    END $$;

    COMMIT;
    ```
  - **Irreversibility Limitation**: Restoring `ON DELETE SET NULL` only alters future deletions. It cannot resurrect or recover any `app_users` rows that were already hard-deleted during cascade operations. Recovery of cascaded rows requires point-in-time backup restoration.
* **Required User Approval**: Migration prepared and statically reviewed; actual execution against database requires separate explicit authorization.
* **Completion Evidence Required**: Verified migration SQL artifact in repository; preflight and catalog assertion confirmation upon authorized execution.

---

### Task 4.1: Safe End-to-End Tenant Provisioning & Deletion Regression Test Script

* **Task ID**: `Task 4.1`
* **Title**: Safe End-to-End Tenant Provisioning & Deletion Regression Test Script
* **Priority**: `P1 - High`
* **Status**: `COMPLETED (Phase 3 — Offline Verified)` (Implemented guarded script & verified with 21 offline unit tests in `scripts/test-lifecycle-offline.mjs` [18 base tests L-1 to L-18 + 3 untrack remediation tests L-14a, L-14b, L-14c; 61 combined offline tests across full repository suite]; live execution requires separate explicit authorization)
* **Problem & Supporting Evidence**:
  - *Problem*: No automated tests currently verify that a shop can be created, duplicate usernames are rejected, a shop can be deleted, and its usernames can be immediately reused.
  - *Evidence*: `scripts/` inspection confirms 0 test coverage for tenant provisioning.
* **Exact Affected Files & Database Objects**:
  - New Script: `scripts/verify-tenant-lifecycle.mjs`
* **Implemented Changes & Safety Specifications**:
  1. **Environment Gate**:
     - Check `PYNTFLOW_BASE_URL` against approved local origins (`http://localhost:*`, `http://127.0.0.1:*`).
     - Require `ALLOW_TENANT_LIFECYCLE_TEST=true`.
     - Require `DEV_ADMIN_TOKEN` (developer role JWT; never logged).
     - Fail closed before any network request if requirements are unmet.
     - Note: Local HTTP URL does not guarantee local database isolation; backend database target must be separately verified before live execution.
  2. **Dynamic Unique Identifiers**:
     - `slug = test-lc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
     - `ceo_username = ceo-${Date.now()}-${rand}`
     - `cashier_username = pos-${Date.now()}-${rand}`
     - Passwords generated as 20-character random hex; never logged or reused.
     - Never use static strings like `hamza`, `ceo`, or `counter1`.
  3. **Tracking of All Created Resources**:
     - Track confirmed IDs: `cleanup.trackedTenantIds = []` via guarded `cleanup.track(id)`.
     - When Tenant 1 is created &rarr; record `tenant1.id`.
     - When Tenant 1 is deleted via API in Step 4 &rarr; remove via guarded `cleanup.untrack(tenant1Id)`.
     - When Tenant 2 is created during username reuse &rarr; record `tenant2.id` via `cleanup.track(tenant2Id)`.
     - When Tenant 2 is deleted via API in Step 6 &rarr; remove via guarded `cleanup.untrack(tenant2Id)`.
     - Untrack operation is strictly guarded against `-1` index so absent/untracked IDs can never remove the final tracked ID.
  4. **Scoped Cleanup in `finally` Block**:
     - Cleanup is strictly scoped to exact IDs: `DELETE /api/tenants?id=<id>`. Never use wildcards or broad pattern deletes.
     - Wrapped in a `finally` block to execute even if assertions fail.
     - Registers `process.once('SIGINT')` and `process.once('SIGTERM')` listeners for best-effort cleanup.
     - Honest limitation: `finally` cannot protect against `SIGKILL`, machine crash, or power loss.
  5. **Recovery Procedure Documentation**:
     - Primary recovery utilizes exact verified UUIDs:
       ```sql
       -- Exact-ID cleanup SQL (safe when exact IDs are known):
       DELETE FROM public.app_users WHERE tenant_id IN ('<id1>', '<id2>');
       DELETE FROM public.tenants WHERE id IN ('<id1>', '<id2>');
       ```
     - If the script was forcefully terminated and IDs were not recorded in memory, the operator may run a **read-only discovery query** restricted to the script's prefix format:
       ```sql
       -- Read-only candidate discovery (does NOT mutate data):
       SELECT id, slug, name, created_at FROM public.tenants WHERE slug LIKE 'test-lc-%';
       SELECT id, username, role, tenant_id FROM public.app_users WHERE tenant_id IN (
         SELECT id FROM public.tenants WHERE slug LIKE 'test-lc-%'
       );
       ```
     - **Mandatory Safety Rule**: Wildcard or pattern-based `DELETE` statements (e.g. `WHERE slug LIKE ...`) must **NEVER** be executed. The operator must inspect discovery results, verify that candidate rows belong solely to the test run, and delete strictly by exact verified UUIDs (`WHERE id IN (...)`).
  6. **Seven Mandatory Test Assertions**:
     - *Assertion 1*: Genuine duplicate usernames within one request (CEO == Counter) are rejected with HTTP 400 (`Duplicate usernames provided in request`).
     - *Assertion 2*: A valid CEO + Counter request is accepted with HTTP 200, and Tenant 1 ID is recorded.
     - *Assertion 3*: An existing global username is rejected with HTTP 400 (`Username(s) already taken globally: <username>`).
     - *Assertion 4*: Tenant 1 is deleted via `DELETE /api/tenants?id=<id>` with HTTP 200.
     - *Assertion 5*: The exact same usernames are immediately reused to create Tenant 2 with HTTP 200.
     - *Assertion 6*: Tenant 2 is deleted via `DELETE /api/tenants?id=<id>` with HTTP 200.
     - *Assertion 7 (API-level check & limitation)*: `GET /api/tenants?slug=<slug>` returns 404 for both deleted slugs. Note: HTTP 404 confirms API route-level non-retrieval, but does not constitute authoritative proof of database-level absence for either `public.tenants` or `public.app_users`. Authoritative database-level absence requires separate out-of-band read-only SQL queries:
       ```sql
       -- Separate read-only database verification (requires authorized DB connection):
       SELECT count(*) AS remaining_tenants FROM public.tenants WHERE id IN ('<id1>', '<id2>');
       SELECT count(*) AS remaining_users FROM public.app_users WHERE tenant_id IN ('<id1>', '<id2>');
       ```
  7. **Lifecycle Test vs. Database FK Cascade Boundary Clarification**:
     - The lifecycle test verifies the complete application-level deletion workflow (`DELETE /api/tenants`).
     - Because `DELETE /api/tenants` in `src/app/api/tenants/route.ts#L502` explicitly deletes user accounts first (`supabaseAdmin.from('app_users').delete().eq('tenant_id', id)`), the lifecycle test does **NOT** independently exercise or prove schema-level `ON DELETE CASCADE` behavior in isolation.
     - Independent verification of the database-level FK cascade requires a separate, direct database test (e.g. deleting a tenant record directly in PostgreSQL while associated child accounts exist, without deleting users first, and verifying that the database engine purges child rows).
* **Dependencies**: Tasks 1.1, 1.2, 2.1, 3.1.
* **Risks & Compatibility Considerations**:
  - Live HTTP API and database operations. Risk mitigated by dynamic test prefixes, permission checks, and guaranteed `finally` cleanup.
* **Test Cases & Verification Commands**:
  - Offline unit suite: `node scripts/test-lifecycle-offline.mjs` (21 tests passing, including untrack safety).
  - Live execution command (requires separate explicit authorization): `node scripts/verify-tenant-lifecycle.mjs`.
* **Objective Acceptance Criteria**:
  - Script passes all 7 assertions and exits with code 0.
  - API-level non-retrieval confirmed via HTTP 404 for deleted tenant slugs; database-level absence for both `public.tenants` and `public.app_users` requires separate read-only SQL verification.
  - Test scope explicitly bounded to application-level deletion workflow without claiming independent proof of database-level FK cascade.
* **Rollback & Recovery Considerations**:
  - Script contains autonomous `finally` cleanup block and exact-ID manual recovery SQL.
* **Required User Approval**: Separate explicit authorization required for live execution.
* **Completion Evidence Required**:
  - Offline suite: Clean output of `node scripts/test-lifecycle-offline.mjs` with exit code 0 (21/21 PASS).
  - Live suite: Clean console output of `node scripts/verify-tenant-lifecycle.mjs` with exit code 0 (PENDING AUTHORIZATION).

---

## 3. Register Maintenance & Status Sign-Off

- **Registered By**: Senior Software Architect & Supabase Auditor
- **Date**: October 12, 2026 (Revision 6 — Single-Pass Final Forensic Closure)
- **Status**: Phases 1–3 implemented and offline-verified (61/61 tests passing across test suites). Task 3.2 migration SQL artifact prepared and statically reviewed with complete preflight queries, catalog guards, 5 post-migration assertions, and companion rollback script. Live execution of Task 4.1 and Task 3.2 database migration remain pending separate explicit authorization. Zero live database mutations or network requests executed during this turn.
