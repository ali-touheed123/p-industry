# Supabase Advisor — Complete Pre-Implementation Forensic Audit Report

**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Date:** October 9, 2026 (Reconciled & Corrected)  
**Audit Target State:** 0 Errors, 0 Warnings, 0 Info/Suggestions  
**Audit Scope:** Forensic verification and remediation design for 59 Advisor findings (42 WARN, 17 INFO).  

---

## 1. Executive Summary & Audit Baseline

A comprehensive pre-implementation reconciliation of the Supabase Advisor findings (`supabase warnings.md` and `supabase info.md`) was conducted against the `p-industry` database migrations and repository code.

### Baseline Summary
| Advisor Category | Finding Count | Finding Classification | Verified Status |
|---|---|---|---|
| **WARNINGS (WARN)** | 42 | Security posture findings (6 role-mutable `search_path`, 36 public `SECURITY DEFINER` execute permissions) | 100% Verified Real Issues |
| **INFO / SUGGESTIONS (INFO)** | 17 | RLS configuration findings (17 tables with RLS enabled but no explicit policies) | 100% Verified Real Issues |
| **TOTAL** | **59** | | **100% Verified** |

All 59 findings represent **verified schema states** in the repository migrations. They consist of **42 WARN security findings** and **17 INFO RLS-policy findings**. None of the findings are false positives.

---

## 2. Root Cause Breakdown & Verification

Code inspection across all 24 migration files in `supabase/migrations/` confirms that all 59 findings stem from **3 distinct root causes**:

```
                              59 ADVISOR FINDINGS
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
      RC-001                        RC-002                        RC-003
Missing SET search_path     PUBLIC EXECUTE Grants           RLS Enabled, No Policy
  (6 Functions)               (18 SECURITY DEFINER)             (17 Tables)
         │                             │                             │
         ▼                             ▼                             ▼
    SA-W-001 to                   SA-W-007 to                   SA-I-001 to
     SA-W-006                      SA-W-042                      SA-I-017
   (6 WARN)                      (36 WARN)                       (17 INFO)
                               [18 Anon + 18 Auth]
```

### Root Cause Details

1. **RC-001: Missing `SET search_path` on `SECURITY DEFINER` Functions (6 WARN Findings)**
   - **Mechanism:** When a `SECURITY DEFINER` function executes, it runs with owner privileges. Without an explicit `SET search_path = public, pg_temp`, function calls could resolve unqualified object names against temporary schemas.
   - **Affected Functions & Exact PostgreSQL Identities:**
     1. `public.process_branch_dispatch_atomic(uuid, uuid)` (`20261004_03_atomic_branch_transfer.sql`)
     2. `public.process_branch_receive_atomic(uuid, uuid, uuid)` (`20261004_03_atomic_branch_transfer.sql`)
     3. `public.get_ceo_branches_kpi_summary(uuid[], date)` (`20261006_01_performance_kpi_and_templates_rpc.sql`)
     4. `public.set_default_receipt_template(uuid)` (`20261006_01_performance_kpi_and_templates_rpc.sql`)
     5. `public.check_rate_limit_atomic(text, integer, integer)` (`20261008_01_rate_limit_system.sql`)
     6. `public.reset_rate_limit_atomic(text)` (`20261008_01_rate_limit_system.sql`)

2. **RC-002: Default `PUBLIC` Execution Rights on `SECURITY DEFINER` Functions (36 WARN Findings)**
   - **Mechanism:** PostgreSQL automatically grants `EXECUTE` on new functions to `PUBLIC` (covering both `anon` and `authenticated` roles) upon creation. Because these 18 functions are defined with `SECURITY DEFINER`, leaving default `PUBLIC` execution rights permits HTTP clients using `anon` or `authenticated` JWTs to invoke RPC endpoints directly.
   - **Why 36 Warnings for 18 Functions?** Supabase Advisor reports separate warnings for the `anon` role (18 warnings: SA-W-007 to SA-W-024) and the `authenticated` role (18 warnings: SA-W-025 to SA-W-042).
   - **Repository Architecture:** Application backend routes in `src/app/api/` execute RPC calls via `supabaseAdmin` (`service_role` key), which bypasses user-role restrictions. Revoking `EXECUTE` from `PUBLIC` restricts direct API invocation.

3. **RC-003: Tables with RLS Enabled but Zero Explicit Policies (17 INFO Findings)**
   - **Mechanism:** Row Level Security is enabled on 17 core tables, but no `CREATE POLICY` statements exist. In PostgreSQL, RLS without policies implicitly denies access to standard roles (`anon`, `authenticated`), while `service_role` (having `BYPASSRLS`) maintains access.
   - **Reconciliation Note:** Adding explicit `service_role` access policies reconciles these 17 INFO findings with Supabase Advisor requirements, subject to verification of actual application role requirements.

---

## 3. Verified Function Signature Registry (18 Functions)

The exact PostgreSQL identities (schema + function name + ordered argument data types) derived directly from Supabase Advisor metadata and verified against codebase migrations:

| # | Function Name | Exact Ordered Argument Types | Verified PostgreSQL Identity | Migration Source File |
|---|---|---|---|---|
| 1 | `adjust_item_stock` | `p_item_id uuid, p_qty_delta numeric` | `public.adjust_item_stock(uuid, numeric)` | `20260925_05_atomic_stock_adjust.sql` |
| 2 | `adjust_item_stock_by_code` | `p_tenant_id uuid, p_item_code text, p_qty_delta numeric` | `public.adjust_item_stock_by_code(uuid, text, numeric)` | `20260925_05_atomic_stock_adjust.sql` |
| 3 | `cancel_invoice_atomic` | `p_tenant_id uuid, p_invoice_id uuid, p_reason text, p_cancelled_by text` | `public.cancel_invoice_atomic(uuid, uuid, text, text)` | `20261002_02_atomic_invoice_tokens.sql` |
| 4 | `cancel_purchase_atomic` | `p_tenant_id uuid, p_purchase_id uuid` | `public.cancel_purchase_atomic(uuid, uuid)` | `20261005_03_cancel_purchase_atomic.sql` |
| 5 | `check_rate_limit_atomic` | `p_key text, p_max_attempts integer, p_window_seconds integer` | `public.check_rate_limit_atomic(text, integer, integer)` | `20261008_01_rate_limit_system.sql` |
| 6 | `create_invoice_atomic` | `p_invoice_data jsonb, p_items jsonb, p_tokens jsonb` | `public.create_invoice_atomic(jsonb, jsonb, jsonb)` | `20261002_02_atomic_invoice_tokens.sql` |
| 7 | `create_purchase_atomic` | `p_tenant_id uuid, p_purchase_data jsonb, p_items jsonb, p_token_ids uuid[]` | `public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[])` | `20261005_05_purchases_shift_id.sql` |
| 8 | `create_voucher_atomic` | `p_tenant_id uuid, p_voucher_data jsonb, p_token_ids uuid[]` | `public.create_voucher_atomic(uuid, jsonb, uuid[])` | `20261005_04_create_voucher_atomic.sql` |
| 9 | `get_ceo_branches_kpi_summary` | `p_tenant_ids uuid[], p_today date` | `public.get_ceo_branches_kpi_summary(uuid[], date)` | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| 10 | `process_branch_dispatch_atomic` | `p_order_id uuid, p_to_tenant_id uuid` | `public.process_branch_dispatch_atomic(uuid, uuid)` | `20261004_03_atomic_branch_transfer.sql` |
| 11 | `process_branch_receive_atomic` | `p_order_id uuid, p_from_tenant_id uuid, p_to_tenant_id uuid` | `public.process_branch_receive_atomic(uuid, uuid, uuid)` | `20261004_03_atomic_branch_transfer.sql` |
| 12 | `receive_goods_atomic` | `p_tenant_id uuid, p_item_id uuid, p_qty numeric, p_batch_no text, p_supplier_ref text, p_received_by text` | `public.receive_goods_atomic(uuid, uuid, numeric, text, text, text)` | `20261005_01_grn_sequence_fix.sql` |
| 13 | `redeem_tokens_atomic` | `p_redemption_data jsonb, p_lines jsonb` | `public.redeem_tokens_atomic(jsonb, jsonb)` | `20261002_03_redeem_tokens_atomic.sql` |
| 14 | `reserve_ai_usage` | `p_tenant_id uuid, p_request_id text, p_feature text, p_provider text, p_model text` | `public.reserve_ai_usage(uuid, text, text, text, text)` | `20261004_02_apply_ai_usage_system.sql` |
| 15 | `reset_rate_limit_atomic` | `p_key text` | `public.reset_rate_limit_atomic(text)` | `20261008_01_rate_limit_system.sql` |
| 16 | `set_default_receipt_template` | `p_template_id uuid` | `public.set_default_receipt_template(uuid)` | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| 17 | `settle_tokens_atomic` | `p_tenant_id uuid, p_allocations jsonb, p_supplier_id uuid, p_supplier_name text, p_settlement_type text, p_claim_reference text` | `public.settle_tokens_atomic(uuid, jsonb, uuid, text, text, text)` | `20261007_02_settle_tokens_atomic.sql` |
| 18 | `update_invoice_atomic` | `p_invoice_id uuid, p_tenant_id uuid, p_invoice_data jsonb, p_items jsonb` | `public.update_invoice_atomic(uuid, uuid, jsonb, jsonb)` | `20261007_01_update_invoice_atomic.sql` |

---

## 4. Comprehensive Finding Inventory & Traceability Table

| Finding ID | Level | Entity / Function Name | Exact Signature | Status | Root Cause | Source File & Migration |
|---|---|---|---|---|---|---|
| **SA-W-001** | WARN | `process_branch_dispatch_atomic` | `(uuid, uuid)` | VERIFIED | RC-001 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-002** | WARN | `process_branch_receive_atomic` | `(uuid, uuid, uuid)` | VERIFIED | RC-001 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-003** | WARN | `get_ceo_branches_kpi_summary` | `(uuid[], date)` | VERIFIED | RC-001 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-004** | WARN | `set_default_receipt_template` | `(uuid)` | VERIFIED | RC-001 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-005** | WARN | `check_rate_limit_atomic` | `(text, integer, integer)` | VERIFIED | RC-001 | `20261008_01_rate_limit_system.sql` |
| **SA-W-006** | WARN | `reset_rate_limit_atomic` | `(text)` | VERIFIED | RC-001 | `20261008_01_rate_limit_system.sql` |
| **SA-W-007** | WARN | `adjust_item_stock` (anon) | `(uuid, numeric)` | VERIFIED | RC-002 | `20260925_05_atomic_stock_adjust.sql` |
| **SA-W-008** | WARN | `adjust_item_stock_by_code` (anon) | `(uuid, text, numeric)` | VERIFIED | RC-002 | `20260925_05_atomic_stock_adjust.sql` |
| **SA-W-009** | WARN | `cancel_invoice_atomic` (anon) | `(uuid, uuid, text, text)` | VERIFIED | RC-002 | `20261002_02_atomic_invoice_tokens.sql` |
| **SA-W-010** | WARN | `cancel_purchase_atomic` (anon) | `(uuid, uuid)` | VERIFIED | RC-002 | `20261005_03_cancel_purchase_atomic.sql` |
| **SA-W-011** | WARN | `check_rate_limit_atomic` (anon) | `(text, integer, integer)` | VERIFIED | RC-002 | `20261008_01_rate_limit_system.sql` |
| **SA-W-012** | WARN | `create_invoice_atomic` (anon) | `(jsonb, jsonb, jsonb)` | VERIFIED | RC-002 | `20261002_02_atomic_invoice_tokens.sql` |
| **SA-W-013** | WARN | `create_purchase_atomic` (anon) | `(uuid, jsonb, jsonb, uuid[])` | VERIFIED | RC-002 | `20261005_05_purchases_shift_id.sql` |
| **SA-W-014** | WARN | `create_voucher_atomic` (anon) | `(uuid, jsonb, uuid[])` | VERIFIED | RC-002 | `20261005_04_create_voucher_atomic.sql` |
| **SA-W-015** | WARN | `get_ceo_branches_kpi_summary` (anon) | `(uuid[], date)` | VERIFIED | RC-002 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-016** | WARN | `process_branch_dispatch_atomic` (anon) | `(uuid, uuid)` | VERIFIED | RC-002 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-017** | WARN | `process_branch_receive_atomic` (anon) | `(uuid, uuid, uuid)` | VERIFIED | RC-002 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-018** | WARN | `receive_goods_atomic` (anon) | `(uuid, uuid, numeric, text, text, text)` | VERIFIED | RC-002 | `20261005_01_grn_sequence_fix.sql` |
| **SA-W-019** | WARN | `redeem_tokens_atomic` (anon) | `(jsonb, jsonb)` | VERIFIED | RC-002 | `20261002_03_redeem_tokens_atomic.sql` |
| **SA-W-020** | WARN | `reserve_ai_usage` (anon) | `(uuid, text, text, text, text)` | VERIFIED | RC-002 | `20261004_02_apply_ai_usage_system.sql` |
| **SA-W-021** | WARN | `reset_rate_limit_atomic` (anon) | `(text)` | VERIFIED | RC-002 | `20261008_01_rate_limit_system.sql` |
| **SA-W-022** | WARN | `set_default_receipt_template` (anon) | `(uuid)` | VERIFIED | RC-002 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-023** | WARN | `settle_tokens_atomic` (anon) | `(uuid, jsonb, uuid, text, text, text)` | VERIFIED | RC-002 | `20261007_02_settle_tokens_atomic.sql` |
| **SA-W-024** | WARN | `update_invoice_atomic` (anon) | `(uuid, uuid, jsonb, jsonb)` | VERIFIED | RC-002 | `20261007_01_update_invoice_atomic.sql` |
| **SA-W-025** | WARN | `adjust_item_stock` (authenticated) | `(uuid, numeric)` | VERIFIED | RC-002 | `20260925_05_atomic_stock_adjust.sql` |
| **SA-W-026** | WARN | `adjust_item_stock_by_code` (auth) | `(uuid, text, numeric)` | VERIFIED | RC-002 | `20260925_05_atomic_stock_adjust.sql` |
| **SA-W-027** | WARN | `cancel_invoice_atomic` (auth) | `(uuid, uuid, text, text)` | VERIFIED | RC-002 | `20261002_02_atomic_invoice_tokens.sql` |
| **SA-W-028** | WARN | `cancel_purchase_atomic` (auth) | `(uuid, uuid)` | VERIFIED | RC-002 | `20261005_03_cancel_purchase_atomic.sql` |
| **SA-W-029** | WARN | `check_rate_limit_atomic` (auth) | `(text, integer, integer)` | VERIFIED | RC-002 | `20261008_01_rate_limit_system.sql` |
| **SA-W-030** | WARN | `create_invoice_atomic` (auth) | `(jsonb, jsonb, jsonb)` | VERIFIED | RC-002 | `20261002_02_atomic_invoice_tokens.sql` |
| **SA-W-031** | WARN | `create_purchase_atomic` (auth) | `(uuid, jsonb, jsonb, uuid[])` | VERIFIED | RC-002 | `20261005_05_purchases_shift_id.sql` |
| **SA-W-032** | WARN | `create_voucher_atomic` (auth) | `(uuid, jsonb, uuid[])` | VERIFIED | RC-002 | `20261005_04_create_voucher_atomic.sql` |
| **SA-W-033** | WARN | `get_ceo_branches_kpi_summary` (auth) | `(uuid[], date)` | VERIFIED | RC-002 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-034** | WARN | `process_branch_dispatch_atomic` (auth) | `(uuid, uuid)` | VERIFIED | RC-002 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-035** | WARN | `process_branch_receive_atomic` (auth) | `(uuid, uuid, uuid)` | VERIFIED | RC-002 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-W-036** | WARN | `receive_goods_atomic` (auth) | `(uuid, uuid, numeric, text, text, text)` | VERIFIED | RC-002 | `20261005_01_grn_sequence_fix.sql` |
| **SA-W-037** | WARN | `redeem_tokens_atomic` (auth) | `(jsonb, jsonb)` | VERIFIED | RC-002 | `20261002_03_redeem_tokens_atomic.sql` |
| **SA-W-038** | WARN | `reserve_ai_usage` (auth) | `(uuid, text, text, text, text)` | VERIFIED | RC-002 | `20261004_02_apply_ai_usage_system.sql` |
| **SA-W-039** | WARN | `reset_rate_limit_atomic` (auth) | `(text)` | VERIFIED | RC-001/002 | `20261008_01_rate_limit_system.sql` |
| **SA-W-040** | WARN | `set_default_receipt_template` (auth)| `(uuid)` | VERIFIED | RC-001/002 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-W-041** | WARN | `settle_tokens_atomic` (auth) | `(uuid, jsonb, uuid, text, text, text)` | VERIFIED | RC-002 | `20261007_02_settle_tokens_atomic.sql` |
| **SA-W-042** | WARN | `update_invoice_atomic` (auth) | `(uuid, uuid, jsonb, jsonb)` | VERIFIED | RC-002 | `20261007_01_update_invoice_atomic.sql` |
| **SA-I-001** | INFO | `app_users` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-002** | INFO | `audit_logs` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-003** | INFO | `branch_order_items` | Table | VERIFIED | RC-003 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-I-004** | INFO | `branch_orders` | Table | VERIFIED | RC-003 | `20261004_03_atomic_branch_transfer.sql` |
| **SA-I-005** | INFO | `clients` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-006** | INFO | `invoice_items` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-007** | INFO | `invoices` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-008** | INFO | `items` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-009** | INFO | `petty_expenses` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-010** | INFO | `purchase_items` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-011** | INFO | `purchases` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-012** | INFO | `receipt_templates` | Table | VERIFIED | RC-003 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-I-013** | INFO | `shifts` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-014** | INFO | `suppliers` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-015** | INFO | `tenant_receipt_template` | Table | VERIFIED | RC-003 | `20261006_01_performance_kpi_and_templates_rpc.sql` |
| **SA-I-016** | INFO | `tenants` | Table | VERIFIED | RC-003 | `20261001_01_core_schema.sql` |
| **SA-I-017** | INFO | `vouchers` | Table | VERIFIED | RC-003 | `20261005_04_create_voucher_atomic.sql` |

---

## 5. Architectural Compatibility & Risk Assessment

- **Expected Architecture Compatibility:** The `p-industry` application uses `supabaseAdmin` (`service_role` key) exclusively in backend API routes (`src/app/api/`). `service_role` bypasses RLS policies and retains execution rights on all functions after `PUBLIC` execution is revoked.
- **Post-Migration Verification Requirement:** Expected compatibility must be verified via end-to-end integration testing (`npm run test` or API endpoint execution) following migration apply.
- **Service Role RLS Policy Reconciliation:** The addition of explicit `service_role` policies on the 17 RLS-enabled tables represents schema policy reconciliation to satisfy the Advisor INFO linter, subject to verification of actual runtime role access requirements.
