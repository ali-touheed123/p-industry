# Staging Verification Run Report (v4)

**Date & Time**: 2026-10-21T16:26:00+05:00  
**Target Environment**: Supabase Staging Project `azzonbwaevtywisxlxej` ("for staging")  
**Auditor**: Antigravity Assistant (Gemini 3.8 Flash)  
**Status**: DB LAYER VERIFIED ON STAGING (v4)  

---

## 1. Safety Confirmation

### 1.1 Project Confirmation
Raw output of `list_projects` from the Supabase MCP server:
```json
{"projects":[{"id":"kadkryylyzfwtxknvcic","ref":"kadkryylyzfwtxknvcic","organization_id":"zkrcldciosywbpnsfabz","organization_slug":"zkrcldciosywbpnsfabz","name":"Tawakkal Paint House","region":"ap-northeast-1","created_at":"2026-02-26T09:23:26.440371Z","status":"INACTIVE","database":{"host":"db.kadkryylyzfwtxknvcic.supabase.co","version":"17.6.1.084","postgres_engine":"17","release_channel":"ga"}},{"id":"azzonbwaevtywisxlxej","ref":"azzonbwaevtywisxlxej","organization_id":"zkrcldciosywbpnsfabz","organization_slug":"zkrcldciosywbpnsfabz","name":"for staging","region":"ap-northeast-2","created_at":"2026-10-13T17:34:09.916308Z","status":"ACTIVE_HEALTHY","database":{"host":"db.azzonbwaevtywisxlxej.supabase.co","version":"17.11.0.003","postgres_engine":"17","release_channel":"ga"}},{"id":"ignspvajzblmsbertmmv","ref":"ignspvajzblmsbertmmv","organization_id":"zkrcldciosywbpnsfabz","organization_slug":"zkrcldciosywbpnsfabz","name":"p-industry","region":"ap-south-1","created_at":"2026-08-18T11:32:48.385417Z","status":"ACTIVE_HEALTHY","database":{"host":"db.ignspvajzblmsbertmmv.supabase.co","version":"17.6.1.155","postgres_engine":"17","release_channel":"ga"}}]}
```
Target staging project verified:
- **Project ID**: `azzonbwaevtywisxlxej`
- **Project Name**: `for staging`
- **Region**: `ap-northeast-2`
- **Status**: `ACTIVE_HEALTHY`

### 1.2 Safety Rules Attestation
1. **Production Project Isolation**: Production project `ignspvajzblmsbertmmv` was **NEVER** queried, whether for reads, writes, or schema inspections.
2. **Strict Codebase Scope**: Only the allowed files were modified or created:
   - `docs/special-receipt/staging_migration.sql` (only Section 5 INSERT columns & values)
   - `docs/special-receipt/staging_sql_tests_extra.sql` (new file for NEW-1..8)
   - `docs/special-receipt/staging_run_report_v4.md` (this report)
   No files in `src/`, `supabase/migrations/`, `staging_sql_tests.sql`, or existing markdown docs were modified.
3. **Honesty Rule**: All reported queries and test outputs are exact raw strings returned by the Supabase MCP server.

---

## 2. Step A: Reprint Delivery Charge Fix & Evidence

### 2.1 Exact Diff in `docs/special-receipt/staging_migration.sql` (Section 5)
```diff
--- a/docs/special-receipt/staging_migration.sql
+++ b/docs/special-receipt/staging_migration.sql
@@ -522,7 +522,7 @@
   INSERT INTO special_print_log (
     tenant_id, invoice_id, invoice_no, printed_by, user_id,
-    event_type, printed_at, master_total, printed_total, charged_total,
+    event_type, printed_at, master_total, printed_total, charged_total, delivery_charge,
     receipt_snapshot, template_snapshot
   ) VALUES (
     v_orig_log.tenant_id, v_orig_log.invoice_id, v_orig_log.invoice_no,
@@ -528,3 +528,3 @@
-    v_orig_log.master_total, v_orig_log.printed_total, v_orig_log.charged_total,
+    v_orig_log.master_total, v_orig_log.printed_total, v_orig_log.charged_total, v_orig_log.delivery_charge,
     v_orig_log.receipt_snapshot, v_orig_log.template_snapshot
   );
```

### 2.2 Live Function Application Result
Executed `CREATE OR REPLACE FUNCTION public.log_special_reprint_atomic` and its REVOKE/GRANT statements on staging.
Raw response:
```json
[]
```

### 2.3 Verification of `pg_proc` and Function Privileges
Query:
```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS is_security_definer,
  md5(pg_get_functiondef(p.oid)) AS md5_def,
  has_function_privilege('anon', p.oid, 'execute') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'execute') AS auth_exec,
  has_function_privilege('service_role', p.oid, 'execute') AS service_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'log_special_reprint_atomic';
```
Raw response:
```json
[{"proname":"log_special_reprint_atomic","args":"p_invoice_id uuid, p_user_id uuid, p_printed_by text","is_security_definer":true,"md5_def":"c31378f0332466cca1957d5fd5e489c2","anon_exec":false,"auth_exec":false,"service_exec":true}]
```

### 2.4 Re-Run of EXTRA-B via Exception Evidence Pattern
Executed exact EXTRA-B SQL from v3.
Raw response:
```
ERROR:  P0001: EVIDENCE: {"reprint_log": {"delivery_charge": 200, "event_type": "reprint", "master_total": 1000, "charged_total": 1200, "printed_total": 1200}, "sale_log": {"delivery_charge": 200, "event_type": "sale", "master_total": 1000, "charged_total": 1200, "printed_total": 1200}}
CONTEXT:  PL/pgSQL function inline_code_block line 70 at RAISE
```
Result: **PASS**. `reprint_log.delivery_charge = 200` matches `sale_log.delivery_charge = 200`.

---

## 3. Step B: Raw Evidence for Previous Data Gaps

### 3.1 Raw Output of Information Schema Columns for 9 Dependency Tables
Query:
```sql
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('invoices','invoice_items','app_users','shifts','items','clients','brands','token_transactions','audit_logs')
ORDER BY table_name, ordinal_position;
```
Raw response:
```json
[
  {"table_name":"app_users","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"app_users","column_name":"username","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"app_users","column_name":"password_hash","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"app_users","column_name":"full_name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"app_users","column_name":"email","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"app_users","column_name":"role","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"app_users","column_name":"tenant_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"app_users","column_name":"is_active","data_type":"boolean","is_nullable":"YES","column_default":"true"},
  {"table_name":"app_users","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"app_users","column_name":"can_use_special_receipt","data_type":"boolean","is_nullable":"NO","column_default":"false"},
  {"table_name":"audit_logs","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"audit_logs","column_name":"tenant_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"audit_logs","column_name":"user_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"audit_logs","column_name":"user_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"audit_logs","column_name":"action","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"audit_logs","column_name":"entity_type","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"audit_logs","column_name":"entity_id","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"audit_logs","column_name":"details","data_type":"jsonb","is_nullable":"YES","column_default":null},
  {"table_name":"audit_logs","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"audit_logs","column_name":"action_type","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"brands","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"brands","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"brands","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"brands","column_name":"status","data_type":"text","is_nullable":"NO","column_default":"'active'::text"},
  {"table_name":"brands","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},
  {"table_name":"brands","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},
  {"table_name":"clients","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"clients","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"clients","column_name":"code","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"clients","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"clients","column_name":"phone","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"clients","column_name":"city","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"clients","column_name":"area","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"clients","column_name":"address","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"clients","column_name":"credit_limit","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"clients","column_name":"current_balance","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"clients","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"clients","column_name":"token_balance","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoice_items","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"invoice_items","column_name":"invoice_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"invoice_items","column_name":"item_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"invoice_items","column_name":"item_code","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"invoice_items","column_name":"item_name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"invoice_items","column_name":"unit","data_type":"text","is_nullable":"NO","column_default":"'Piece'::text"},
  {"table_name":"invoice_items","column_name":"qty","data_type":"numeric","is_nullable":"NO","column_default":null},
  {"table_name":"invoice_items","column_name":"unit_price","data_type":"numeric","is_nullable":"NO","column_default":null},
  {"table_name":"invoice_items","column_name":"total_price","data_type":"numeric","is_nullable":"NO","column_default":null},
  {"table_name":"invoice_items","column_name":"custom_unit_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"invoice_items","column_name":"discount_pct","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"invoice_items","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"invoice_items","column_name":"cost_price","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"invoice_items","column_name":"profit","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"invoice_items","column_name":"discount","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoice_items","column_name":"shade_code","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"invoice_items","column_name":"pack_size","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"invoice_items","column_name":"discount_percent","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoice_items","column_name":"original_invoice_item_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"invoices","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"invoices","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"invoices","column_name":"invoice_no","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"invoices","column_name":"client_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"invoices","column_name":"client_name","data_type":"text","is_nullable":"NO","column_default":"'Walk-in Customer'::text"},
  {"table_name":"invoices","column_name":"date","data_type":"date","is_nullable":"NO","column_default":"CURRENT_DATE"},
  {"table_name":"invoices","column_name":"subtotal","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"invoices","column_name":"discount","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"net_total","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"invoices","column_name":"paid_amount","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"invoices","column_name":"due_amount","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"payment_type","data_type":"text","is_nullable":"NO","column_default":"'cash'::text"},
  {"table_name":"invoices","column_name":"status","data_type":"text","is_nullable":"NO","column_default":"'completed'::text"},
  {"table_name":"invoices","column_name":"remarks","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"invoices","column_name":"created_by","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"invoices","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"invoices","column_name":"delivery_charge","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"invoices","column_name":"invoice_type","data_type":"text","is_nullable":"YES","column_default":"'sale'::text"},
  {"table_name":"invoices","column_name":"shift_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"invoices","column_name":"cash_paid","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"card_paid","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"bank_paid","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"others_paid","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"invoices","column_name":"printed_as","data_type":"text","is_nullable":"NO","column_default":"'regular'::text"},
  {"table_name":"invoices","column_name":"original_invoice_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"items","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"items","column_name":"code","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"items","column_name":"name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"items","column_name":"brand_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"series_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"brand_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"series_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"unit_name","data_type":"text","is_nullable":"NO","column_default":"'Piece'::text"},
  {"table_name":"items","column_name":"cost_price","data_type":"numeric","is_nullable":"NO","column_default":"0.00"},
  {"table_name":"items","column_name":"sale_price","data_type":"numeric","is_nullable":"NO","column_default":"0.00"},
  {"table_name":"items","column_name":"stock_qty","data_type":"numeric","is_nullable":"NO","column_default":"0.00"},
  {"table_name":"items","column_name":"min_stock_alert","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"items","column_name":"is_active","data_type":"boolean","is_nullable":"YES","column_default":"true"},
  {"table_name":"items","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"items","column_name":"updated_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"items","column_name":"default_discount_pct","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"items","column_name":"category","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"unit","data_type":"text","is_nullable":"YES","column_default":"'Unit'::text"},
  {"table_name":"items","column_name":"retail_price","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"items","column_name":"shade_code","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"pack_size","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"items","column_name":"has_token","data_type":"boolean","is_nullable":"YES","column_default":"false"},
  {"table_name":"items","column_name":"token_value","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"items","column_name":"brand","data_type":"text","is_nullable":"YES","column_default":"'General'::text"},
  {"table_name":"shifts","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"shifts","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"shifts","column_name":"user_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"user_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"start_time","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"},
  {"table_name":"shifts","column_name":"end_time","data_type":"timestamp with time zone","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"starting_cash","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"shifts","column_name":"expected_cash","data_type":"numeric","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"actual_cash","data_type":"numeric","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"cash_difference","data_type":"numeric","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"total_sales","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_cash_sales","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_card_sales","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_credit_sales","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_other_sales","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_purchases","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_expenses","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"total_client_dues","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"notes","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"status","data_type":"text","is_nullable":"NO","column_default":"'open'::text"},
  {"table_name":"shifts","column_name":"total_token_payouts","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"token_count","data_type":"integer","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"closing_notes","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"closed_by","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"YES","column_default":"now()"},
  {"table_name":"shifts","column_name":"opened_by","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"shifts","column_name":"opening_cash","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"shifts","column_name":"difference","data_type":"numeric","is_nullable":"YES","column_default":"0.00"},
  {"table_name":"shifts","column_name":"previous_closing_cash","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"handover_variance","data_type":"numeric","is_nullable":"YES","column_default":"0"},
  {"table_name":"shifts","column_name":"handover_notes","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"id","data_type":"uuid","is_nullable":"NO","column_default":"gen_random_uuid()"},
  {"table_name":"token_transactions","column_name":"tenant_id","data_type":"uuid","is_nullable":"NO","column_default":null},
  {"table_name":"token_transactions","column_name":"type","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"token_transactions","column_name":"invoice_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"redemption_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"client_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"client_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"brand_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"brand_name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"token_transactions","column_name":"series_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"series_name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"token_transactions","column_name":"unit_name","data_type":"text","is_nullable":"NO","column_default":null},
  {"table_name":"token_transactions","column_name":"token_value","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"token_transactions","column_name":"quantity","data_type":"integer","is_nullable":"NO","column_default":"1"},
  {"table_name":"token_transactions","column_name":"remaining_quantity","data_type":"integer","is_nullable":"NO","column_default":"0"},
  {"table_name":"token_transactions","column_name":"total_amount","data_type":"numeric","is_nullable":"NO","column_default":"0"},
  {"table_name":"token_transactions","column_name":"usage_status","data_type":"text","is_nullable":"NO","column_default":"'available'::text"},
  {"table_name":"token_transactions","column_name":"shift_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"notes","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"write_off_reason","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"settled_vendor_name","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"used_against_purchase_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"used_against_voucher_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"parent_transaction_id","data_type":"uuid","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"created_by","data_type":"text","is_nullable":"YES","column_default":null},
  {"table_name":"token_transactions","column_name":"created_at","data_type":"timestamp with time zone","is_nullable":"NO","column_default":"now()"}
]
```

### 3.2 Test 14: Six Separate SELECT Statements Raw Rows
- **Statement 1** (`invoices.printed_as` constraint):
  ```json
  [{"conname":"invoices_printed_as_check","pg_get_constraintdef":"CHECK ((printed_as = ANY (ARRAY['regular'::text, 'special'::text])))"}]
  ```
- **Statement 2** (`special_print_log.event_type` constraint):
  ```json
  [{"conname":"special_print_log_event_type_check","pg_get_constraintdef":"CHECK ((event_type = ANY (ARRAY['sale'::text, 'reprint'::text, 'return'::text])))"}]
  ```
- **Statement 3** (`special_print_log` partial unique index):
  ```json
  [{"indexname":"idx_special_print_log_sale","indexdef":"CREATE UNIQUE INDEX idx_special_print_log_sale ON public.special_print_log USING btree (invoice_id) WHERE (event_type = 'sale'::text)"}]
  ```
- **Statement 4** (`invoices.original_invoice_id` column):
  ```json
  [{"column_name":"original_invoice_id","data_type":"uuid","is_nullable":"YES"}]
  ```
- **Statement 5** (`invoice_items.original_invoice_item_id` column):
  ```json
  [{"column_name":"original_invoice_item_id","data_type":"uuid","is_nullable":"YES"}]
  ```
- **Statement 6** (`app_users.can_use_special_receipt` column):
  ```json
  [{"column_name":"can_use_special_receipt","column_default":"false","is_nullable":"NO","data_type":"boolean"}]
  ```

### 3.3 Row Counts Before New Tests (Baseline)
Query:
```sql
SELECT
  (SELECT COUNT(*) FROM tenants) AS tenants,
  (SELECT COUNT(*) FROM shifts) AS shifts,
  (SELECT COUNT(*) FROM app_users) AS app_users,
  (SELECT COUNT(*) FROM invoices) AS invoices,
  (SELECT COUNT(*) FROM invoice_items) AS invoice_items,
  (SELECT COUNT(*) FROM clients) AS clients,
  (SELECT COUNT(*) FROM items) AS items,
  (SELECT COUNT(*) FROM brands) AS brands,
  (SELECT COUNT(*) FROM special_print_log) AS special_print_log,
  (SELECT COUNT(*) FROM token_transactions) AS token_transactions,
  (SELECT COUNT(*) FROM audit_logs) AS audit_logs;
```
Raw response:
```json
[{"tenants":1,"shifts":1,"app_users":0,"invoices":0,"invoice_items":0,"clients":0,"items":0,"brands":0,"special_print_log":0,"token_transactions":0,"audit_logs":0}]
```

---

## 4. Step C: New Staging Verification Tests (NEW-1 .. NEW-8)

| Test ID | Exact Header Title in `staging_sql_tests_extra.sql` | Raw Response | Verdict |
| :---: | :--- | :--- | :---: |
| **NEW-1** | `TEST NEW-1: Idempotent Retry of Special Sale` | `ERROR: P0001: EVIDENCE: {"res1_success": "true", "invoice_count": 1, "res2_duplicate": true, "sale_log_count": 1, "same_invoice_id": true, "stock_qty_after": 8.00}` | **PASS** |
| **NEW-2** | `TEST NEW-2: Invoice Number Collisions (Regular Collision & Cross-User Retry Collision)` | `ERROR: P0001: EVIDENCE: {"part_a_regular_collision_error": "P0001: Invoice number COLLISION-REG already exists as a non-special invoice", "part_b_cross_user_collision_error": "P0001: Invoice number COLLISION-USR was created by another user (Cashier 2A)"}` | **PASS** |
| **NEW-3** | `TEST NEW-3: Reprint Success and Comprehensive Guards (a..e)` | `ERROR: P0001: EVIDENCE: {"part_a_log": {"event_type": "reprint", "master_total": 2000, "charged_total": 2200, "printed_total": 2200, "delivery_charge": 200}, "part_a_success": "true", "part_b_ceo_error": "P0001: Reprint restricted to authorized counter staff. CEO reprint is not permitted.", "part_a_has_snapshot": true, "part_a_has_template": true, "part_d_regular_error": "P0001: Invoice 98a073e4-ad90-4f44-973a-98afa7b22bf7 is not a special receipt invoice", "part_c_other_tenant_error": "P0001: Invoice not found or access denied", "part_e_after_return_success": "true"}` | **PASS** |
| **NEW-4** | `TEST NEW-4: Sale RPC Comprehensive Rejections (13 Cases + Zero Mutation Proof)` | `ERROR: P0001: EVIDENCE: {"post_rejections_counts": {"final_stock": 10.00, "initial_stock": 10, "stock_unchanged": true, "invoices_created": 0, "invoice_items_created": 0, "special_print_log_created": 0}, "rejections": {"closed_shift": "P0001: Shift 196d1754-8c39-4e1b-a426-bab2a9d81db3 does not exist, is closed, or belongs to another tenant", "discount_exceeds_gross": "P0001: Invalid discount (1200) for item \"X\": must be between 0 and line gross (1000)", "due_without_client": "P0001: Credit sales with balance due require a registered customer account", "insufficient_stock": "P0001: Insufficient stock for \"New4 Item\" (Code: ): Available 10.00, requested 15", "invoice_type_return": "P0001: create_special_invoice_atomic only accepts sales invoices. Return invoices must use create_special_return_atomic.", "negative_unit_price": "P0001: Invalid unit price (-100) for item \"X\": cannot be negative", "nonexistent_item": "P0001: Item with ID f0f2bf71-329d-4f27-a454-d80b2bd65b92 not found for tenant", "other_tenant_shift": "P0001: Shift ee35d029-9b9b-4849-97f4-92dfb71455a8 does not exist, is closed, or belongs to another tenant", "paid_due_sum_mismatch": "P0001: Paid amount (500) + due amount (400) does not equal charged total (1000) within 0.02 tolerance", "qty_zero": "P0001: Invalid quantity (0) for item \"X\": must be greater than zero", "shift_id_null": "P0001: Shift ID is required for special invoice", "tender_sum_mismatch": "P0001: Tender breakdown does not equal paid_amount within 0.02 tolerance", "total_price_mismatch": "P0001: Total price mismatch for item \"X\": client sent 800, calculated 1000"}}` | **PASS** |
| **NEW-5** | `TEST NEW-5: Tender Mismatch on Fresh Return (Rejection Guard & Zero Mutation Proof)` | `ERROR: P0001: EVIDENCE: {"client_balance_after": 5000.00, "client_balance_before": 5000.00, "client_balance_unchanged": true, "mismatch_error": "P0001: Cashier refund (cash 600 + card 0 = 600) must equal return net (2000.00) minus khata offset (1500.00) = 500.00 within 0.02 tolerance", "return_invoices_created": 0, "stock_after": 9.00, "stock_before": 9.00, "stock_unchanged": true}` | **PASS** |
| **NEW-6** | `TEST NEW-6: Multi-Stage Return (Debt Offset Return followed by Card Refund Return)` | `ERROR: P0001: EVIDENCE: {"balances": {"after_ret1": 2000.00, "after_ret2": 2000.00, "after_sale": 3000.00, "card_ret_kept_balance_unchanged": true, "initial": 2000}, "ret1_header": {"card_paid": 0.00, "cash_paid": 0.00, "net_total": 1000.00, "paid_amount": 0.00, "payment_type": "cash"}, "ret2_header": {"card_paid": 1000.00, "cash_paid": 0.00, "net_total": 1000.00, "paid_amount": 1000.00, "payment_type": "card"}, "stocks": {"after_ret1": 9.00, "after_ret2": 10.00, "after_sale": 8.00, "fully_restored": true, "initial": 10}}` | **PASS** |
| **NEW-7** | `TEST NEW-7: Full Rollback on Token Transaction Failure` | `ERROR: P0001: EVIDENCE: {"invoices_created": 0, "invoice_items_created": 0, "special_print_log_created": 0, "stock_after": 10.00, "stock_init": 10, "stock_unchanged": true, "token_error": "P0001: Unit \"UNCONFIGURED_UNIT\" is not configured in series \"Series N7\"", "token_transactions_created": 0}` | **PASS** |
| **NEW-8** | `TEST NEW-8: Immutability Trigger Guard on Reprint Rows (UPDATE & DELETE Blocked)` | `ERROR: P0001: EVIDENCE: {"delete_blocked_by_immutable_trigger": true, "delete_error": "P0001: special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.", "update_blocked_by_immutable_trigger": true, "update_error": "P0001: special_print_log is an immutable audit trail. Updates and direct deletes are prohibited."}` | **PASS** |

---

## 5. Step D: Post-Test Persistence Check

Post-test counts on staging `azzonbwaevtywisxlxej` after executing all NEW-1 through NEW-8 transactions:

| Table | Step B.3 Baseline | Post-Test Count | Delta | Status |
| :--- | :---: | :---: | :---: | :---: |
| `tenants` | 1 | 1 | 0 | **CLEAN** |
| `shifts` | 1 | 1 | 0 | **CLEAN** |
| `app_users` | 0 | 0 | 0 | **CLEAN** |
| `invoices` | 0 | 0 | 0 | **CLEAN** |
| `invoice_items` | 0 | 0 | 0 | **CLEAN** |
| `clients` | 0 | 0 | 0 | **CLEAN** |
| `items` | 0 | 0 | 0 | **CLEAN** |
| `brands` | 0 | 0 | 0 | **CLEAN** |
| `special_print_log` | 0 | 0 | 0 | **CLEAN** |
| `token_transactions` | 0 | 0 | 0 | **CLEAN** |
| `audit_logs` | 0 | 0 | 0 | **CLEAN** |

**Zero Persistence Leak**: All sandbox transactions rolled back with 0 persistent artifacts remaining on staging.

---

## 6. Known Limitations

1. **Bare `[]` Responses in Test 1–33**: In Supabase `execute_sql`, a `[]` response proves only that no unhandled exception occurred; it does not display `RAISE NOTICE` output.
2. **Postgres Superuser Privilege Context**: Tests ran as the Supabase postgres superuser, except where specific role limitations were exercised via `SET LOCAL ROLE` (anon, authenticated, service_role).
3. **Application Layers Not Exercised**:
   - Binary ESC/POS printer protocol stream parsing.
   - Browser CSS print layout and paper size pagination rules.
   - Client PostgREST JWT authentication token parsing in Next.js middleware.
   - Frontend UI reprint/return modal forms.
4. **Original Suite Notice**: Tests 1–33 from `staging_sql_tests.sql` were fully validated in Run v3 and were not re-executed during this task.

---

## 7. Final Verdict

All 8 extra verification tests passed with visible, verifiable runtime evidence returned in the tool response. Zero persistence leaks occurred across all 11 tables. The reprint delivery charge gap is resolved and verified.

# **DB LAYER VERIFIED ON STAGING (v4)**
