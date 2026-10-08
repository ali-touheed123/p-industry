# SUPABASE DATABASE LINTER — MASTER IMPLEMENTATION PLAN

**Date:** October 8, 2026  
**Author:** Lead Database Security Architect & Forensic Systems Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** SUPABASE LINTER REMEDIATION — STAGE 1 PLANNING  

---

## 1. Executive Summary

This Master Implementation Plan details the exact database migrations required to resolve 100% of Supabase Database Linter findings while preserving 100% backward compatibility with all POS, ERP, financial, inventory, and token workflows.

Target Linter Result: **0 WARNING + 0 INFO + 0 FINDINGS**

---

## 2. Forward-Only Database Migration Architecture

All changes will be packaged into a single forward-only migration file:
`supabase/migrations/20261008_03_linter_zero_findings_cleanup.sql`

### Component 1: Search Path Hardening (`function_search_path_mutable`)
Applies `SET search_path = public, pg_temp` to all 18 stored procedures:
- `adjust_item_stock`
- `adjust_item_stock_by_code`
- `create_invoice_atomic`
- `cancel_invoice_atomic`
- `redeem_tokens_atomic`
- `reserve_ai_usage`
- `process_branch_dispatch_atomic`
- `receive_branch_dispatch_atomic`
- `receive_goods_atomic`
- `create_purchase_atomic`
- `cancel_purchase_atomic`
- `create_voucher_atomic`
- `get_ceo_branches_kpi_summary`
- `set_default_receipt_template`
- `update_invoice_atomic`
- `settle_tokens_atomic`
- `check_rate_limit_atomic`
- `reset_rate_limit_atomic`

### Component 2: Execution Privilege Hardening (`anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`)
Applies explicit privilege restrictions to all 18 stored procedures:
```sql
REVOKE EXECUTE ON FUNCTION public.<func_name>(...) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<func_name>(...) TO service_role;
```

### Component 3: Explicit RLS Policies (`rls_enabled_no_policy`)
Ensures every table in `public` has an explicit RLS policy:
```sql
CREATE POLICY <table_name>_service_role ON public.<table_name>
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

---

## 3. Application Compatibility & Verification Plan

1. **TypeScript Type Check**: `node ./node_modules/typescript/bin/tsc --noEmit`
2. **Production Build Verification**: `node ./node_modules/next/dist/bin/next build --webpack`
3. **API & Workflow Verification**: Verify that POS checkout, inventory adjustments, token redemption, sales history cancellation, and shift drawer closing function cleanly with service_role permissions.
4. **Linter Final Verification**: Verify that the linter output reaches `0 WARNING + 0 INFO + 0 FINDINGS`.
