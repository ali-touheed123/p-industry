# PyntFlow — Tenant Lifecycle & Shop Provisioning Implementation Plan

**Document Path:** `docs/plans/PYNTFLOW_TENANT_LIFECYCLE_IMPLEMENTATION_PLAN.md`  
**Related Audit:** [`docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md`](file:///d:/bestow/p-industry/docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md)  
**Related Task Register:** [`docs/tasks/PYNTFLOW_TENANT_LIFECYCLE_TASK_REGISTER.md`](file:///d:/bestow/p-industry/docs/tasks/PYNTFLOW_TENANT_LIFECYCLE_TASK_REGISTER.md)  
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)  
**Status:** `APPLICATION PHASES IMPLEMENTED & TASK 3.2 MIGRATION PREPARED — LIVE TEST & DDL EXECUTION PENDING AUTHORIZATION`  
**Execution Mode:** Application code & offline suites implemented; migration SQL prepared; zero live DB mutations or network requests executed  
**Date:** October 12, 2026 (Revision 8 — Preflight Hardening, Assertion Matrix & Workflow Decoupling)  

---

## 1. Project Context & Problem Statement

During manual testing of the PyntFlow Developer Panel (`/dev`), an administrator deleted an existing shop and subsequently attempted to provision a new shop with the same or similar credentials (CEO: `ceo`, Cashier: `counter1`, Slug: `hamza`). Provisioning failed immediately with the error:

```
Duplicate usernames provided in request. Each user account must have a unique username.
```

The user hypothesized that the shop-deletion workflow had left behind orphaned records or unpurged usernames, causing a database conflict upon reuse.

A comprehensive forensic audit was conducted in [`docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md`](file:///d:/bestow/p-industry/docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md). The audit established that the deletion was not at fault and the database contained zero orphan records. Instead, the failure is caused by an **in-memory request pre-flight contract mismatch**:
1. The Dev Panel modal submits the primary cashier username twice: once as a legacy scalar `staffUsername` and once inside the `counters` array.
2. Step 0 of `POST /api/tenants` pushes both representations into an array and compares `Set(usernames).size < array.length`, unconditionally rejecting the valid request with HTTP 400.
3. Furthermore, Step 2 of `POST /api/tenants` references a non-existent PostgreSQL table `public.ceo_tenants`, which would cause any request that bypassed Step 0 to crash and roll back.

This implementation plan defines the complete, phased engineering remediation to resolve these blockers, establish a canonical account contract, harden provisioning and deletion safety, and specify a safe regression test suite.

---

## 2. Evidence & Verification Boundaries

All technical findings are classified according to strict evidentiary boundaries:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VERIFICATION TAXONOMY                           │
├────────────────────────────────────────────────────────────────────────┤
│ [SRC-CONFIRMED] : Verified by static source-code AST & git history.    │
│ [DB-CONFIRMED]  : Verified by live PostgreSQL catalog / SELECT queries. │
│ [RUN-OBSERVED]  : Observed at runtime via user screenshot & logs.      │
│ [PROPOSED]      : Architectural design proposed; not yet implemented.  │
│ [UNVERIFIED]    : Hypothesized or unverified pending authorized run.   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Technical Findings Summary

1. **[SRC-CONFIRMED] Pre-Flight Duplicate Username False Positive**:
   - Location: [`src/app/api/tenants/route.ts#L158-L177`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L158-L177).
   - Ingestion pushes `ceo_username` (line 160), `staff_username` (line 161), and all `body.counters[i].username` (lines 162–168) into `proposedUsernames`.
   - In [`src/components/dev-panel/DevBranchModal.tsx#L147-L153`](file:///d:/bestow/p-industry/src/components/dev-panel/DevBranchModal.tsx#L147-L153), `staffUsername` is explicitly set to `counters[0]?.username` (`"counter1"`), while `counters` also contains `counters[0]`.
   - Resulting array is `['ceo', 'counter1', 'counter1']`. Because `Set(['ceo', 'counter1']).size` (2) is less than `proposedUsernames.length` (3), lines 172–177 immediately return HTTP 400 with the exact error string.
2. **[DB-CONFIRMED] Ghost Table `ceo_tenants` Insertion**:
   - Location: [`src/app/api/tenants/route.ts#L241-L249`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L241-L249) and rollback line 342.
   - Query: `SELECT table_name FROM information_schema.tables WHERE table_name = 'ceo_tenants'`. Result: Empty (`[]`).
   - If Step 0 is bypassed, line 243 (`supabaseAdmin.from('ceo_tenants').insert(...)`) throws PostgreSQL exception `42P01` (`relation "ceo_tenants" does not exist`). Line 248 (`if (mapErr) throw mapErr`) throws into catch block, which executes rollback lines 341–347 and returns HTTP 500.
3. **[SRC-CONFIRMED] Active Sister-Branch Ownership Model**:
   - Locations: [`src/app/api/auth/login/route.ts#L120-L136`](file:///d:/bestow/p-industry/src/app/api/auth/login/route.ts#L120-L136) and [`src/lib/session.ts#L158-L183`](file:///d:/bestow/p-industry/src/lib/session.ts#L158-L183).
   - PyntFlow resolves sister branches dynamically by matching tenant `owner_name` and `email` across `tenants`. The table `ceo_tenants` was an abandoned prototype concept; phantom queries were already cleaned up from [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts) in commit `e8fb92fe0f9ea859e66ef00e01f33adf7835c82a` (Task 3.1).
4. **[DB-CONFIRMED] Production Database Cleanliness**:
   - Queries executed on live database `ignspvajzblmsbertmmv`:
     - `public.tenants`: 0 rows.
     - `public.app_users`: 1 row (`admin`, `role = 'developer'`, `tenant_id = null`).
     - `auth.users`: 0 rows (Supabase Auth identity engine is not used; custom `public.app_users` + `bcryptjs` + `jose` JWT cookies are used).
   - Confirms the prior shop deletion succeeded cleanly; zero residual accounts exist.
5. **[DB-CONFIRMED] Foreign-Key Cascade Reality**:
   - Catalog query on `information_schema.referential_constraints`:
     - **18 of 20 tables referencing `tenants(id)` already have `ON DELETE CASCADE`** (`invoices`, `purchases`, `items`, `clients`, `suppliers`, `vouchers`, `token_transactions`, etc.).
     - The only two non-cascading references are:
       1. `branch_orders.from_tenant_id` and `to_tenant_id`: `NO ACTION`.
       2. `app_users.tenant_id`: `SET NULL`.
6. **[SRC-CONFIRMED] Automated Test Gap**:
   - Inspection of all 19 scripts in `scripts/`: Zero automated test scripts exist for `POST /api/tenants`, `DELETE /api/tenants`, or username uniqueness checks.

---

## 3. Architecture & Remediation Design

### 3.1 Canonical Account List & Backward Compatibility Contract

#### A. Ingestion Strategy & Account Validation
To prevent false-positive duplicate detection while strictly preventing genuine collisions:

1. **Consistent Username Normalization**:
   - Every username must be consistently normalized via `.trim().toLowerCase()`.
   - Slugs must be normalized via `.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')`.
2. **Strict Counter Validation (No Silent Skipping)**:
   - Previously, lines 273–287 used `if (c.username && c.password)` which silently skipped malformed or incomplete counters, resulting in fewer cash registers created than configured in the form.
   - *Requirement*: The API must explicitly validate each entry in `body.counters`. If an entry has a blank username, missing password, or invalid structure, the request must be rejected with HTTP 400 (`"All counter registers must have a valid username and password."`).
   - Counter display names default to `${name.trim()} Counter ${index + 1}` if blank.
3. **Canonical Cashier Source**:
   - If `body.counters` is provided as an array with length > 0, it is treated as the **canonical source of cashier registers**.
   - If `body.counters` is missing or empty, the legacy scalar `staff_username` / `staff_password` is used as the single cashier account (backward compatibility for legacy scripts).
   - The legacy `staff_username` scalar is **never** added to the validation list if `body.counters` is already present.
4. **Canonical Assembly Specification**:
   ```typescript
   // Canonical account structure
   interface ProposedAccount {
     username: string;
     password?: string;
     role: 'ceo' | 'staff' | 'godown_staff';
     fullName: string;
     source: 'ceo' | 'counter' | 'legacy_staff';
   }

   const proposedAccounts: ProposedAccount[] = [];

   // 1. CEO Master Account (if provided)
   if (ceo_username?.trim()) {
     if (!ceo_password?.trim()) {
       return NextResponse.json({ success: false, error: 'CEO password is required when CEO username is provided' }, { status: 400 });
     }
     proposedAccounts.push({
       username: ceo_username.trim().toLowerCase(),
       password: ceo_password.trim(),
       role: 'ceo',
       fullName: owner_name?.trim() || `${name.trim()} Owner`,
       source: 'ceo',
     });
   }

   // 2. Canonical Cashier Registers
   if (Array.isArray(body.counters) && body.counters.length > 0) {
     for (let i = 0; i < body.counters.length; i++) {
       const c = body.counters[i];
       const u = c?.username?.trim();
       const p = c?.password?.trim();
       if (!u || !p) {
         return NextResponse.json({
           success: false,
           error: `Counter register #${i + 1} is missing a valid username or password.`
         }, { status: 400 });
       }
       proposedAccounts.push({
         username: u.toLowerCase(),
         password: p,
         role: type === 'godown' ? 'godown_staff' : 'staff',
         fullName: c.name?.trim() || `${name.trim()} Counter 0${i + 1}`,
         source: 'counter',
       });
     }
   } else if (staff_username?.trim()) {
     // Backward compatibility fallback for legacy API callers
     if (!staff_password?.trim()) {
       return NextResponse.json({ success: false, error: 'Staff password is required when staff username is provided' }, { status: 400 });
     }
     proposedAccounts.push({
       username: staff_username.trim().toLowerCase(),
       password: staff_password.trim(),
       role: type === 'godown' ? 'godown_staff' : 'staff',
       fullName: `${name.trim()} Counter 01`,
       source: 'legacy_staff',
     });
   }
   ```
5. **Internal Duplicate Detection**:
   ```typescript
   const proposedUsernames = proposedAccounts.map(a => a.username);
   const uniqueUsernames = Array.from(new Set(proposedUsernames));

   if (uniqueUsernames.length < proposedUsernames.length) {
     return NextResponse.json({
       success: false,
       error: 'Duplicate usernames provided in request. Each user account must have a unique username.'
     }, { status: 400 });
   }
   ```
6. **Pre-Flight Global Database Check**:
   ```typescript
   if (uniqueUsernames.length > 0) {
     const { data: existingUsers, error: checkErr } = await supabaseAdmin
       .from('app_users')
       .select('username')
       .in('username', uniqueUsernames);

     if (checkErr) throw checkErr;

     if (existingUsers && existingUsers.length > 0) {
       const takenList = existingUsers.map(u => u.username).join(', ');
       return NextResponse.json({
         success: false,
         error: `Username(s) already taken globally: ${takenList}. Please choose different usernames.`
       }, { status: 400 });
     }
   }
   ```
7. **Behavioral Matrix**:
   - `CEO: "ceo"`, `Counters: [{ username: "counter1" }]`, `staff_username: "counter1"` &rarr; `proposedUsernames = ['ceo', 'counter1']` &rarr; **ACCEPTED (Fixes Bug)**.
   - `CEO: "counter1"`, `Counters: [{ username: "counter1" }]` &rarr; `proposedUsernames = ['counter1', 'counter1']` &rarr; **REJECTED (400: Internal Duplicate)**.
   - `Counters: [{ username: "c1" }, { username: "c1" }]` &rarr; `proposedUsernames = ['c1', 'c1']` &rarr; **REJECTED (400: Multi-Register Duplicate)**.
   - `Counters: [{ username: "c1", password: "" }]` &rarr; **REJECTED (400: Missing Password, Not Silently Skipped)**.
   - Legacy caller with only `staff_username: "c1"` &rarr; `proposedUsernames = ['c1']` &rarr; **ACCEPTED (Backward Compatibility)**.
   - Submitting username already in DB (`admin`) &rarr; **REJECTED (400: Username(s) already taken globally: admin)**.

---

### 3.2 Removal of Obsolete `ceo_tenants` Operations

1. In `src/app/api/tenants/route.ts#L241-L249`:
   - Remove lines 241–249 (`supabaseAdmin.from('ceo_tenants').insert(...)`).
2. In `src/app/api/tenants/route.ts#L342`:
   - Remove line 342 (`supabaseAdmin.from('ceo_tenants').delete().eq('tenant_id', tenant.id)`).
3. **Comprehensive Architectural Verification**:
   - *Database*: `information_schema.tables` query confirmed `ceo_tenants` does not exist in PostgreSQL.
   - *Migrations*: Grep search across `supabase/migrations/` confirmed 0 migrations ever created `ceo_tenants`.
   - *Login & Session*: [`src/app/api/auth/login/route.ts#L120-L136`](file:///d:/bestow/p-industry/src/app/api/auth/login/route.ts#L120-L136) and [`src/lib/session.ts#L158-L183`](file:///d:/bestow/p-industry/src/lib/session.ts#L158-L183) dynamically query `tenants` matching `owner_name` and `email` to assemble the `session.ceoTenants` JWT claim.
   - *Precedent*: The identical dead queries were already removed from [`src/app/api/users/route.ts`](file:///d:/bestow/p-industry/src/app/api/users/route.ts) in commit `e8fb92fe0f9ea859e66ef00e01f33adf7835c82a` (Task 3.1).
   - *Conclusion*: Removing lines 241–249 and line 342 eliminates a fatal `42P01` runtime error without altering any active authorization contract.

---

### 3.3 Provisioning Rollback, Slug Uniqueness & Concurrency Handling

#### A. Pre-Flight vs. Authoritative Database Constraints
- **Pre-flight Slug Check**: Query `public.tenants` by `slug` before starting inserts. This provides an immediate, user-friendly 400 Bad Request before generating database side-effects.
- **Authoritative Database Constraint**: A pre-flight check does not guarantee safety against concurrent requests. If two requests for slug `hamza` execute simultaneously, both may pass pre-flight. The PostgreSQL unique constraint on `tenants.slug` remains the authoritative concurrency boundary. If an insert throws code `23505`, the route must catch it and return HTTP 400 (`"A shop or godown with this URL slug already exists!"`).

#### B. Upfront Password Hashing
- In Node.js memory, hash all account passwords via `await hashPassword(account.password)` **before** issuing `INSERT INTO tenants`.
- If hashing fails or bcrypt throws, no database rows are created.

#### C. Exact Account Record Tracking During Rollback
- Maintain explicit tracking arrays:
  ```typescript
  let createdTenantId: string | null = null;
  const createdUserIds: string[] = [];
  ```
- In the catch block:
  ```typescript
  try {
    if (createdUserIds.length > 0) {
      await supabaseAdmin.from('app_users').delete().in('id', createdUserIds);
    }
    if (createdTenantId) {
      // Also clean up by tenant_id to catch any child records
      await supabaseAdmin.from('app_users').delete().eq('tenant_id', createdTenantId);
      await supabaseAdmin.from('tenants').delete().eq('id', createdTenantId);
    }
  } catch (rollbackErr: any) {
    console.error('[CRITICAL] Provisioning rollback failed:', {
      tenantId: createdTenantId,
      userIds: createdUserIds,
      error: rollbackErr?.message,
    });
  }
  ```
- **Strict Privacy Rule**: Rollback diagnostics and error logs must **NEVER** log passwords, password hashes, PINs, tokens, or session secrets.

#### D. Honest Atomicity Boundaries
- Compensating application-level cleanup (`try...catch`) is **not** equivalent to a single atomic database transaction. If the Node.js process crashes (SIGKILL) or the network connection drops between tenant insert and user insert, an orphan tenant record will remain.
- A true ACID transaction requires a PostgreSQL stored procedure (`provision_tenant_atomic` RPC). However, implementing an RPC requires client-side pre-hashing and DDL migration approval. For Phase 1, application-level preflight validation and tracked rollback is appropriate and lowest risk.

---

### 3.4 Foreign-Key Deletion Trade-Off & Recorded Owner Decision

#### Existing State & Evidence Classification
- **Prior Production Catalog Audit Evidence**: On live database `ignspvajzblmsbertmmv` ([`docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md#L315`](file:///d:/bestow/p-industry/docs/audits/PYNTFLOW_SHOP_DELETION_USERNAME_AUDIT.md#L315)), constraint `app_users_tenant_id_fkey` had `delete_rule = 'SET NULL'`.
- **Current Offline Review Evidence**: Tracked migration [`supabase/migrations/20260924_03_performance_indexes.sql#L44`](file:///d:/bestow/p-industry/supabase/migrations/20260924_03_performance_indexes.sql#L44) declares `CREATE INDEX IF NOT EXISTS idx_app_users_tenant_id ON public.app_users(tenant_id)`. Zero database connections were made during this offline review.

#### Owner Decision Recorded (October 12, 2026)
- **Approved Behavior**: **`ON DELETE CASCADE`** for `public.app_users(tenant_id)` (permanently purges tenant-owned users on shop deletion; supersedes previous discussion of retaining `SET NULL`).
- **Requirements**:
  - When a tenant is deleted, all `app_users` records owned by that tenant (including CEO, cashier, and godown staff accounts) must be permanently deleted.
  - Global developer accounts (`tenant_id IS NULL`) must remain unaffected.
- **Migration Prepared**: [`supabase/migrations/20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261012_01_app_users_fk_cascade.sql) (accompanied by companion rollback script at [`scripts/rollback_20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/scripts/rollback_20261012_01_app_users_fk_cascade.sql)).
- **Execution Gate**: **Migration execution against the database remains gated on separate explicit authorization.**

#### Architectural & Safety Review
1. **Developer Account Immunity**:
   In PostgreSQL referential integrity mechanics, foreign keys with `ON DELETE CASCADE` only cascade when child rows match the parent primary key (`child.tenant_id = parent.id`). Global developer accounts have `tenant_id IS NULL`. Because NULL never evaluates equal to any parent UUID, developer accounts are structurally immune to cascades when any tenant is deleted.
2. **Application-Side Deletion Interaction**:
   In [`src/app/api/tenants/route.ts#L502`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L502), `DELETE /api/tenants` explicitly deletes users prior to deleting the tenant row (`await supabaseAdmin.from('app_users').delete().eq('tenant_id', id)`). This creates zero conflict with `ON DELETE CASCADE`; if the application deletes users first, the database cascade encounters zero remaining child rows and succeeds normally. Retaining both layers provides defense-in-depth: API deletion provides audit logging and predictable order of operations, while schema-level cascade prevents orphan accounts if a tenant is ever deleted directly via SQL, Table Editor, or an external script.
3. **Rollback Irreversibility Limitation**:
   Restoring `ON DELETE SET NULL` only alters subsequent deletions. It cannot resurrect or restore any `app_users` rows that were already permanently deleted during a cascade operation while `ON DELETE CASCADE` was active. Recovering cascaded user records requires point-in-time backup restoration.
4. **Composite Foreign Key & Unsupported Schema State Guard**:
   The migration checks for any composite foreign keys involving `public.app_users.tenant_id`. If an unexpected composite foreign key is detected, or if the canonical constraint name is bound to unexpected columns, the migration transaction immediately aborts (`RAISE EXCEPTION`) rather than silently leaving or dropping multi-column constraints.
5. **Decoupling Database FK Cascade from Complete Application Workflow**:
   The database FK cascade specifically governs parent-child row deletion when a `public.tenants` row is removed. While accounts with `tenant_id IS NULL` are structurally immune to that database-level cascade, their survival across the entire system lifecycle also relies on application-level query scoping in [`src/app/api/tenants/route.ts#L502`](file:///d:/bestow/p-industry/src/app/api/tenants/route.ts#L502) (`.eq('tenant_id', id)`) and trigger audits. Neither layer alone replaces the other.
6. **Locking & Operational Performance Considerations (PostgreSQL Documentation, §13.3.1)**:
   All DDL locks are held until the end of the transaction. The migration performs three operations:
   - **`ALTER TABLE ... DROP CONSTRAINT`** (Section B, Step 1): Acquires `ACCESS EXCLUSIVE` on `public.app_users`. Conflicts with all lock modes; blocks all concurrent reads and writes.
   - **`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`** (Section B, Step 2): Acquires `SHARE ROW EXCLUSIVE` on both `public.app_users` (referencing/child) and `public.tenants` (referenced/parent). Blocks concurrent `INSERT`, `UPDATE`, `DELETE`, `SHARE UPDATE EXCLUSIVE`, `SHARE`, `SHARE ROW EXCLUSIVE`, `EXCLUSIVE`, and `ACCESS EXCLUSIVE`; permits concurrent reads (`ACCESS SHARE`). Ref: pg docs §13.3.1 — "Acquired by `CREATE TRIGGER` and some forms of `ALTER TABLE`."
   - **`CREATE INDEX` (non-concurrent)** (Section B, Step 3, conditional): Acquires `SHARE` on `public.app_users` only if the index does not already exist. Permits concurrent reads; blocks concurrent writes during build.
   - **Peak lock for the complete transaction**: `ACCESS EXCLUSIVE` on `public.app_users`, acquired by `DROP CONSTRAINT` (Operation 1) — stronger than the `SHARE ROW EXCLUSIVE` from `ADD CONSTRAINT` (Operation 2).
   Lock duration cannot be predicted or promised using arbitrary timing estimates (e.g. "< 50ms"); actual duration depends on active transactions, concurrent queries, table sizes, and system workload. Execution requires a reviewed read-only preflight and an authorized low-traffic maintenance window.

---

## 4. Proposed Implementation Phases & Dependency Order

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: CORE PROVISIONING BLOCKER REMEDIATION (P0)                    │
│ ├─ Task 1.1: Canonical Cashier Account Ingestion & Deduplication Fix   │
│ └─ Task 1.2: Excise Dead `ceo_tenants` Queries in tenants/route.ts     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Unblocks shop creation)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: FRONTEND STATE & TYPE STREAMLINING (P1)                       │
│ └─ Task 2.1: Modernize DevBranchModal Account Assembly & Types         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Harmonizes client contract)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PROVISIONING ATOMICITY & DELETION INTEGRITY (P2)              │
│ ├─ Task 3.1: Harden Pre-Flight Checks, Password Hashing & Rollback     │
│ └─ Task 3.2: Prepare app_users FK Cascade Migration                    │
│              [APPROVED — MIGRATION PREPARED & STATICALLY REVIEWED;     │
│               EXECUTION PENDING SEPARATE AUTHORIZATION]                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ PHASE 4: AUTOMATED REGRESSION & LIFECYCLE TEST SUITE (P1)              │
│ └─ Task 4.1: Safe End-to-End Tenant Lifecycle Verification Script      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Safe Regression-Test Specification (Task 4.1)

Live lifecycle tests interact with running HTTP endpoints and database tables. Therefore, `scripts/verify-tenant-lifecycle.mjs` must not be described as "zero-risk". It must include the following mandatory safeguards:

1. **Environment Safety Gate**:
   - Check `PYNTFLOW_BASE_URL` against an approved local origins allowlist (`http://localhost:*`, `http://127.0.0.1:*`).
   - Require an explicit environment flag: `ALLOW_TENANT_LIFECYCLE_TEST=true`.
   - Require `DEV_ADMIN_TOKEN` (developer role JWT; never logged).
   - Reject remote/staging/production endpoints fail-closed before any network request.
   - Note: A local HTTP target (`http://localhost:3000`) does NOT prove database isolation; application Supabase credentials must be separately verified before running.
2. **Dynamic Unique Identifiers**:
   - Every run generates unique, randomized names and slugs via `makeRunIds()`:
     - `slug = test-lc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
     - `ceo_username = ceo-${Date.now()}-${rand}`
     - `cashier_username = pos-${Date.now()}-${rand}`
   - Passwords are 20-character random hex strings, never logged, never reused.
   - Never use static strings like `hamza`, `ceo`, or `counter1` that could collide with real data.
3. **Tracking of All Test-Created Resources**:
   - Maintain tracked IDs: `cleanup.trackedTenantIds = []`.
   - Only record an ID after the API confirms successful creation with a valid string UUID.
   - Both Tenant 1 and Tenant 2 are tracked independently.
4. **Scoped Cleanup in `finally` Block**:
   - Cleanup is strictly scoped to exact IDs: `DELETE /api/tenants?id=<id>`. Wildcards or pattern-based deletions are forbidden.
   - Wrapped in a `finally` block to execute even if assertions fail.
   - Registers process listeners (`SIGINT`, `SIGTERM`) for best-effort cleanup.
   - Honest limitation: `finally` cannot protect against `SIGKILL`, hardware failure, or sudden power loss.
5. **Recovery Procedure Documentation**:
   - Primary recovery operates strictly on exact tracked UUIDs:
     ```sql
     -- Exact-ID cleanup SQL (safe when exact IDs are known):
     DELETE FROM public.app_users WHERE tenant_id IN ('<exact-tenant-id-1>', '<exact-tenant-id-2>');
     DELETE FROM public.tenants WHERE id IN ('<exact-tenant-id-1>', '<exact-tenant-id-2>');
     ```
   - If abrupt termination caused in-memory IDs to be lost before recording, the operator may run a **read-only discovery query** to discover candidate rows created by this script format:
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
     SELECT count(*) AS remaining_tenants FROM public.tenants WHERE id IN ('<tenant1-id>', '<tenant2-id>');
     SELECT count(*) AS remaining_users FROM public.app_users WHERE tenant_id IN ('<tenant1-id>', '<tenant2-id>');
     ```
7. **Lifecycle Test vs. Database FK Cascade Boundary Clarification**:
   - The lifecycle test verifies the complete application-level deletion workflow (`DELETE /api/tenants`).
   - Because `DELETE /api/tenants` in `src/app/api/tenants/route.ts#L502` explicitly deletes user accounts first (`supabaseAdmin.from('app_users').delete().eq('tenant_id', id)`), the lifecycle test does **NOT** independently exercise or prove schema-level `ON DELETE CASCADE` behavior in isolation.
   - Independent verification of the database-level FK cascade requires a separate, direct database test (e.g. deleting a tenant record directly in PostgreSQL while associated child accounts exist, without deleting users first, and verifying that the database engine purges child rows).

## 6. Acceptance Criteria & Approval Gates

| Gate ID | Operation | Scope | Approval Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **GATE-01** | Application Route & Component Fixes (Tasks 1.1, 1.2, 2.1, 3.1) | Next.js API routes & Dev Panel | **COMPLETED & OFFLINE VERIFIED** | 8/8 contract tests + 9/9 safety tests pass |
| **GATE-02** | Schema DDL Migration for `app_users` FK Cascade (Task 3.2) | PostgreSQL DDL Alteration | **APPROVED — MIGRATION PREPARED & STATICALLY REVIEWED** | Owner approved `ON DELETE CASCADE`; migration SQL prepared in `supabase/migrations/20261012_01_app_users_fk_cascade.sql` with complete preflight, catalog guards, 5 runnable post-migration assertions, and companion rollback script `scripts/rollback_20261012_01_app_users_fk_cascade.sql`; DDL execution pending separate authorization |
| **GATE-03** | Lifecycle Test Script Implementation (Task 4.1) | `scripts/verify-tenant-lifecycle.mjs` | **COMPLETED & OFFLINE VERIFIED** | 21/21 mock tests pass in `scripts/test-lifecycle-offline.mjs` (including untrack safety); zero live execution |
| **GATE-04** | Live Lifecycle Test Execution | Live HTTP API execution | **PENDING SEPARATE AUTHORIZATION** | Preconditions required before running |

---

## 7. Plan Status

Application code fixes for Tasks 1.1, 1.2, 2.1, and 3.1 are implemented and verified via automated offline test suites (61/61 tests passing across contract, safety, lifecycle offline, and receipt adapter suites; `tsc --noEmit` clean). Task 3.2 owner decision (`ON DELETE CASCADE` for `app_users.tenant_id`) has been explicitly recorded, and migration SQL has been prepared and statically reviewed at [`supabase/migrations/20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/supabase/migrations/20261012_01_app_users_fk_cascade.sql) (accompanied by companion rollback script at [`scripts/rollback_20261012_01_app_users_fk_cascade.sql`](file:///d:/bestow/p-industry/scripts/rollback_20261012_01_app_users_fk_cascade.sql)). Task 4.1 lifecycle verification script is implemented with guarded `cleanup.untrack` ID removal and offline-verified with 21 unit tests. **No live HTTP requests, database mutations, or schema migrations have been performed.** Live execution of `scripts/verify-tenant-lifecycle.mjs` and database migration execution remain gated on separate explicit user authorizations.
