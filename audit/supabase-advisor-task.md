# Supabase Advisor — Reconciled Task Register

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Target Migration:** `supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql`  
**Goal:** Track remediation execution tasks for all 59 Supabase Advisor findings using exact PostgreSQL identities.  

---

## 1. Master Task Inventory

| Task ID | Task Description | Remediation Group | Target Count | Dependent Tasks | Status |
|---|---|---|---|---|---|
| **SA-TASK-1.1** | Add `SET search_path = public, pg_temp` to 6 `SECURITY DEFINER` functions using exact argument lists | SA-RG-001 | 6 WARN Findings (SA-W-001 .. SA-W-006) | None | RECONCILED — READY |
| **SA-TASK-2.1** | Revoke `PUBLIC` execute & grant `service_role` on 18 functions for `anon` role | SA-RG-002 | 18 WARN Findings (SA-W-007 .. SA-W-024) | None | RECONCILED — READY |
| **SA-TASK-2.2** | Verify `authenticated` role execution revocation for 18 functions | SA-RG-003 | 18 WARN Findings (SA-W-025 .. SA-W-042) | SA-TASK-2.1 | RECONCILED — READY |
| **SA-TASK-3.1** | Add explicit `service_role` RLS policies on 17 tables | SA-RG-004 | 17 INFO Findings (SA-I-001 .. SA-I-017) | None | RECONCILED — READY |
| **SA-TASK-4.1** | Execute migration & verify 0 findings on Supabase Advisor | ALL | 59 Findings Total | SA-TASK-1.1, 2.1, 2.2, 3.1 | RECONCILED — READY |

---

## 2. Detailed Task Definitions & Exact DDL Signatures

### TASK SA-TASK-1.1: Harden Function `search_path` (6 Functions)
- **Objective:** Explicitly scope schema resolution for `SECURITY DEFINER` functions.
- **Affected Findings:** `SA-W-001`, `SA-W-002`, `SA-W-003`, `SA-W-004`, `SA-W-005`, `SA-W-006`.
- **Target Functions & Exact PostgreSQL Signatures:**
  1. `public.process_branch_dispatch_atomic(uuid, uuid)`
  2. `public.process_branch_receive_atomic(uuid, uuid, uuid)`
  3. `public.get_ceo_branches_kpi_summary(uuid[], date)`
  4. `public.set_default_receipt_template(uuid)`
  5. `public.check_rate_limit_atomic(text, integer, integer)`
  6. `public.reset_rate_limit_atomic(text)`

---

### TASK SA-TASK-2.1 / 2.2: Revoke Public Function Execution (18 Functions)
- **Objective:** Revoke default `PUBLIC`, `anon`, and `authenticated` execution rights on all 18 `SECURITY DEFINER` functions, granting access exclusively to `service_role`.
- **Affected Findings:** `SA-W-007` through `SA-W-042` (36 total WARN findings).
- **Target Functions & Exact PostgreSQL Signatures:**
  1. `public.adjust_item_stock(uuid, numeric)`
  2. `public.adjust_item_stock_by_code(uuid, text, numeric)`
  3. `public.cancel_invoice_atomic(uuid, uuid, text, text)`
  4. `public.cancel_purchase_atomic(uuid, uuid)`
  5. `public.check_rate_limit_atomic(text, integer, integer)`
  6. `public.create_invoice_atomic(jsonb, jsonb, jsonb)`
  7. `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])`
  8. `public.create_voucher_atomic(uuid, jsonb, uuid[])`
  9. `public.get_ceo_branches_kpi_summary(uuid[], date)`
  10. `public.process_branch_dispatch_atomic(uuid, uuid)`
  11. `public.process_branch_receive_atomic(uuid, uuid, uuid)`
  12. `public.receive_goods_atomic(uuid, uuid, numeric, text, text, text)`
  13. `public.redeem_tokens_atomic(jsonb, jsonb)`
  14. `public.reserve_ai_usage(uuid, text, text, text, text)`
  15. `public.reset_rate_limit_atomic(text)`
  16. `public.set_default_receipt_template(uuid)`
  17. `public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)`
  18. `public.update_invoice_atomic(uuid, uuid, jsonb, jsonb)`

---

### TASK SA-TASK-3.1: Policy Reconciliation for RLS-Enabled Tables (17 Tables)
- **Objective:** Provide explicit policy reconciliation for the 17 tables flagged under INFO linter findings.
- **Affected Findings:** `SA-I-001` through `SA-I-017` (17 INFO items).
- **Target Tables (17 Total):**
  `app_users`, `audit_logs`, `branch_order_items`, `branch_orders`, `clients`, `invoice_items`, `invoices`, `items`, `petty_expenses`, `purchase_items`, `purchases`, `receipt_templates`, `shifts`, `suppliers`, `tenant_receipt_template`, `tenants`, `vouchers`.

---

### TASK SA-TASK-4.1: Post-Migration Verification
- **Objective:** Run Supabase Advisor diagnostic to confirm target state achieved.
- **Target Post-Migration State:**
  - `ERRORS`: **0**
  - `WARNINGS`: **0**
  - `INFO / SUGGESTIONS`: **0**
