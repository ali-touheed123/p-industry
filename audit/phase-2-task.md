# PHASE 2 TASK BREAKDOWN — DATABASE & MIGRATION HARDENING

**Status:** AWAITING HUMAN APPROVAL (PLANNING ONLY — DO NOT EXECUTE YET)  
**Phase:** Phase 2 — Database & Migrations

---

### TASK-2.1: Restrict RLS on Sensitive Tables to Service Role
- **Objective:** Create and stage migration `20261004_01_harden_rls_policies.sql` to drop permissive `USING (true)` policies on token, brand, and AI settings tables and restrict access `TO service_role`.
- **Problem Being Solved:** Prevents direct anonymous data manipulation via Supabase PostgREST.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-001` & `FINDING-DB-004`
- **Database Changes:**
  - Update RLS policies on `brands`, `brand_series`, `custom_units`, `series_token_configs`, `token_redemptions`, `token_redemption_items`, `token_transactions`, `global_ai_settings`, `tenant_ai_settings`, `ai_usage_ledger`.
- **API Changes:** None (`supabaseAdmin` operates with service role).
- **Frontend Changes:** None.
- **Acceptance Criteria:** Direct queries with `anon_key` fail; backend operations succeed without regression.

---

### TASK-2.2: Add Search Path to Atomic Stock Functions
- **Objective:** Encapsulate `adjust_item_stock` and `adjust_item_stock_by_code` with `SET search_path = public, pg_temp`.
- **Problem Being Solved:** Eliminates search path hijacking security vulnerability in `SECURITY DEFINER` functions.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-002`
- **Database Changes:**
  - `ALTER FUNCTION public.adjust_item_stock(UUID, NUMERIC) SET search_path = public, pg_temp;`
  - `ALTER FUNCTION public.adjust_item_stock_by_code(UUID, TEXT, NUMERIC) SET search_path = public, pg_temp;`
- **Acceptance Criteria:** `proconfig` in `pg_proc` contains `search_path=public, pg_temp`.

---

### TASK-2.3: Relocate Superseded Prototype Migrations
- **Objective:** Move the 5 unversioned `feature_2_*.sql` prototype files into `supabase/migrations/archive/`.
- **Problem Being Solved:** Prevents automated database migration runners from applying outdated schemas in fresh environments.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-003`
- **Exact Files to Move:**
  - `supabase/migrations/feature_2_paint_token_system.sql`
  - `supabase/migrations/feature_2_token_claims.sql`
  - `supabase/migrations/feature_2_token_enhancements.sql`
  - `supabase/migrations/feature_2_token_stockpile_redeemed_and_vouchers.sql`
  - `supabase/migrations/feature_2_token_stockpile_usage.sql`
- **Acceptance Criteria:** All active migration files in `supabase/migrations/` follow the timestamped naming convention.
