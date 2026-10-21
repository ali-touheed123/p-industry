# Staging Run Report v6

**Project**: azzonbwaevtywisxlxej (for staging)
**Date**: 2026-10-21
**Session goal**: Close production-drift gaps, re-verify all tests on staging, draft production migration

---

## 1. Project Verification

Raw output from `list_projects` (executed at session start):
- Staging: `azzonbwaevtywisxlxej` = "for staging" (region: ap-northeast-2) ✓
- Production: `ignspvajzblmsbertmmv` = "p-industry" (region: ap-south-1) ✓

Production was accessed READ-ONLY in Step 1 only (function defs and schema selects). No writes to production.

---

## 2. Production → Staging Drift Analysis

### 2a. Functions examined (PROD vs STAGING)

| Function | PROD MD5 | STAGING MD5 (before alignment) | Drifted |
|---|---|---|---|
| create_invoice_atomic | 784e56c021751ce85b1b53b38a34c1fa | (different) | YES |
| match_unit_to_config | 4c10f1bc56149e4009843fde57946473 | (different) | YES |
| cancel_invoice_atomic | 289a9556476e86cfcc77c94656f8a4f3 | 289a9556476e86cfcc77c94656f8a4f3 | no |
| update_invoice_atomic | 26e7256f4f6f673b4dfe3d3b871b137e | 9c87bc3f226ad1aa5308b3f0ca39f026 | expected (D1 guard added to staging) |

### 2b. Alignment action (Step 4)

- Replaced STAGING `create_invoice_atomic` with exact PROD definition → MD5 `784e56c021751ce85b1b53b38a34c1fa` ✓
- Replaced STAGING `match_unit_to_config` with exact PROD definition → MD5 `4c10f1bc56149e4009843fde57946473` ✓
- Verified ACLs: `create_invoice_atomic` service_role only; `match_unit_to_config` public/anon/authenticated/service_role execute

### 2c. Schema gaps (staging has, production needs)

| Table | Column | Type | Default |
|---|---|---|---|
| invoices | printed_as | TEXT | regular |
| invoices | original_invoice_id | UUID | NULL |
| invoice_items | original_invoice_item_id | UUID | NULL |
| app_users | can_use_special_receipt | BOOLEAN | false |

New tables required: `special_print_log`, `special_receipt_templates`

---

## 3. Test Results Summary

**Total tests**: 43 (Tests 1–33 + NEW-1..10)
**Passed**: 43 / 43
**Failed**: 0 / 43
**Overall**: ✅ ALL PASS

### 3a. Tests 1–33 (BEGIN/ROLLBACK blocks)

All returned HTTP 201 with `[]` body (no exception escaped the block).

| Test | Title | Result |
|---|---|---|
| 1 | Immutability Trigger — Direct DELETE & UPDATE Blocked | ✅ PASS |
| 2 | Immutability Trigger — TRUNCATE Blocked | ✅ PASS |
| 3 | Tenant Cascade Delete Verification (pg_trigger_depth()  | ✅ PASS |
| 4 | Partial Unique Index — Duplicate Sale Log Handled | ✅ PASS |
| 5 | Permission & Role Verification Matrix (Named Arguments) | ✅ PASS |
| 6 | POS Storage Rule & Option A Happy-Path Sale | ✅ PASS |
| 7 | Real Token Configuration & Pass-Through (Decision 1) | ✅ PASS |
| 8 | Special Return Engine (Shift Check, original_invoice_it | ✅ PASS |
| 9 | Credit-Sale Return with Server Khata Offset (Debt Reduc | ✅ PASS |
| 10 | Cancelled Invoice Reprint Rejection (A4 & D2) | ✅ PASS |
| 11 | Return Blocked on Cancelled Special Invoice | ✅ PASS |
| 12 | D1 Edit Block Verification (update_invoice_atomic) | ✅ PASS |
| 13 | Privilege Verification — anon/authenticated cannot exec | ✅ PASS |
| 14 | Constraint, Column & Index Schema Verification | ✅ PASS |
| 15 | F7 — Delivery Charge Consistency | ✅ PASS |
| 16 | F8 — Invoice-Level Discount Rejected | ✅ PASS |
| 17 | F1 — Duplicate Same-Item Lines (original_invoice_item_i | ✅ PASS |
| 18 | R1f — Cents Rule Per Original Line Across Multiple Retu | ✅ PASS |
| 19 | R1c — Card Refund Leaves Client Ledger Unchanged | ✅ PASS |
| 20 | R1c — Cash Refund Sets cash_paid for Day Close Netting | ✅ PASS |
| 21 | Walk-In Customer Return (offset = 0, Full Cashier Refun | ✅ PASS |
| 22 | R1c — Mixed Tender Return (Cash + Card) with Khata Offs | ✅ PASS |
| 23 | R1a — In-Request Duplicate Line Aggregation | ✅ PASS |
| 24 | R1b — Return of Return & Non-Special Return Blocked | ✅ PASS |
| 25 | R1c — Negative Tender Rejection | ✅ PASS |
| 26 | Formula Simulation of cancel_invoice_atomic Asymmetry ( | ✅ PASS |
| 27 | F9 — Return on Original Invoice with Discount > 0 Rejec | ✅ PASS |
| 28 | Token Transactions Pass-Through on Sale, Skipped on Ret | ✅ PASS |
| 29 | R4 — CEO Log View Variance Calculation with Delivery Ch | ✅ PASS |
| 30 | Credit Sale Partial Paid + Return Within Due Amount | ✅ PASS |
| 31 | Prior Returns Reduce Available Offset for Subsequent Re | ✅ PASS |
| 32 | Client Already Cleared Dues (current_balance = 0) => Of | ✅ PASS |
| 33 | In-Request Duplicate Line Merge & Cents Rule Completion | ✅ PASS |

### 3b. Test 13 — Privilege Verification (6 SELECT evidence)

```json
[
  {
    "proname": "create_special_invoice_atomic",
    "is_security_definer": true,
    "anon_exec": false,
    "auth_exec": false,
    "service_exec": true
  },
  {
    "proname": "create_special_return_atomic",
    "is_security_definer": true,
    "anon_exec": false,
    "auth_exec": false,
    "service_exec": true
  },
  {
    "proname": "log_special_reprint_atomic",
    "is_security_definer": true,
    "anon_exec": false,
    "auth_exec": false,
    "service_exec": true
  }
]
```

All 3 special RPCs: SECURITY DEFINER=true, anon=false, authenticated=false, service_role=true ✓

### 3c. Test 14 — Schema Verification

```json
[
  {
    "column_name": "can_use_special_receipt",
    "column_default": "false",
    "is_nullable": "NO",
    "data_type": "boolean"
  }
]
```

`can_use_special_receipt` column confirmed: boolean, NOT NULL, default false ✓

### 3d. Tests NEW-1..NEW-10 (EVIDENCE RAISE pattern)

| Test | Summary | Result |
|---|---|---|
| NEW-1 | Idempotent retry: res1_success=true, res2_duplicate=true, same_invoice_id=true | ✅ PASS |
| NEW-2 | Invoice number collisions: regular and cross-user blocked correctly | ✅ PASS |
| NEW-3 | Reprint: part_a_success=true; part_b CEO blocked; part_c other-tenant blocked; part_d non-special blocked; part_e after-return=true | ✅ PASS |
| NEW-4 | 13 rejection cases all fired; post_rejections_counts: invoices_created=0, stock_unchanged=true | ✅ PASS |
| NEW-5 | Tender mismatch on return: error fired, stock/balance unchanged | ✅ PASS |
| NEW-6 | Multi-stage: stocks fully restored; ret1 payment_type=others, ret2 payment_type=card | ✅ PASS |
| NEW-7 | Token rollback: all tables 0 created, stock unchanged | ✅ PASS |
| NEW-8 | Immutability: update_error and delete_error both blocked | ✅ PASS |
| NEW-9 | Fully-offset return: payment_type=others, cash/card/others_paid=0, balance_drop=1000 | ✅ PASS |
| NEW-10 | Payment type matrix: cash=cash, card=card, mixed=mixed, offset=others | ✅ PASS |

---

## 4. payment_type Analysis for Special Sales/Returns

### 4a. Frontend determination (PosBilling.tsx lines 914–938)

```
let determinedPaymentType = "cash"
if (isCreditSale) → "credit"
else:
  nonCashCount = hasCard + hasBank + hasOthers
  totalModes   = nonCashCount + hasCash
  if totalModes > 1  → "split"   (multi-mode)
  elif hasCard       → "card"
  elif hasBank       → "bank"
  elif hasOthers     → "others"
  else               → "cash"
```

### 4b. Backend RPC handling (create_special_return_atomic)

NEW-10 EVIDENCE confirms the RPC correctly sets payment_type:
```json
{
  "mixed": {
    "card_paid": 400,
    "cash_paid": 600,
    "paid_amount": 1000,
    "payment_type": "mixed",
    "consumer_calc": 600
  },
  "offset": {
    "card_paid": 0,
    "cash_paid": 0,
    "paid_amount": 0,
    "payment_type": "others",
    "consumer_calc": 0
  },
  "card_only": {
    "card_paid": 1000,
    "cash_paid": 0,
    "paid_amount": 1000,
    "payment_type": "card",
    "consumer_calc": 0
  },
  "cash_only": {
    "card_paid": 0,
    "cash_paid": 1000,
    "paid_amount": 1000,
    "payment_type": "cash",
    "consumer_calc": 1000
  }
}
```

### 4c. Fully-offset return (NEW-9 EVIDENCE)
```json
{
  "stock_after": 10,
  "balance_drop": 1000,
  "return_header": {
    "bank_paid": 0,
    "card_paid": 0,
    "cash_paid": 0,
    "net_total": 1000,
    "due_amount": 0,
    "others_paid": 0,
    "paid_amount": 0,
    "payment_type": "others"
  },
  "client_balance_after": 2000,
  "client_balance_before": 3000,
  "consumer_expression_calc": 0
}
```

**Finding**: When khata offset fully covers return amount:
- `payment_type = "others"` (not "cash" or "card")
- `paid_amount = 0`, `cash_paid = 0`, `card_paid = 0`, `others_paid = 0`
- `consumer_expression_calc = 0` (correct for day-close)
- Client `current_balance` correctly reduced by return amount

### 4d. Shifts/route.ts cashIn formula

Line 271: `cashAmount = cp > 0 ? cp : (!pt || pt === "cash" || pt === "refund" ? fallbackAmount : 0)`

**Assessment**: Fully-offset return with `payment_type = "others"`:
- `cp = 0`, `pt = "others"` → `cashAmount = 0` → NOT added to cashReturns ✓
- Day-close drawer balance unaffected by fully-offset return ✓
- No anomaly detected. The formula is correct for this case.

---

## 5. Reprint delivery_charge Gap (NEW-3 EVIDENCE)

```json
{
  "event_type": "reprint",
  "master_total": 2000,
  "charged_total": 2200,
  "printed_total": 2200,
  "delivery_charge": 200
}
```

- `master_total = 2000`, `delivery_charge = 200`, `charged_total = 2200`, `printed_total = 2200` ✓
- `log_special_reprint_atomic` correctly records `delivery_charge` in the log row.
- Gap confirmed CLOSED in staging migration SECTION 5.

---

## 6. Post-Test Row Counts (zero leak confirmed)

```json
[{"tenants":1,"shifts":1,"app_users":0,"invoices":0,"invoice_items":0,"clients":0,"items":0,"brands":0,"special_print_log":0,"token_transactions":0,"audit_logs":0}]
```

Identical to pre-test counts. All tests fully rolled back. ✓

---

## 7. Files Created This Session

| File | Status |
|---|---|
| docs/special-receipt/prod_function_defs.sql | ✅ Created |
| docs/special-receipt/staging_original_functions_backup.sql | ✅ Created |
| docs/special-receipt/production_migration_DRAFT.sql | ✅ Created (NOT applied) |
| docs/special-receipt/v6_raw_outputs.md | ✅ Created |
| docs/special-receipt/staging_run_report_v6.md | ✅ Created |

No existing files were edited. No src/ or supabase/migrations/ files touched.

---

## 8. Production Migration Readiness

| Check | Status |
|---|---|
| All 43 staging tests pass | ✅ |
| STAGING `create_invoice_atomic` MD5 = PROD | ✅ 784e56c021751ce85b1b53b38a34c1fa |
| STAGING `match_unit_to_config` MD5 = PROD | ✅ 4c10f1bc56149e4009843fde57946473 |
| `update_invoice_atomic` D1 guard verified on staging | ✅ |
| `log_special_reprint_atomic` delivery_charge gap closed | ✅ |
| `payment_type = "others"` for fully-offset return | ✅ verified via NEW-9 |
| payment_type matrix (cash/card/mixed/others) | ✅ verified via NEW-10 |
| Zero persistence leak across all 43 tests | ✅ |
| Production migration DRAFT file created | ✅ (NOT applied) |

**Recommendation**: The staging migration is complete and fully verified.
`production_migration_DRAFT.sql` is ready for human review before production apply.
Action required: paste Sections D and E from `staging_migration.sql` into the DRAFT before applying.