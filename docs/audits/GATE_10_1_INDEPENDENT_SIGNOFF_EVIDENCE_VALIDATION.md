# PyntFlow Gate 10.1 — Independent Sign-Off Evidence Validation Report

**Project:** PyntFlow POS & Industrial ERP  
**Repository:** `D:\bestow\p-industry`  
**Target Environment (Production):** Supabase Reference `ignspvajzblmsbertmmv` (Strictly Read-Only)  
**Target Environment (Staging):** Supabase Reference `azzonbwaevtywisxlxej` (Forensic QA Execution)  
**Audit Date:** October 14, 2026  
**Auditor:** Independent Technical Quality & Security Assurance Agent  

---

## 1. Executive Verdict

### **FINAL VERDICT: READY WITH DOCUMENTED LIMITATIONS**

Phase 3 (Supplier Token Payments and Multi-Unit Purchase Token Valuation) has been thoroughly and independently audited. All core database security, multi-tenant isolation, atomic transaction boundaries, and multi-unit valuation logic have been forensically verified against live production and staging catalog data.

The verdict is classified as **`READY WITH DOCUMENTED LIMITATIONS`** based on the following findings:

1. **Database Correctness & Security Verified (100% PASS):**
   - The production RPCs `create_voucher_atomic(uuid,jsonb,jsonb)`, `create_voucher_atomic(uuid,jsonb,uuid[])`, and `create_purchase_atomic(uuid,jsonb,jsonb,uuid[])` are cryptographically identical (MD5 hash match) between production and staging.
   - Production PostgreSQL catalog inspection confirms strict `SECURITY DEFINER` posture with explicit `search_path = public, pg_temp`, function ownership by `postgres`, and `REVOKE EXECUTE` from `PUBLIC`, `anon`, and `authenticated`. Only `service_role` holds `EXECUTE` privileges.
   - Schema privileges in `public` namespace confirm that `anon` and `authenticated` roles possess only `USAGE` (`U`) and have **zero** `CREATE` permissions, eliminating schema search-path shadowing risks.
   - Tenancy checks (`tenant_id = p_tenant_id`) and row-level locking (`ORDER BY id ASC FOR UPDATE`) are strictly enforced across all three routines.
2. **Staging Purchase RPC Test Execution (6/6 PASS):**
   - Scenarios **P-01 through P-06** were executed on staging `azzonbwaevtywisxlxej` using fully isolated synthetic fixtures.
   - Multi-unit token valuation, database post-state persistence, foreign-tenant rejection, duplicate token IDs rejection, unique constraint purchase-number rollback, item-code failure rollback (C-01), and concurrent race serialization all passed with complete LIFO fixture cleanup.
3. **Documented Operational Limitations Requiring Stakeholder Acceptance:**
   - **Frontend Hosting Deployment Artifact (`UNVERIFIED IN REPO`):** The local Git repository reflects commit `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c` on branch `main` in sync with `origin/main`. However, because hosting provider (Vercel/Netlify) API credentials are not stored in the repository, the active live production build artifact must be validated via the hosting dashboard by the release manager.
   - **CLI Migration Tooling Restriction:** The local migration prefix scheme (`YYYYMMDD_XX`) differs from the remote ledger timestamp convention (`YYYYMMDDHHMMSS`). This historical convention requires that `supabase db push` remains strictly disabled in CI/CD, and all future schema updates must use the Supabase Management API or release migrations.
   - **Deduplication vs. Idempotency Key:** The system enforces strict database-level deduplication (blocking double-spends and duplicate purchase numbers). It does not maintain a durable HTTP response cache / idempotency key replay middleware. Cashiers must follow the documented procedure of checking transaction history prior to retrying timed-out transactions.

---

## 2. Scope, Tools, and Evidence Limitations

### 2.1 Scope of Audit
- Cross-examination of claims in:
  - `docs/audits/GATE_9_PRODUCTION_POST_DEPLOYMENT_VERIFICATION.md`
  - `docs/audits/GATE_9_1_INDEPENDENT_EVIDENCE_AUDIT.md`
  - `GATE8_FINAL_REPORT.md`
  - `docs/audits/GATE_10_OPERATIONAL_SIGN_OFF_READINESS.md`
- Direct live inspection of Supabase catalog objects and privileges on Production (`ignspvajzblmsbertmmv`).
- Execution of transactional purchase scenarios P-01 through P-06 on Staging (`azzonbwaevtywisxlxej`).
- Evaluation of repository Git history, migration ledgers, and application request handlers.

### 2.2 Tools & Protocols Used
- **Supabase Management API / MCP Tools:**
  - `execute_sql` (strictly read-only catalog queries on `ignspvajzblmsbertmmv`).
  - Catalog tables inspected: `pg_proc`, `pg_namespace`, `information_schema.routine_privileges`, `supabase_migrations.schema_migrations`.
- **Node.js Test Runner:** Isolated ESM script executing against staging REST/RPC endpoints with strict production URL blacklisting and automated LIFO teardown.
- **Git Version Control Tools:** Read-only inspection of repository commit graph, remotes, and working tree.

### 2.3 Evidence Classification Standard
- **Directly Verified (Primary Evidence):** Live database catalog queries, cryptographic hash comparisons, and live staging test execution results.
- **Inferred from Code/Schema:** Logical deduction from SQL routine definitions, TypeScript frontend handlers, and PostgreSQL constraints.
- **Reported by Prior Agents:** Historical claims documented in earlier audit files cross-checked against primary sources.

---

## 3. Claim-by-Claim Verification Table

| Claim ID | Source Document | Claim Description | Evidence Status | Verification Notes & Primary Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CLM-01** | Gate 8 Final | Migrations `20261013_03` & `20261013_04` applied to production | **VERIFIED** | Live production query on `supabase_migrations.schema_migrations` confirms versions `20261014140400` and `20261014142617`. |
| **CLM-02** | Gate 8 Final | 100% cryptographic source match between staging & production RPCs | **VERIFIED** | MD5 hash comparison of routine bodies in `pg_proc` confirms byte-for-byte identity (`create_voucher_atomic`: `982057d...`, `create_purchase_atomic`: `c16e792...`). |
| **CLM-03** | Gate 9 Report | Production business data untouched during deployment | **VERIFIED** | Census of production tables confirms 3 vouchers, 5 purchases, 2 token transactions, 1 supplier, 1 client, 2 items, 11 audit logs. Latest audit log timestamp remains `2026-10-13 01:03:59 UTC`. Zero rows mutated. |
| **CLM-04** | Gate 9 Report | `SECURITY DEFINER` and `search_path` set to `public, pg_temp` | **VERIFIED** | Inspected `prosecdef = true` and `proconfig = {search_path=public, pg_temp}` in `pg_proc` for all three routines. |
| **CLM-05** | Gate 9.1 Audit | Untrusted roles cannot inject objects into `public` schema | **VERIFIED** | Schema ACL in `pg_namespace` shows `anon=U`, `authenticated=U`, `service_role=U`. Only `pg_database_owner` has `CREATE` (`UC`). |
| **CLM-06** | Gate 9.1 Audit | `anon` and `authenticated` cannot execute RPCs directly | **VERIFIED** | `information_schema.routine_privileges` confirms `EXECUTE` privilege is granted exclusively to `service_role`. `PUBLIC`, `anon`, and `authenticated` have zero grants. |
| **CLM-07** | Gate 10 Report | Multi-unit token valuation correctly multiplies quantity | **VERIFIED** | Code inspection of `create_purchase_atomic` line 144: `v_tokens_amount := v_tokens_amount + (COALESCE(v_token.token_value, 0) * v_token.remaining_quantity);`. Confirmed via live staging test P-01. |
| **CLM-08** | Gate 10 Report | Active frontend production hosting deployment matches HEAD | **UNVERIFIED IN REPO** | Local HEAD is `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c` matching `origin/main`. Hosting provider dashboard API credentials not present in repository. |
| **CLM-09** | Gate 10 Report | Migration filename prefix mismatch causes `supabase db push` risk | **VERIFIED** | Local migrations use `YYYYMMDD_XX`, while remote ledgers use `YYYYMMDDHHMMSS`. Confirmed across all 31 historical migrations. `db push` is blocked. |
| **CLM-10** | Gate 10 Report | Application lacks durable HTTP replay idempotency key | **VERIFIED** | Handlers rely on PostgreSQL constraints (`uq_purchases_tenant_purchase_no`) and token locking rather than durable request replay tables. Cashier guidance required. |

---

## 4. Workstream A — Application Deployment Identity

### 4.1 Git Repository Status
- **Current HEAD Commit:** `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c`
- **Current Branch:** `main`
- **Remote Synchronization:** Up-to-date with `origin/main` (`https://github.com/ali-touheed123/p-industry.git`).
- **Working Tree State:** Pre-existing uncommitted changes in development artifacts were preserved. No code modifications made during this audit.

### 4.2 Hosting Provider & Deployment Artifact Verification
- **Classification:** **`UNVERIFIED IN REPO`**
- **Findings:**
  - The repository contains no continuous deployment webhook secrets, Vercel/Netlify tokens, or hosting provider deployment metadata.
  - While Git synchronization confirms the source code is published on GitHub, it does **not** prove that the live hosting provider has completed a successful build or is actively serving commit `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c`.
- **Operator Action Required Prior to Sign-Off:**
  1. Log into the hosting platform (e.g., Vercel, Netlify, AWS Amplify).
  2. Confirm the active production deployment commit SHA matches `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c`.
  3. Verify that build logs completed with exit code 0.
  4. Verify environment variables are configured:
     - `NEXT_PUBLIC_SUPABASE_URL = https://ignspvajzblmsbertmmv.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (configured)
     - `SUPABASE_SERVICE_ROLE_KEY` (configured securely for server routes)

---

## 5. Workstream B — RPC Security and Correctness Audit

### 5.1 Routine Signatures and Ownership
Catalog queries on production (`ignspvajzblmsbertmmv`) confirm:
1. `public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_items jsonb)`
   - Owner: `postgres` | `SECURITY DEFINER`: YES | `search_path`: `public, pg_temp`
2. `public.create_voucher_atomic(p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[])`
   - Owner: `postgres` | `SECURITY DEFINER`: YES | `search_path`: `public, pg_temp`
3. `public.create_purchase_atomic(p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[])`
   - Owner: `postgres` | `SECURITY DEFINER`: YES | `search_path`: `public, pg_temp`

### 5.2 Schema Search-Path Shadowing & ACL Protection
To ensure that `SECURITY DEFINER` routines cannot be hijacked via object shadowing in `public`:
- Query: `SELECT nspacl FROM pg_namespace WHERE nspname = 'public';`
- Result: `{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner,postgres=U/pg_database_owner,anon=U/pg_database_owner,authenticated=U/pg_database_owner,service_role=U/pg_database_owner}`
- **Significance:** Only `pg_database_owner` has `CREATE` (`C`) permission in schema `public`. Untrusted database clients connecting as `anon` or `authenticated` only have `USAGE` (`U`). They cannot create tables, functions, or operators to shadow objects called by `SECURITY DEFINER` routines.

### 5.3 Function Execution Grants
- Query on `information_schema.routine_privileges` confirms:
  - `service_role`: `GRANT EXECUTE` (Enabled)
  - `PUBLIC`, `anon`, `authenticated`: **Zero grants** (Explicitly revoked)
- Direct invocation from browser/anonymous clients is blocked at the database engine level. All requests must transit authorized backend API routes.

### 5.4 Multi-Tenant Boundary Enforcement
Inspection of the PL/pgSQL routine bodies proves:
- All data access statements (`SELECT`, `INSERT`, `UPDATE`) explicitly bind `WHERE tenant_id = p_tenant_id`.
- Foreign-tenant token validation (Step 2 in both routines):
  ```sql
  SELECT COUNT(*) INTO v_token_count
    FROM token_transactions
   WHERE id = ANY(p_token_ids)
     AND tenant_id = p_tenant_id;

  IF v_token_count <> array_length(p_token_ids, 1) THEN
    RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
  END IF;
  ```
- If an attacker attempts to pass token UUIDs belonging to a competitor tenant, the routine immediately terminates and raises a fail-closed exception without exposing foreign tenant metadata.

---

## 6. Workstream C — Purchase RPC Test Coverage (P-01 to P-06)

A dedicated, isolated transactional test suite was executed against Staging project `azzonbwaevtywisxlxej` on October 14, 2026.

### 6.1 Scenario Specifications and Live Results

#### **P-01: Multi-Unit Valuation & Persisted Database Post-State**
- **Invariant:** When a multi-unit token (e.g., 5 units @ Rs. 400 = Rs. 2,000) is applied to a purchase, the accumulator must credit the full batch value (Rs. 2,000), update purchase header `tokens_applied_amount`, set token `remaining_quantity = 0`, `total_amount = 0`, `usage_status = 'used'`, and record `used_against_purchase_id`.
- **Synthetic Fixtures:** Tenant `00000000-0000-4000-a000-000000000101`, 1 supplier, 1 item, 1 token transaction (qty: 5, rem: 5, val: 400, total: 2000).
- **Inspected Database Post-State:**
  - `pRes.tokens_applied_amount`: `2000.00`
  - `token_transactions.remaining_quantity`: `0`
  - `token_transactions.total_amount`: `0.00`
  - `token_transactions.usage_status`: `'used'`
  - `token_transactions.used_against_purchase_id`: Matches generated purchase UUID.
  - `purchases.tokens_applied_amount`: `2000.00`
- **Result:** **`PASS`** (Direct Database Evidence)

#### **P-02: Foreign-Tenant Token Rejection**
- **Invariant:** A purchase initiated under Tenant A cannot consume tokens owned by Tenant B. The transaction must abort atomically.
- **Synthetic Fixtures:** Tenant A (`...0101`), Foreign Tenant B (`...0102`), token owned by Tenant B.
- **RPC Invocation:** `create_purchase_atomic` under Tenant A referencing Tenant B token.
- **Expected Error:** `One or more tokens do not belong to this tenant or do not exist`.
- **Inspected Database Post-State:**
  - Call failed with exact expected exception.
  - Tenant B token queried: `usage_status = 'available'`, `remaining_quantity = 5` (100% unmutated).
- **Result:** **`PASS`** (Direct Database Evidence)

#### **P-03: Duplicate Token IDs in Single Request**
- **Invariant:** Passing the same token UUID twice in `p_token_ids` must be rejected before any row lock or state mutation occurs.
- **Synthetic Fixtures:** 1 available token.
- **RPC Invocation:** `p_token_ids: [token.id, token.id]`.
- **Expected Error:** `Duplicate token IDs supplied in purchase token request`.
- **Inspected Database Post-State:**
  - Call rejected with exact expected exception.
  - Token remained in `'available'` status.
- **Result:** **`PASS`** (Direct Database Evidence)

#### **P-04: Duplicate Purchase Number & Complete Rollback**
- **Invariant:** If a purchase insert fails due to a unique constraint violation on `(tenant_id, purchase_no)`, any tokens included in the payload must roll back to `'available'`.
- **Synthetic Fixtures:** Purchase 1 created with number `P10-DUP-TEST`. Fresh token created (qty: 3, rem: 3).
- **RPC Invocation:** Purchase 2 submitted with identical purchase number `P10-DUP-TEST` and fresh token.
- **Expected Error:** Unique constraint violation (`uq_purchases_tenant_purchase_no` / `duplicate key value`).
- **Inspected Database Post-State:**
  - PostgreSQL raised unique key constraint exception.
  - Token queried post-call: `usage_status = 'available'`, `remaining_quantity = 3` (Complete rollback verified).
- **Result:** **`PASS`** (Direct Database Evidence)

#### **P-05: Strict Rollback on Unresolved Item Code (C-01)**
- **Invariant:** If a line item specifies an invalid or non-existent `item_code`, the routine must raise an immediate exception and roll back all token mutations, preventing ghost purchases.
- **Synthetic Fixtures:** 1 available token (qty: 4, rem: 4), line item with `item_code: 'NON_EXISTENT_G10_CODE'`.
- **RPC Invocation:** `create_purchase_atomic` with bad item code.
- **Expected Error:** `Item with code "NON_EXISTENT_G10_CODE" not found for this tenant`.
- **Inspected Database Post-State:**
  - Call raised strict C-01 exception.
  - No purchase created.
  - Token queried post-call: `usage_status = 'available'`, `remaining_quantity = 4`.
- **Result:** **`PASS`** (Direct Database Evidence)

#### **P-06: Concurrent Purchase Race for Same Token Batch**
- **Invariant:** When two concurrent purchase transactions simultaneously attempt to apply the same available token batch, row-level locking (`ORDER BY id ASC FOR UPDATE`) must serialize the operations such that exactly one transaction succeeds and the other fails with a clean double-spend rejection.
- **Synthetic Fixtures:** 1 available token (qty: 5, rem: 5, total: 2000). Two concurrent asynchronous calls (`pCallA`, `pCallB`).
- **Expected Outcome:** Exactly 1 success, exactly 1 failure with `Token <id> has already been applied to another purchase`.
- **Inspected Database Post-State:**
  - `successCount`: 1 | `failureCount`: 1.
  - Failed call received exact double-spend exception.
  - Token post-state queried: `usage_status = 'used'`, `remaining_quantity = 0`, linked to the winning purchase ID.
  - Zero orphan records or inconsistent partial states.
- **Result:** **`PASS`** (Direct Database Evidence)

### 6.2 Execution Summary
- **Total Scenarios:** 6
- **Executed:** 6
- **Passed:** 6 (100%)
- **Failed:** 0
- **Teardown:** Verified automated LIFO cleanup deleted all synthetic test tenants, suppliers, brands, series, items, and transactions from staging.

---

## 7. Workstream D — Migration Tooling Assessment

### 7.1 Historical Convention Analysis
- **Supabase CLI Version:** `2.120.0`
- **Ledger Discrepancy:**
  - Local repository migrations follow the pattern `YYYYMMDD_XX_<name>.sql` (e.g., `20261013_04_fix_create_purchase_atomic_valuation.sql`).
  - Remote Supabase ledger (`supabase_migrations.schema_migrations`) follows the pattern `YYYYMMDDHHMMSS` (e.g., `20261014142617`).
- **Tooling Risk:**
  - Running `supabase db push` compares local filename prefixes directly against the remote ledger table. Because the numbering schemes diverge, `db push` may misidentify applied migrations as unapplied or attempt to re-execute them out-of-order, risking catastrophic schema divergence or migration errors.
- **Recommendation & Policy:**
  - **MANDATORY POLICY:** `supabase db push` is strictly prohibited on production and staging environments.
  - All deployments must continue using the established Supabase Management API / MCP `apply_migration` workflow, which applies idempotent SQL scripts and inserts the corresponding 14-digit timestamp into `schema_migrations`.
  - Migration filename normalization should be scheduled as a planned maintenance task in Phase 4, not during an active gate release.

---

## 8. Workstream E — Idempotency and Cashier Operational Guidance

### 8.1 Technical Deduplication vs. Replay Idempotency
- **Database Deduplication (IMPLEMENTED):**
  - Duplicate purchase attempts with the same purchase number are rejected by unique constraint `uq_purchases_tenant_purchase_no`.
  - Duplicate token consumption is blocked by row-level locking and `usage_status = 'used'` guards.
- **Request Replay Caching (NOT IMPLEMENTED):**
  - The API does not currently feature a dedicated `idempotency_keys` table or response replay middleware.
  - If a network partition occurs *after* a purchase successfully commits in PostgreSQL but *before* the HTTP 200 response reaches the client browser, a naive retry by the cashier with the same purchase number will return an HTTP 400/500 unique constraint error rather than replaying the previous success payload.

### 8.2 Cashier Operational Guidance Assessment
- **Proposed Protocol:**
  - In the event of a network timeout, spinner stall, or unconfirmed payment submission, cashiers must **NOT** immediately re-enter the transaction.
  - **Step 1:** Open the **Purchase / Voucher History** screen.
  - **Step 2:** Search by `purchase_no` or supplier name.
  - **Step 3:** If the transaction appears, print the receipt from history. If it does not appear, verify token availability and re-attempt.
- **Auditor Evaluation:**
  - This manual operational control is **sufficient and safe** for current transaction volumes.
  - Because database-level double-spend protection is 100% fail-closed, financial records cannot be duplicated. The worst-case consequence of a retried transaction is an informative error message (`duplicate key`), not monetary loss.

---

## 9. Remaining Risks, Owners, Required Evidence, and Approval Gates

| Risk Item | Severity | Owner | Required Evidence for Final Sign-Off | Approval Gate |
| :--- | :--- | :--- | :--- | :--- |
| **Hosting Deployment Unverified in Repo** | Low (Operational) | Release Manager / DevOps | Screenshot or log export from Vercel/Netlify confirming active deployment commit `1510a2a3ab2403e4b3a3af0fb8d9cc2a6be3fd4c`. | Human Operator Sign-Off |
| **Accidental `supabase db push`** | Medium | DevOps Lead | Ensure CI/CD workflows do not contain `supabase db push`. Retain Management API deployment protocol. | CI/CD Config Sign-Off |
| **Cashier Confusion on Network Timeout** | Low | Retail Operations Lead | Distribute cashier standard operating procedure (SOP): "Always check Transaction History before retrying timed-out transactions". | Operations Sign-Off |
| **Migration Ledger Renumbering** | Low | Database Architect | Schedule non-breaking migration prefix normalization script in Phase 4 backlog. | Phase 4 Backlog Gate |

---

## 10. Confirmation of Production Business Data Integrity

### **Formal Affirmation:**
During the execution of this Gate 10.1 audit:
1. **Zero write queries, updates, or deletions** were executed against production business tables in Supabase project `ignspvajzblmsbertmmv`.
2. **Zero business-mutating RPCs** were invoked against production.
3. All catalog inspections on production were strictly read-only queries against system tables (`pg_proc`, `pg_namespace`, `information_schema`).
4. All transactional test executions (P-01 to P-06) were performed exclusively on Staging project `azzonbwaevtywisxlxej` using ephemeral synthetic UUIDs with verified post-execution LIFO deletion.

**Limits of Assurance:**  
This assurance covers operations performed by this audit session. The baseline production census remains identical to pre-deployment figures: 3 vouchers, 5 purchases, 2 token transactions, 1 supplier, 1 client, 2 items, and 11 audit logs, with the latest business audit log dated `2026-10-13 01:03:59 UTC`.

---

**Report Authorized by:** Independent Technical Quality & Security Assurance Agent  
**Artifact Location:** `docs/audits/GATE_10_1_INDEPENDENT_SIGNOFF_EVIDENCE_VALIDATION.md`  
**Status:** Complete & Published
