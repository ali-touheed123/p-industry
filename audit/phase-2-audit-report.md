# PHASE 2 REPORT — DATABASE & MIGRATIONS

**Audit Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 2 — Database & Migrations  
**Execution Rule Adherence:** STRICT AUDIT ONLY — ZERO CODE OR DATABASE MODIFICATIONS

---

## 1. Scope

Comprehensive forensic audit of the PostgreSQL / Supabase database architecture:
- Complete migration history (15 SQL migration files in `supabase/migrations/`)
- Table definitions, column data types, foreign keys, and cascading behaviors
- Index topology (primary, composite, performance covering indexes, partial unique indexes)
- Integrity constraints (uniqueness, check constraints, domain invariants)
- Stored procedures, RPCs, and atomic database functions
- `SECURITY DEFINER` privilege escalations and `search_path` encapsulation
- Row Level Security (RLS) policies and PostgREST attack surfaces
- Database grants and role-based permissions (`anon`, `authenticated`, `service_role`)
- Historical, deprecated, and orphaned schema elements
- Migration execution order consistency and schema divergence risks

---

## 2. Files Inspected

All 15 SQL migration files in `supabase/migrations/`:
1. `20260924_01_fix_missing_columns.sql` (Added `audit_logs.action_type`, `suppliers.last_payment_*`, and covering indexes)
2. `20260924_02_business_constraints.sql` (Enforced tenant uniqueness on `invoices`, `purchases`, `vouchers`, and single open shift partial index)
3. `20260924_03_performance_indexes.sql` (Created 26 covering indexes for foreign keys across all core modules)
4. `20260924_04_secure_held_invoices_rls.sql` (Dropped public wildcard policy on `held_invoices`, replaced with tenant claim policy)
5. `20260925_05_atomic_stock_adjust.sql` (Implemented `adjust_item_stock` & `adjust_item_stock_by_code` RPCs with row locking)
6. `20260925_06_receipt_templates.sql` (Created `receipt_templates`, `tenant_receipt_template`, and seeded standard 80mm thermal template)
7. `20261002_01_paint_token_management.sql` (Created `brands`, `brand_series`, `custom_units`, `series_token_configs`, `token_redemptions`, `token_redemption_items`, and re-architected `token_transactions` with 4-part identity)
8. `20261002_02_atomic_invoice_tokens.sql` (Implemented `create_invoice_atomic`, `cancel_invoice_atomic`, `match_unit_to_config` with row locks and stock shortage guards)
9. `20261002_03_redeem_tokens_atomic.sql` (Implemented `redeem_tokens_atomic` with authoritative config resolution, cash-only validation, and stockpile linkage)
10. `20261003_01_centralized_ai_usage_system.sql` (Created `global_ai_settings`, `tenant_ai_settings`, `ai_usage_ledger`, and `reserve_ai_usage` RPC)
11. `feature_2_paint_token_system.sql` (Legacy prototype migration)
12. `feature_2_token_claims.sql` (Legacy prototype migration)
13. `feature_2_token_enhancements.sql` (Legacy prototype migration)
14. `feature_2_token_stockpile_redeemed_and_vouchers.sql` (Legacy prototype migration)
15. `feature_2_token_stockpile_usage.sql` (Legacy prototype migration)

---

## 3. Database Objects Inspected

### 3.1 Tables
- `public.tenants` (Multi-tenant store registry)
- `public.app_users` (Staff, Cashier, CEO, and Developer credentials)
- `public.items` (Inventory catalog, prices, stock quantities, brand/series foreign keys)
- `public.custom_units` (Tenant custom packaging units)
- `public.brands` (Paint manufacturer registry)
- `public.brand_series` (Brand product series)
- `public.series_token_configs` (Series unit token price matrix)
- `public.clients` / `customers` (Khata debtors, contractor records, credit balances)
- `public.suppliers` (Paint vendors, ledger balances, payment history)
- `public.invoices` (Sales orders, returns, gross/net totals, payment breakdown)
- `public.invoice_items` (Line items for sales and returns)
- `public.held_invoices` (Draft parked sales carts)
- `public.purchases` (Inward stock purchase invoices)
- `public.purchase_items` (Line items for supplier purchases)
- `public.shifts` (Cash drawer shifts, opening/closing cash, variance)
- `public.petty_expenses` (Store daily cash expenses)
- `public.token_redemptions` (Customer token redemption master headers)
- `public.token_redemption_items` (Customer token redemption line items)
- `public.token_transactions` (Physical paint token safe stockpile, settlements, write-offs, reversals)
- `public.vouchers` (Payment and receipt vouchers)
- `public.audit_logs` (System audit trail)
- `public.branch_orders` & `public.branch_order_items` (Inter-branch stock requisitions)
- `public.receipt_templates` & `public.tenant_receipt_template` (Thermal receipt layout customizer)
- `public.global_ai_settings` (Platform-wide AI kill switch and request/cost caps)
- `public.tenant_ai_settings` (Per-shop AI scan daily and monthly quotas)
- `public.ai_usage_ledger` (Immutable AI request and token cost ledger)

### 3.2 Stored Functions & RPCs
- `public.adjust_item_stock(UUID, NUMERIC)`: Row-locked stock adjustment.
- `public.adjust_item_stock_by_code(UUID, TEXT, NUMERIC)`: Row-locked code-based stock adjustment.
- `public.match_unit_to_config(TEXT, TEXT)`: Regex unit normalization matching item units to token configs.
- `public.create_invoice_atomic(JSONB, JSONB, JSONB)`: Atomic checkout, item insertion, inventory deduction, shortage check, and token dispatch.
- `public.cancel_invoice_atomic(UUID, UUID, TEXT)`: Atomic invoice cancellation, stock restitution, client debt reversal, and token ledger inversion.
- `public.redeem_tokens_atomic(JSONB, JSONB)`: Atomic multi-line token redemption, authoritative pricing verification, and stockpile entry.
- `public.reserve_ai_usage(UUID, TEXT, TEXT, TEXT, TEXT)`: Concurrency-safe AI quota check and reservation with `FOR UPDATE` row locks.

---

## 4. APIs Inspected
APIs interacting with database functions and migrations:
- `/api/invoices` (invokes `create_invoice_atomic`, `cancel_invoice_atomic`)
- `/api/items` & `/api/items/receive` (invokes `adjust_item_stock_atomic`)
- `/api/token-redemptions` (invokes `redeem_tokens_atomic`)
- `/api/ai-invoice-scan` & `/api/dev/ai-control` (invokes `reserve_ai_usage`)
- `/api/shifts`, `/api/purchases`, `/api/vouchers`, `/api/clients`, `/api/suppliers`, `/api/tenants`

---

## 5. Runtime Tests Executed
- Schema definition inspection and migration syntax validation.
- SQL constraint verification across all 15 migration files.

---

## 6. Verified Correct (Database Strengths)

1. **Robust Concurrency & Row Locking:** RPCs (`create_invoice_atomic`, `cancel_invoice_atomic`, `redeem_tokens_atomic`, `adjust_item_stock`, `reserve_ai_usage`) consistently employ `SELECT ... FOR UPDATE` row locks on affected entities (`items`, `clients`, `invoices`, `tenant_ai_settings`, `global_ai_settings`).
2. **Strict Stock Shortage Prevention:** `create_invoice_atomic` explicitly checks `IF v_curr_stock < v_item_qty THEN RAISE EXCEPTION ...` preventing silent negative inventory balances during sales checkout.
3. **Single Open Shift Constraint:** Partial unique index `idx_single_open_shift_per_tenant ON shifts (tenant_id) WHERE status = 'open'` guarantees that a shop cannot open multiple overlapping cash register sessions.
4. **Idempotency Protection:** Unique constraints on `(tenant_id, invoice_no)`, `(tenant_id, purchase_no)`, `(tenant_id, voucher_no)`, `(tenant_id, redemption_no)` catch duplicate submissions cleanly via `unique_violation` exception blocks without corrupting state.
5. **Authoritative Token Value Resolution:** `redeem_tokens_atomic` and `create_invoice_atomic` look up prices directly from `series_token_configs` within the database transaction rather than trusting client-submitted values.

---

## 7. Findings

### FINDING-DB-001
- **Severity:** CRITICAL
- **Location:** `supabase/migrations/20261002_01_paint_token_management.sql:194-214`
- **Component:** Row Level Security (RLS) Policies on Token & Brand Tables
- **Evidence:**
  ```sql
  CREATE POLICY brands_all ON brands FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY brand_series_all ON brand_series FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY custom_units_all ON custom_units FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY series_token_configs_all ON series_token_configs FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY token_redemptions_all ON token_redemptions FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY token_redemption_items_all ON token_redemption_items FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY token_transactions_all ON token_transactions FOR ALL USING (true) WITH CHECK (true);
  ```
- **Actual Behavior:** RLS policies allow unrestricted `ALL` operations (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) with `USING (true) WITH CHECK (true)` for all database roles (including anonymous callers using `anon_key`).
- **Expected Behavior:** Policies must be restricted `TO service_role` or enforce tenant claims so that anonymous public callers connecting to Supabase PostgREST cannot directly manipulate token safe balances, redemptions, or series configs.
- **Impact:** An attacker who extracts the public Supabase anon key from the browser bundle can directly query and manipulate `token_transactions` and `token_redemptions` via Supabase client SDK without hitting backend Next.js API routes.
- **Reproduction:** Inspect `20261002_01_paint_token_management.sql` lines 194–214.
- **Verification Status:** VERIFIED

---

### FINDING-DB-002
- **Severity:** HIGH
- **Location:** `supabase/migrations/20260925_05_atomic_stock_adjust.sql:8-36, 42-71`
- **Component:** `SECURITY DEFINER` Search Path Encapsulation
- **Evidence:** `adjust_item_stock` and `adjust_item_stock_by_code` are declared `SECURITY DEFINER` but omit `SET search_path = public, pg_temp`.
- **Actual Behavior:** Functions run with the permissions of the database owner without an isolated search path.
- **Expected Behavior:** Every `SECURITY DEFINER` function in PostgreSQL must declare `SET search_path = public, pg_temp` to prevent search path hijacking vulnerabilities.
- **Impact:** Elevated privilege execution vulnerable to object substitution if untrusted schemas are created.
- **Reproduction:** Compare `20260925_05_atomic_stock_adjust.sql:36` (missing search_path) with `20261002_02_atomic_invoice_tokens.sql:72` (properly configured).
- **Verification Status:** VERIFIED

---

### FINDING-DB-003
- **Severity:** HIGH
- **Location:** `supabase/migrations/` (Unversioned legacy migrations)
- **Component:** Migration Sequence & Schema Divergence
- **Evidence:** 5 unversioned legacy migration files exist alongside 10 timestamped migrations:
  - `feature_2_paint_token_system.sql`
  - `feature_2_token_claims.sql`
  - `feature_2_token_enhancements.sql`
  - `feature_2_token_stockpile_redeemed_and_vouchers.sql`
  - `feature_2_token_stockpile_usage.sql`
- **Actual Behavior:** These 5 files create and modify an obsolete schema for `token_transactions` (using `transaction_type`, `token_count`, `remaining_count`, `item_id`, `claim_status`). Migration `20261002_01_paint_token_management.sql` subsequently executed `DROP TABLE IF EXISTS token_transactions CASCADE;` to replace it with the 4-part identity schema.
- **Expected Behavior:** Superseded prototype migrations should be archived in an `archive/` directory or retired to prevent automated migration runners (`supabase db push` / alphabetical execution) from re-applying obsolete schema alterations over canonical tables.
- **Impact:** Running migrations in alphabetical order in a fresh environment will cause execution errors or schema state corruption.
- **Reproduction:** Inspect list of migration files in `supabase/migrations/`.
- **Verification Status:** VERIFIED

---

### FINDING-DB-004
- **Severity:** MEDIUM
- **Location:** `supabase/migrations/20261003_01_centralized_ai_usage_system.sql:67-71`
- **Component:** AI Control System RLS Policy Specificity
- **Evidence:**
  ```sql
  CREATE POLICY "Service role full access on global_ai_settings" ON public.global_ai_settings FOR ALL USING (true);
  CREATE POLICY "Service role full access on tenant_ai_settings" ON public.tenant_ai_settings FOR ALL USING (true);
  CREATE POLICY "Service role full access on ai_usage_ledger" ON public.ai_usage_ledger FOR ALL USING (true);
  ```
- **Actual Behavior:** The policy name states "Service role", but the SQL definition omits `TO service_role`.
- **Expected Behavior:** The policy should explicitly state `FOR ALL TO service_role USING (true)`.
- **Impact:** Default `anon` role can read/write AI settings if querying PostgREST directly.
- **Reproduction:** Inspect `20261003_01_centralized_ai_usage_system.sql` lines 67-71.
- **Verification Status:** VERIFIED

---

### FINDING-DB-005
- **Severity:** LOW
- **Location:** `supabase/migrations/20261002_01_paint_token_management.sql:216-218`
- **Component:** Deprecated Database Columns (`clients.token_balance`, `items.token_value`, `items.has_token`)
- **Evidence:** `clients.token_balance` has comment: `'DEPRECATED: Legacy virtual token balance. Tokens are physical assets only.'`. `items.has_token` and `items.token_value` remain on `items`.
- **Actual Behavior:** Columns remain in database schema for backward compatibility with older UI components.
- **Expected Behavior:** Documented for phased retirement once all legacy readers are confirmed decommissioned.
- **Impact:** Minor cognitive ambiguity for developers querying raw tables.
- **Reproduction:** Inspect `20261002_01_paint_token_management.sql:216-218`.
- **Verification Status:** VERIFIED

---

## 8. Security Findings
- Unrestricted RLS policies on token and brand tables (`FINDING-DB-001`).
- Missing `search_path` on `adjust_item_stock` and `adjust_item_stock_by_code` `SECURITY DEFINER` functions (`FINDING-DB-002`).
- Missing role restriction clause (`TO service_role`) on AI settings RLS policies (`FINDING-DB-004`).

---

## 9. Data Integrity Findings
- Obsolete predecessor migration scripts co-located with canonical migrations (`FINDING-DB-003`).

---

## 10. Business Logic Findings
- Atomic RPCs correctly enforce core paint store business invariants (zero inventory shortage allowances on sales, cash-only token redemptions, single open register per shop).

---

## 11. Performance Findings
- 26 foreign key covering indexes and composite timestamp indexes exist on high-frequency tables (`invoices`, `purchases`, `shifts`, `vouchers`, `token_transactions`).

---

## 12. Legacy / Dead Code
- 5 unversioned `feature_2_*.sql` prototype files are obsolete and superseded by `20261002_*.sql`.
- `clients.token_balance` is deprecated.

---

## 13. Unknown / Not Verified
- Direct execution plan analysis (EXPLAIN ANALYZE) on multi-million row historical ledger tables under production load (to be tested in Phase 11).

---

## 14. Ambiguities
- **RLS Philosophy:** Is PyntFlow architected for 100% backend-mediated access via `supabaseAdmin` service role, or should client-side Supabase PostgREST direct access be supported? (If 100% backend-mediated, all public RLS policies should strictly be `TO service_role`). (HUMAN DECISION REQUIRED).

---

## 15. Cross-Phase Dependencies
- **Phase 3 (Auth & Tenant Isolation):** Verify whether client-side direct PostgREST calls are ever attempted by the frontend or if all data flows route through Next.js API endpoints.
- **Phase 8 (Paint Token System):** Verify token lifecycle end-to-end against the 4-part identity schema.
- **Phase 10 (Security & Atomicity):** Run concurrent checkout and redemption tests against `create_invoice_atomic` and `redeem_tokens_atomic`.

---

## 16. Changes Made
**NONE — AUDIT ONLY**

---

## 17. Phase Verdict
**PARTIALLY VERIFIED**  
*(Complete database schema, RPCs, and migrations audited; 5 database findings documented for planning).*
