# v6 Raw Outputs — Staging Test Run

Project: azzonbwaevtywisxlxej (for staging)
Date: 2026-10-21
Runner: Supabase REST API `/v1/projects/{ref}/database/query`

## Pre-Test Row Counts
```json
[{"tenants":1,"shifts":1,"app_users":0,"invoices":0,"invoice_items":0,"clients":0,"items":0,"brands":0,"special_print_log":0,"token_transactions":0,"audit_logs":0}]
```

## Tests 1–33 (BEGIN/ROLLBACK blocks)

All wrapped in BEGIN...EXCEPTION...ROLLBACK blocks. HTTP 201 = no exception escaped = PASS.
Assertion failures inside blocks are caught and re-raised with RAISE EXCEPTION.

### Test 1
**Title**: -- TEST 1: Immutability Trigger — Direct DELETE & UPDATE Blocked
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 2
**Title**: -- TEST 2: Immutability Trigger — TRUNCATE Blocked
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 3
**Title**: -- TEST 3: Tenant Cascade Delete Verification (pg_trigger_depth() > 1)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 4
**Title**: -- TEST 4: Partial Unique Index — Duplicate Sale Log Handled
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 5
**Title**: -- TEST 5: Permission & Role Verification Matrix (Named Arguments)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 6
**Title**: -- TEST 6: POS Storage Rule & Option A Happy-Path Sale
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 7
**Title**: -- TEST 7: Real Token Configuration & Pass-Through (Decision 1)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 8
**Title**: -- TEST 8: Special Return Engine (Shift Check, original_invoice_item_id, Quantity Guard, Option E)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 9
**Title**: -- TEST 9: Credit-Sale Return with Server Khata Offset (Debt Reduction)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 10
**Title**: -- TEST 10: Cancelled Invoice Reprint Rejection (A4 & D2)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 11
**Title**: -- TEST 11: Return Blocked on Cancelled Special Invoice
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 12
**Title**: -- TEST 12: D1 Edit Block Verification (update_invoice_atomic)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 13
**Title**: -- TEST 13: Privilege Verification — anon/authenticated cannot execute RPCs
**HTTP Status**: 201
**Body**:
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
**Result**: PASS

### Test 14
**Title**: -- TEST 14: Constraint, Column & Index Schema Verification
**HTTP Status**: 201
**Body**:
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
**Result**: PASS

### Test 15
**Title**: -- TEST 15: F7 — Delivery Charge Consistency
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 16
**Title**: -- TEST 16: F8 — Invoice-Level Discount Rejected
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 17
**Title**: -- TEST 17: F1 — Duplicate Same-Item Lines (original_invoice_item_id Disambiguation)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 18
**Title**: -- TEST 18: R1f — Cents Rule Per Original Line Across Multiple Return Calls
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 19
**Title**: -- TEST 19: R1c — Card Refund Leaves Client Ledger Unchanged
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 20
**Title**: -- TEST 20: R1c — Cash Refund Sets cash_paid for Day Close Netting
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 21
**Title**: -- TEST 21: Walk-In Customer Return (offset = 0, Full Cashier Refund Required)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 22
**Title**: -- TEST 22: R1c — Mixed Tender Return (Cash + Card) with Khata Offset
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 23
**Title**: -- TEST 23: R1a — In-Request Duplicate Line Aggregation
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 24
**Title**: -- TEST 24: R1b — Return of Return & Non-Special Return Blocked
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 25
**Title**: -- TEST 25: R1c — Negative Tender Rejection
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 26
**Title**: -- TEST 26: Formula Simulation of cancel_invoice_atomic Asymmetry (Does Not Call Live Function)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 27
**Title**: -- TEST 27: F9 — Return on Original Invoice with Discount > 0 Rejected
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 28
**Title**: -- TEST 28: Token Transactions Pass-Through on Sale, Skipped on Return (Real Runnable SQL)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 29
**Title**: -- TEST 29: R4 — CEO Log View Variance Calculation with Delivery Charge
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 30
**Title**: -- TEST 30: Credit Sale Partial Paid + Return Within Due Amount
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 31
**Title**: -- TEST 31: Prior Returns Reduce Available Offset for Subsequent Returns
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 32
**Title**: -- TEST 32: Client Already Cleared Dues (current_balance = 0) => Offset 0 and Full Cash Refund
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

### Test 33
**Title**: -- TEST 33: In-Request Duplicate Line Merge & Cents Rule Completion (R1a & R1f)
**HTTP Status**: 201
**Body**:
```json
[]
```
**Result**: PASS

## Test 13 — Privilege Verification Detail

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

All 3 special RPCs: `is_security_definer=true`, `anon_exec=false`, `auth_exec=false`, `service_exec=true`.

## Test 14 — Schema Verification Detail

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

## Tests NEW-1..NEW-10 (EVIDENCE RAISE pattern)

Tests use `RAISE EXCEPTION 'EVIDENCE: {...}'` to emit structured assertions.
HTTP 400 with EVIDENCE prefix = PASS. HTTP 200/201 with empty body = PASS (no-error blocks).

### NEW-1
**Title**: -- TEST NEW-1: Idempotent Retry of Special Sale
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "res1_success": "true",
  "invoice_count": 1,
  "res2_duplicate": true,
  "sale_log_count": 1,
  "same_invoice_id": true,
  "stock_qty_after": 8
}
```

### NEW-2
**Title**: -- TEST NEW-2: Invoice Number Collisions (Regular Collision & Cross-User Retry Collision)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "part_a_regular_collision_error": "P0001: Invoice number COLLISION-REG already exists as a non-special invoice",
  "part_b_cross_user_collision_error": "P0001: Invoice number COLLISION-USR was created by another user (Cashier 2A)"
}
```

### NEW-3
**Title**: -- TEST NEW-3: Reprint Success and Comprehensive Guards (a..e)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "part_a_log": {
    "event_type": "reprint",
    "master_total": 2000,
    "charged_total": 2200,
    "printed_total": 2200,
    "delivery_charge": 200
  },
  "part_a_success": "true",
  "part_b_ceo_error": "P0001: Reprint restricted to authorized counter staff. CEO reprint is not permitted.",
  "part_a_has_snapshot": true,
  "part_a_has_template": true,
  "part_d_regular_error": "P0001: Invoice 23624eef-002a-49ff-8b2c-6b744300649b is not a special receipt invoice",
  "part_c_other_tenant_error": "P0001: Invoice not found or access denied",
  "part_e_after_return_success": "true"
}
```

### NEW-4
**Title**: -- TEST NEW-4: Sale RPC Comprehensive Rejections (13 Cases + Zero Mutation Proof)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "rejections": {
    "qty_zero": "P0001: Invalid quantity (0) for item \"X\": must be greater than zero",
    "closed_shift": "P0001: Shift 500e78d4-59b8-490f-8a42-493dc9e355b9 does not exist, is closed, or belongs to another tenant",
    "shift_id_null": "P0001: Shift ID is required for special invoice",
    "nonexistent_item": "P0001: Item with ID d5d2ac28-e619-4f91-8046-735c1a0f12cb not found for tenant",
    "due_without_client": "P0001: Credit sales with balance due require a registered customer account",
    "insufficient_stock": "P0001: Insufficient stock for \"New4 Item\" (Code: ): Available 10.00, requested 15",
    "other_tenant_shift": "P0001: Shift 56c4c292-8d54-41ca-8635-907393ee9d30 does not exist, is closed, or belongs to another tenant",
    "invoice_type_return": "P0001: create_special_invoice_atomic only accepts sales invoices. Return invoices must use create_special_return_atomic.",
    "negative_unit_price": "P0001: Invalid unit price (-100) for item \"X\": cannot be negative",
    "tender_sum_mismatch": "P0001: Tender breakdown does not equal paid_amount within 0.02 tolerance",
    "total_price_mismatch": "P0001: Total price mismatch for item \"X\": client sent 800, calculated 1000",
    "paid_due_sum_mismatch": "P0001: Paid amount (500) + due amount (400) does not equal charged total (1000) within 0.02 tolerance",
    "discount_exceeds_gross": "P0001: Invalid discount (1200) for item \"X\": must be between 0 and line gross (1000)"
  },
  "post_rejections_counts": {
    "final_stock": 10,
    "initial_stock": 10,
    "stock_unchanged": true,
    "invoices_created": 0,
    "invoice_items_created": 0,
    "special_print_log_created": 0
  }
}
```

### NEW-5
**Title**: -- TEST NEW-5: Tender Mismatch on Fresh Return (Rejection Guard & Zero Mutation Proof)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "stock_after": 9,
  "stock_before": 9,
  "mismatch_error": "P0001: Cashier refund (cash 600 + card 0 = 600) must equal return net (2000.00) minus khata offset (1500.00) = 500.00 within 0.02 tolerance",
  "stock_unchanged": true,
  "client_balance_after": 5000,
  "client_balance_before": 5000,
  "return_invoices_created": 0,
  "client_balance_unchanged": true
}
```

### NEW-6
**Title**: -- TEST NEW-6: Multi-Stage Return (Debt Offset Return followed by Card Refund Return)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "stocks": {
    "initial": 10,
    "after_ret1": 9,
    "after_ret2": 10,
    "after_sale": 8,
    "fully_restored": true
  },
  "balances": {
    "initial": 2000,
    "after_ret1": 2000,
    "after_ret2": 2000,
    "after_sale": 3000,
    "card_ret_kept_balance_unchanged": true
  },
  "ret1_header": {
    "card_paid": 0,
    "cash_paid": 0,
    "net_total": 1000,
    "paid_amount": 0,
    "payment_type": "others"
  },
  "ret2_header": {
    "card_paid": 1000,
    "cash_paid": 0,
    "net_total": 1000,
    "paid_amount": 1000,
    "payment_type": "card"
  }
}
```

### NEW-7
**Title**: -- TEST NEW-7: Full Rollback on Token Transaction Failure
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "stock_init": 10,
  "stock_after": 10,
  "token_error": "P0001: Unit \"UNCONFIGURED_UNIT\" is not configured in series \"Series N7\"",
  "stock_unchanged": true,
  "invoices_created": 0,
  "invoice_items_created": 0,
  "special_print_log_created": 0,
  "token_transactions_created": 0
}
```

### NEW-8
**Title**: -- TEST NEW-8: Immutability Trigger Guard on Reprint Rows (UPDATE & DELETE Blocked)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
```json
{
  "delete_error": "P0001: special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.",
  "update_error": "P0001: special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.",
  "delete_blocked_by_immutable_trigger": true,
  "update_blocked_by_immutable_trigger": true
}
```

### NEW-9
**Title**: -- TEST NEW-9: Fully Offset Return (payment_type = 'others' and consumer_calc = 0)
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
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

### NEW-10
**Title**: -- TEST NEW-10: Payment Type Matrix for Special Returns
**HTTP Status**: 400
**Result**: PASS (EVIDENCE RAISE)
**EVIDENCE**:
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

## Post-Test Row Counts
```json
[{"tenants":1,"shifts":1,"app_users":0,"invoices":0,"invoice_items":0,"clients":0,"items":0,"brands":0,"special_print_log":0,"token_transactions":0,"audit_logs":0}]
```

Zero persistence leak confirmed: all counts identical to pre-test.

## Staging Function MD5 Alignment Verification

| Function | PROD MD5 | STAGING MD5 after Step 4 | Match |
|---|---|---|---|
| create_invoice_atomic | 784e56c021751ce85b1b53b38a34c1fa | 784e56c021751ce85b1b53b38a34c1fa | ✓ |
| match_unit_to_config | 4c10f1bc56149e4009843fde57946473 | 4c10f1bc56149e4009843fde57946473 | ✓ |
| cancel_invoice_atomic | 289a9556476e86cfcc77c94656f8a4f3 | 289a9556476e86cfcc77c94656f8a4f3 | ✓ |
| update_invoice_atomic (no D1) | 26e7256f4f6f673b4dfe3d3b871b137e | 9c87bc3f226ad1aa5308b3f0ca39f026 (D1 added) | expected |
