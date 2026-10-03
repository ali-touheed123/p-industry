# PHASE 2 IMPLEMENTATION PLAN — DATABASE & MIGRATION HARDENING

**Status:** AWAITING HUMAN APPROVAL (AUDIT ONLY — DO NOT IMPLEMENT YET)  
**Phase:** Phase 2 — Database & Migrations  
**Dependencies:** Requires human review and Phase 3 verification before execution

---

## 1. Overview
This implementation plan outlines database security and migration hygiene remediations based strictly on verified findings from Phase 2 of the Master Forensic Audit.

---

## 2. Planned Changes

### PLAN-DB-001: Restrict Permissive RLS Policies to Service Role
- **Problem:** Token, brand, and AI settings tables have `FOR ALL USING (true)` policies without role restrictions, exposing PostgREST endpoints to anonymous callers using the public anon key.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-001` and `FINDING-DB-004`
- **Root Cause:** Placeholder permissive policies created during feature prototyping.
- **Required Behavior:** Replace public `FOR ALL USING (true)` with explicit `FOR ALL TO service_role USING (true)` (or tenant JWT claim checks where client-side queries are needed).
- **Files / Objects Affected:**
  - `brands`, `brand_series`, `custom_units`, `series_token_configs`
  - `token_redemptions`, `token_redemption_items`, `token_transactions`
  - `global_ai_settings`, `tenant_ai_settings`, `ai_usage_ledger`
- **Database Migration:** Create a new migration `20261004_01_harden_rls_policies.sql`.
- **Risks / Regression:** Verify whether any client-side component calls `supabase.from(...)` directly with anon key. (Phase 1 audit showed routes use `supabaseAdmin`, but Phase 3 & 5 will verify).
- **Verification Criteria:** PostgREST queries using `anon_key` return 0 rows / 401 on token and settings tables; Next.js API routes using `supabaseAdmin` continue to operate normally.

---

### PLAN-DB-002: Add Explicit Search Path to Atomic Stock Functions
- **Problem:** `adjust_item_stock` and `adjust_item_stock_by_code` are `SECURITY DEFINER` without `SET search_path = public, pg_temp`.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-002`
- **Root Cause:** Missing `SET search_path` clause during initial creation in `20260925_05_atomic_stock_adjust.sql`.
- **Required Behavior:** Execute `ALTER FUNCTION public.adjust_item_stock(UUID, NUMERIC) SET search_path = public, pg_temp;` and `ALTER FUNCTION public.adjust_item_stock_by_code(UUID, TEXT, NUMERIC) SET search_path = public, pg_temp;`.
- **Files / Objects Affected:** `public.adjust_item_stock`, `public.adjust_item_stock_by_code`
- **Database Migration:** Include in `20261004_01_harden_rls_policies.sql`.
- **Risks:** 0 regression risk.
- **Verification Criteria:** `SELECT prosrc, prosecdef, proconfig FROM pg_proc WHERE proname = 'adjust_item_stock';` shows `proconfig` contains `search_path=public, pg_temp`.

---

### PLAN-DB-003: Archive Obsolete Prototype Migration Files
- **Problem:** 5 unversioned `feature_2_*.sql` files exist in `supabase/migrations/` that conflict with canonical schema migration `20261002_01_paint_token_management.sql`.
- **Evidence:** `audit/phase-2-audit-report.md#FINDING-DB-003`
- **Root Cause:** Legacy development prototypes were retained in the active migrations folder.
- **Required Behavior:** Move the 5 superseded files into `supabase/migrations/archive/` or delete them from the active migrations path.
- **Files Affected:**
  - `supabase/migrations/feature_2_paint_token_system.sql`
  - `supabase/migrations/feature_2_token_claims.sql`
  - `supabase/migrations/feature_2_token_enhancements.sql`
  - `supabase/migrations/feature_2_token_stockpile_redeemed_and_vouchers.sql`
  - `supabase/migrations/feature_2_token_stockpile_usage.sql`
- **Risks:** None, as `20261002_01` already replaced `token_transactions`.
- **Verification Criteria:** `supabase/migrations/` contains only dated, sequentially ordered migration files.
