Phase 2 — Remediation Plan
PyntFlow Supplier Token Payment: Controlled Fix Design
Date: 2026-10-14 (PKT)
Authorization: Phase 2 — Fix Planning only
Input: 
Phase 1 Evidence Validation Report
 + additional targeted reads performed in this session
Output: Remediation design — no files modified, no SQL executed

0. Unresolved Uncertainties Carried Forward
These items were not fully resolved by Phase 1 evidence. Each is explicitly acknowledged in the relevant plan section.

ID	Uncertainty	Impact if Wrong
U-1	Migration version timestamps decoded from filenames — exact timestamp inside schema_migrations not byte-for-byte verified against filenames	Could affect migration ordering if a file's embedded timestamp differs from filename
U-2	The live create_purchase_atomic Step 2 does NOT lock rows in deterministic order — FOR UPDATE without ORDER BY id ASC was observed in 20261013_01 baseline	Potential deadlock window under concurrent purchase submissions; Migration 04 fixes this, but the fix has not been tested under concurrency
U-3	token_transactions.type CHECK allows 'shop_retained' for the single live active batch — Migration 03's child INSERT copies v_rec.type from parent; if a future parent has a type value requiring a different type for a child slice, the type CHECK may reject it (e.g. 'issued' is legal for a parent, but what does the child conceptually mean?)	INSERT may fail at runtime for some token types if business rules require a distinct child type
U-4	The rollback 03 audit log writes action_type = 'voucher' — but the action_type column has no CHECK constraint in the live DB. If a downstream query or report filters on action_type IN ('CREATE','UPDATE',...), rollback-era vouchers will be invisible	Data integrity regression during rollback window, not detectable as a DB constraint failure
U-5	No transactional integration tests have been executed against the migrations. The offline pattern-check scripts (test-purchase-audit-offline.mjs) explicitly do not validate runtime column resolution (confirmed by migration 01 comment at line 37–39)	A silent PL/pgSQL deferred plan caching defect of the same class as BUG-VA-01 is possible in migrations 03 or 04
U-6	The single live active token batch has type = 'shop_retained' and quantity = remaining_quantity = 14, token_value = 400.00, total_amount = 5600.00. Migration 04 would zero remaining_quantity and total_amount when applied to this batch in a purchase. The business impact of zeroing this live batch is not documented anywhere in the plan	If this batch is expected to be partially consumed across multiple purchases, the full-batch-consume approach of migration 04 Step 4 will irreversibly deplete it in the first purchase using it
U-7	RPC overload disambiguation: Supabase PostgREST resolves rpc('create_voucher_atomic', payload) based on JSONB body key matching to function parameters. Whether PostgREST correctly routes {p_token_allocations: [...]} to the JSONB overload vs UUID[] overload has not been tested	Function resolution failure (42883) or wrong overload invoked
1. Confirmed Defects (Primary-Evidence Grounded)
DEF-01: BUG-VA-01 — used_date Column Reference (CRITICAL P0, LIVE)
Location: Live create_voucher_atomic(uuid, jsonb, uuid[]), Step 6 UPDATE
Error: UPDATE token_transactions SET ... used_date = NOW() — column does not exist
Runtime effect: PostgreSQL error 42703 (undefined_column) — transaction rollback
Blast radius: Every call to /api/vouchers POST that includes any token IDs fails completely
Data integrity: No partial writes — atomic rollback means no voucher is created, no balance adjusted, no tokens marked used
Evidence: pg_get_functiondef (live) + information_schema.columns count = 0 for used_date
DEF-02: BUG-PA-01 — Token Valuation Missing Quantity Multiplication (HIGH, LIVE)
Location: Live create_purchase_atomic, Step 2 accumulator
Error: v_tokens_amount += COALESCE(v_token.token_value, 0) — ignores remaining_quantity
Runtime effect: Silent data corruption — purchase records understate tokens_applied_amount for any batch with quantity > 1
Numeric impact (live batch): If the live 14-unit × 400 batch is used in a purchase, tokens_applied_amount = 400 instead of 5600 — a ₹5,200 understatement
Blast radius: Every purchase using a token batch with quantity > 1 silently records wrong financial data. No exception raised; supplier balance and purchase ledger may also be miscalculated downstream depending on how tokens_applied_amount feeds into payment reconciliation
Evidence: pg_get_functiondef (live) confirms single-unit accumulation
DEF-03: F-13 — API Forward-Deployed Ahead of DB (CRITICAL, LIVE)
Location: /api/vouchers/route.ts lines 179–183
Error: The API conditionally sends p_token_allocations (requires JSONB overload) — overload does not yet exist in the DB
Runtime effect: 42883 (undefined_function) for any voucher request that includes token_allocations; 42703 for any request using legacy p_token_ids
Evidence: pg_proc shows only (uuid, jsonb, uuid[]) overload exists; route.ts L179–183 confirmed
DEF-04: Migration 04 Step 4 — Full-Batch Consume Without Partial-Batch Guard (HYPOTHESIS — see U-6)
Status: Not confirmed as a defect — flagged as a semantic risk
Concern: Migration 04 Step 4 zeros remaining_quantity = 0 and total_amount = 0 for every token in p_token_ids. This implies a full batch is always consumed per purchase. No partial-batch allocation exists in the purchase flow (unlike the voucher flow). Whether this is intentional business design or a limitation is not explicitly stated in the available documentation
2. Migration Sequencing Analysis
2.1 Required Application Order
[02] → [03] → [04]
Justification:

02 before 03 and 04: Although 'used' is already in the constraint (F-9), the migration ledger must not have gaps. Applying _03 before _02 would record an out-of-sequence state. Additionally, if Supabase CLI validates ledger sequence, skipping _02 could block subsequent migrations from applying.
03 before 04: Independent — they target different functions (create_voucher_atomic vs create_purchase_atomic). However, deploying in authored order reduces cognitive risk and matches the documented plan.
2.2 Migration-to-Applied-Version Mapping
File	Filename Timestamp	Applied Version Format	In DB?
_01_fix_create_purchase_atomic_audit_log	20261013	20261013001803 (confirmed)	✅
_02_allow_used_token_usage_status	20261013	~20261013xxxxxx (later)	❌
_03_fix_create_voucher_atomic	20261013	~20261013xxxxxx (later)	❌
_04_fix_create_purchase_atomic_valuation	20261013	~20261013xxxxxx (later)	❌
U-1 Carried Forward: The exact applied-version timestamps for _02, _03, _04 have not been read from the migration files themselves. Supabase CLI derives the schema_migrations.version from the first 14-digit timestamp found in the filename or from a -- Version: YYYYMMDDHHMMSS header comment. The file timestamps must be confirmed identical to what Supabase CLI would hash-assign before execution.

3. Proposed Fix: Migration 02
3.1 What It Does
sql
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_usage_status_check;
ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_usage_status_check
  CHECK (usage_status IN ('available', 'settled', 'used', 'written_off', 'reversed', 'n_a'));
3.2 Safety Analysis
Property	Assessment
Idempotency	✅ DROP CONSTRAINT IF EXISTS — no-op if absent; destructive-then-recreate if present
Data compatibility	✅ 'used' already permitted in live constraint — recreating with same value set is neutral
Concurrent safety	⚠️ ALTER TABLE ... DROP CONSTRAINT acquires ACCESS EXCLUSIVE lock on token_transactions — blocks all reads and writes for the duration. With 1 active batch row this is minimal, but must be noted for production
Rollback	Rollback of Migration 02 would require recreating the original constraint without 'used' — documented in rollback_20261013_02_allow_used_token_usage_status.sql
Blast radius if fails	Negligible — constraint operation is DDL; if it fails, no data changes
3.3 Pre-Execution Checks Required Before Running
 Confirm no long-running transactions currently hold locks on token_transactions
 Confirm no usage_status values in live data outside the new allowed set (would cause constraint failure on ADD CONSTRAINT)
Live data check needed (Phase 3 preflight): SELECT DISTINCT usage_status FROM token_transactions — must return only values in {'available','settled','used','written_off','reversed','n_a'}.

4. Proposed Fix: Migration 03 — create_voucher_atomic
4.1 Core Changes vs Baseline
Aspect	Baseline (live)	After Migration 03
Overloads	(uuid, jsonb, uuid[]) only	(uuid, jsonb, jsonb) + (uuid, jsonb, uuid[])
used_date	❌ Referenced (crash)	✅ Removed completely
Token consumption model	Full batch marked 'used'	Uniform child-slice architecture (parent decremented, child inserted)
Quantity awareness	❌ Unit face value only	✅ token_value × requested_qty
Concurrency control	FOR UPDATE (no ORDER BY)	ORDER BY t.id ASC FOR UPDATE (deadlock-safe)
Voucher_no collision	WHILE loop only	WHILE loop + SAVEPOINT retry loop
Amount guard	v_total_settlement <= 0 check	✅ Same, preserved
Audit log	Non-canonical action_type = 'voucher'	✅ Canonical action_type = 'CREATE'
4.2 Token Consumption Accounting Model (Uniform Child Slice Architecture)
Under Migration 03's design, when a voucher settles against token batch with remaining_quantity = R, token_value = V, and requested allocation qty = Q:

Parent row AFTER:
  remaining_quantity = R - Q
  total_amount       = (R - Q) × V
  usage_status       = 'used' if (R - Q) = 0, else 'available'
  used_against_voucher_id = NULL  ← parent retains origin identity
Child row (new):
  quantity           = Q
  remaining_quantity = 0          ← fully consumed slice
  total_amount       = Q × V
  usage_status       = 'used'
  parent_transaction_id = parent.id
  used_against_voucher_id = voucher.id
  shift_id           = NULL       ← drawer protection
  type               = v_rec.type (copied from parent)
Accounting correctness: The total book value is conserved: parent (R-Q)×V + child Q×V = R×V (original total). ✅

Residual book value risk (U-6 variant for vouchers): If a parent batch is partially consumed across multiple vouchers, the residual correctly decrements each time. This is the intended partial-batch model and is safe.

Type propagation risk (U-3): The child row inherits type from the parent via v_rec.type. The live batch has type = 'shop_retained'. The type CHECK constraint permits 'shop_retained'. However, whether 'shop_retained' is the semantically correct type for a child consumption slice (vs 'settle_vendor' or 'redeemed') is a business rule question, not a technical defect. The constraint won't reject it — but reporting queries filtering on type for "settled against supplier" flows may need 'shop_retained' explicitly included.

4.3 API Compatibility
Return shape comparison:

Key	Migration 03 returns	API expects (route.ts L192–204)
voucher_id	✅	✅
voucher_no	✅	✅
amount	✅ (v_total_settlement)	✅
cash_paid_amount	✅	✅
tokens_applied_amount	✅	✅
updated_balance	✅	✅
date	✅	✅
voucher_type	✅	✅
party_type	✅	✅
party_id	✅	✅
party_name	✅	✅
All 11 expected return keys are present in Migration 03's JSONB return object. ✅

RPC routing (U-7): PostgREST uses function argument name matching for JSONB body dispatch. When rpcPayload contains p_token_allocations, PostgREST must route to the (uuid, jsonb, jsonb) overload. This works because the parameter name p_token_allocations exists only in that overload. The (uuid, jsonb, uuid[]) overload uses p_token_ids. PostgREST typically resolves by matching named parameters. This has not been tested. Staging validation is required.

4.4 Pre-Execution Checks Required
 Confirm type CHECK constraint allows the type values of all live usage_status='available' token batches (already confirmed: 'shop_retained' is in the allowed set ✅)
 Confirm brand_name, series_name, unit_name are NOT NULL in live parent batches that may be allocated (these are NOT NULL in the schema; the child INSERT copies them from parent — if any parent has NULL these columns, the INSERT will fail)
 Verify constraint token_transactions_quantity_check (quantity > 0) — child insert uses v_rec_qty which is validated >= 1 before INSERT ✅
 Confirm uq_vouchers_tenant_voucher_no constraint name matches what Migration 03 checks in GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME — confirmed in live schema ✅
Live check needed (Phase 3 preflight): SELECT id, brand_name, series_name, unit_name FROM token_transactions WHERE usage_status = 'available' AND (brand_name IS NULL OR series_name IS NULL OR unit_name IS NULL) — must return zero rows.

5. Proposed Fix: Migration 04 — create_purchase_atomic Valuation
5.1 Core Changes vs Baseline (20261013_01)
Aspect	Baseline (_01 = live)	After Migration 04
Token accumulator	+= token_value (unit only)	+= token_value × remaining_quantity
Step 2 FOR UPDATE	Without ORDER BY (U-2)	ORDER BY id ASC FOR UPDATE
NULL guard	COALESCE(v_token.token_value, 0) preserved	✅ Same
Step 4 remaining_quantity zero-out	Not present	remaining_quantity = 0
Step 4 total_amount zero-out	Not present	total_amount = 0
Validation guard for NULL elements	Added in _04 (lines 109–111)	Not in _01
Duplicate ID guard	Added in _04 (lines 114–116)	Not in _01
5.2 Full-Batch Consumption Model (U-6 Analysis)
Migration 04 consumes the entire available quantity of every token passed in p_token_ids. There is no partial allocation for purchases — the entire remaining_quantity of each batch row is consumed atomically.

This is consistent with the purchase use-case where a stockpile of tokens is fully applied to a single purchase bill. The voucher use-case (Migration 03) supports partial allocation via requested_qty because a supplier may be paid incrementally.

Risk for the live batch: The single live active batch (qty=14, remaining_quantity=14, token_value=400, total=5600) would be fully consumed and zeroed in the first purchase that references it. This is by design if the business intent is full-batch settlement. The plan should explicitly confirm this with the business owner before executing Migration 04.

U-6 Resolution Required Before Phase 3: Confirm with business owner whether the live 14-unit batch is intended to be fully consumed in one purchase or partially consumed across multiple purchases.

5.3 Step 2 vs Step 4 Consistency
After Migration 04:

Step 2 sums token_value × remaining_quantity for each token
Step 4 zeros remaining_quantity = 0 and total_amount = 0
These are consistent: v_tokens_amount reflects the full pre-consumption value of all tokens in the request, and Step 4 zeroes them out. ✅

5.4 remaining_quantity Depletion Check
The live create_purchase_atomic (migration 01 baseline) checks remaining_quantity <= 0 indirectly via usage_status = 'used'. Migration 04 adds an explicit remaining_quantity guard:

sql
IF COALESCE(v_token.remaining_quantity, 0) <= 0 THEN
  RAISE EXCEPTION 'Token % is depleted', v_token.id;
END IF;
This is a correct hardening — it catches the edge case where a token has been partially consumed (batch depleted by an earlier migration 03 voucher settlement) before a purchase attempt.

5.5 Pre-Execution Checks Required
 Confirm no active token rows have remaining_quantity = 0 and usage_status = 'available' (inconsistent state that would cause migration 04 to immediately raise "Token depleted") — Live check needed
 Confirm business intent re: full-batch vs partial-batch consumption for purchases (U-6)
6. Rollback Design Assessment
6.1 Rollback 03 — Safe Containment
Drops: create_voucher_atomic(uuid, jsonb, jsonb) — the new canonical JSONB overload
Restores: create_voucher_atomic(uuid, jsonb, uuid[]) — baseline UUID[] overload without used_date

Assessment:

The restored function is safe — no used_date reference, correct constraint compliance
Token accounting regression: accumulates unit face value only, no quantity multiplication (same as current buggy state for purchase, but acceptable for rollback)
Child slice rows already inserted by Migration 03 during its live window are not reversed — they remain in token_transactions with usage_status = 'used'. Only function DDL is reverted
The parent remaining_quantity decrements already committed also are not reversed — rollback does not restore token balances
This is explicitly documented in rollback 03's header. The plan should confirm the operations team understands this before authorizing Migration 03 execution.

Audit log semantic regression (U-4): Rollback 03 writes action_type = 'voucher' (non-canonical). Since action_type is nullable with no CHECK constraint, this is not a DB error. The risk is in reporting/analytics that filter on action_type. This is acceptable for an emergency containment scenario.

6.2 Rollback 04 — Baseline Restoration
Restores: Exact definition from 20261013_01 (audit-corrected but valuation-buggy function)

Assessment:

Restores BUG-PA-01 (unit-only accumulation) — a known regression, documented and acceptable for rollback
Does NOT restore remaining_quantity = 0 zeroing to pre-migration-04 rows — already-committed consumption rows retain their zeroed state
Security posture preserved: REVOKE/GRANT identical to forward migration
7. Application Layer Impact
7.1 Purchases API (/api/purchases/route.ts)
Calls create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) — signature unchanged across _01, _04
Passes p_token_ids: tokenIds.length > 0 ? tokenIds : null — compatible with both baseline and migration 04
Return shape {purchase_id, purchase_no, tokens_applied_amount} — unchanged across all versions ✅
No application code changes required for Migration 04
7.2 Vouchers API (/api/vouchers/route.ts)
Conditionally sends p_token_allocations (new JSONB path) or p_token_ids (legacy UUID[] path)
Currently broken on both paths — p_token_allocations hits 42883; p_token_ids hits 42703
After Migration 03: Both paths become functional
p_token_allocations → routes to new (uuid, jsonb, jsonb) overload
p_token_ids → routes to restored (uuid, jsonb, uuid[]) legacy wrapper
No application code changes required — API is already written for the post-migration state (forward-deployed intentionally, per F-13)
7.3 UI Components (Downstream Consumers)
The UI components consuming the vouchers API (e.g., CustomerDetailModal.tsx, PurchaseView.tsx visible in open tabs) are not directly affected by function-level changes. They interact via the API layer only. No UI changes are required.

8. Regression Test Requirements
Note: No tests may be executed in Phase 2. This section defines what tests must be designed and executed in Phase 3 (Staging Validation) before any production migration.

8.1 Required Tests for Migration 03 (create_voucher_atomic)
Test ID	Scenario	Expected Outcome
T3-01	Voucher with p_token_allocations = [{token_id, quantity: N}] where N < remaining_quantity	Voucher created, parent decremented, child slice inserted, balance adjusted ✅
T3-02	Voucher with N = remaining_quantity (full batch allocation)	Parent transitions to usage_status = 'used' ✅
T3-03	Voucher with N > remaining_quantity	RAISES: "Requested quantity % exceeds available" ✅
T3-04	Voucher with already-used token	RAISES: "Token % is not available for settlement" ✅
T3-05	Voucher with duplicate token_id in allocations	RAISES: "Duplicate token IDs supplied" ✅
T3-06	Voucher with p_token_ids (legacy wrapper)	Routes via UUID[] overload → JSONB canonical → success ✅
T3-07	Voucher with cash only (p_token_allocations = null)	Works — token path skipped ✅
T3-08	Voucher with amount = 0 AND p_token_allocations = []	RAISES: "Total settlement must be > 0" ✅
T3-09	Concurrent vouchers both referencing same token batch (concurrency test)	Second transaction raises on lock, no double-spend ✅
T3-10	Child slice shift_id is NULL (drawer protection)	shift_id = NULL confirmed in inserted child ✅
T3-11	Supplier balance updated correctly (cash + tokens)	current_balance -= (v_amount + v_tokens_amount) confirmed ✅
T3-12	Audit log written with action_type = 'CREATE' and entity_type = 'voucher'	Canonical audit contract ✅
T3-13	RPC routing via PostgREST for JSONB payload (U-7)	PostgREST resolves to (uuid, jsonb, jsonb) overload successfully
8.2 Required Tests for Migration 04 (create_purchase_atomic)
Test ID	Scenario	Expected Outcome
T4-01	Purchase with token batch (qty=N, value=V) → tokens_applied_amount = N×V	Correct multi-unit valuation ✅
T4-02	Purchase without tokens	tokens_applied_amount = 0, no token table touched ✅
T4-03	Purchase with depleted token (remaining_quantity = 0)	RAISES: "Token % is depleted" ✅
T4-04	Purchase with already-used token	RAISES: "Token % has already been applied" ✅
T4-05	After purchase: remaining_quantity = 0, total_amount = 0 on token row	Full-batch zero-out confirmed ✅
T4-06	Concurrent purchases both referencing same token (ORDER BY id ASC locking)	No deadlock, correct serialization ✅
T4-07	Purchase with NULL in token array	RAISES: "Token ID array cannot contain NULL elements" ✅
T4-08	Purchase with duplicate token IDs	RAISES: "Duplicate token IDs" ✅
T4-09	Return purchase (type='return') with tokens	Token valuation and balance logic for returns verified
8.3 Required Integration Tests (API-Level)
Test ID	Scenario
I-01	POST /api/vouchers with token_allocations array → 200 success, correct amounts in response
I-02	POST /api/vouchers with applied_token_ids array (legacy path) → 200 success
I-03	POST /api/vouchers with both paths simultaneously → only token_allocations path taken
I-04	POST /api/purchases with applied_token_ids → tokens_applied_amount = sum(qty×value)
I-05	POST /api/vouchers with invalid token_id format → 400 error
I-06	POST /api/vouchers with already-used token → 500 with DB error message
9. Staging Requirements
Phase 3 prerequisites — do not begin without all items satisfied:

Staging DB: A Supabase branch or dedicated project that mirrors the live schema at 20261013001803 (last applied migration). This must be created and verified before any migration runs.

Staging data seed: At minimum, one active token batch with quantity > 1 (to exercise quantity-aware valuation). Ideally matches live data profile: qty=14, token_value=400.

Migration CLI verification: Confirm that supabase db push or supabase migration up on the staging project applies _02, _03, _04 in correct sequence without errors.

Preflight query set: The following SQL queries must be executed on the staging DB immediately after migration, before any functional test:

SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'create_voucher_atomic' — must return two rows (both overloads)
SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'create_purchase_atomic' — must return one row with correct signature
SELECT 'used_date' column check: SELECT COUNT(*) FROM information_schema.columns WHERE table_name='token_transactions' AND column_name='used_date' — must be 0
Rollback drill: Execute rollback 03 and rollback 04 on staging after successful forward migration, then re-apply — prove the cycle is reversible.

10. Dependencies and Ordering
Phase 3 Staging Prerequisites
  └─ Staging branch created and seeded
  └─ Preflight SQL checks executed
       └─ [02] apply and verify (constraint recreation)
            └─ [03] apply and verify (overload inventory, function signature)
                 └─ T3-01 through T3-13 executed on staging
                      └─ [04] apply and verify
                           └─ T4-01 through T4-09 executed on staging
                                └─ I-01 through I-06 executed (API level)
                                     └─ Gate C: All tests pass → Phase 4 Production Migration authorized
11. Acceptance Criteria
All criteria must be satisfied before production migration can be authorized. Migration readiness is NOT claimed.

AC-ID	Criterion	Verifiable By
AC-01	create_voucher_atomic(uuid, jsonb, jsonb) overload exists in DB post-03	pg_proc query
AC-02	create_voucher_atomic(uuid, jsonb, uuid[]) overload exists in DB post-03	pg_proc query
AC-03	No used_date reference in either live function definition	pg_get_functiondef
AC-04	T3-01 through T3-13 all pass on staging	Test execution logs
AC-05	T4-01 through T4-09 all pass on staging	Test execution logs
AC-06	I-01 through I-06 all pass on staging	API test execution logs
AC-07	Rollback 03 and 04 both execute without error on staging	Rollback execution logs
AC-08	Live preflight confirms no usage_status values outside the Migration 02 allowed set	Query result
AC-09	Live preflight confirms no brand_name / series_name / unit_name NULLs in available token batches	Query result
AC-10	Business owner explicitly confirms full-batch consumption model for purchases (U-6)	Written confirmation
AC-11	U-7 (PostgREST overload routing) confirmed by staging API test I-01	Test execution
AC-12	Rollback-drill on staging shows function can be restored without error	Test execution logs
12. Open Questions Requiring Business Owner Input
U-6 — Partial vs Full-Batch Purchase Consumption: Is the intent of create_purchase_atomic to consume the full remaining_quantity of each token batch in a single purchase? Or should partial allocation (like vouchers) be supported? This has direct implications for the live 14-unit batch.

U-3 — Child Slice type Field: When a voucher settlement consumes a type='shop_retained' parent token, should the child slice also carry type='shop_retained', or should it use type='settle_vendor'? This affects downstream reporting queries that filter by type.

U-4 — Rollback Audit Semantics: Is it acceptable for the rollback 03 period (if rollback is ever executed) to produce audit log rows with action_type = 'voucher' instead of the canonical action_type = 'CREATE'? If not, rollback 03 should be amended.

13. What Is NOT Proposed (Out of Scope for This Plan)
No application code changes — all three application files (route.ts for vouchers, route.ts for purchases) are already written correctly for the post-migration state
No new SQL functions — all remediation is contained within the four existing migration/rollback artifacts
No schema additions — no new columns, tables, or indexes required
No backfill of historical data — past purchase records with understated tokens_applied_amount (BUG-PA-01) are not corrected by this plan
If historical backfill is required, it must be planned and authorized separately as a data correction exercise. This plan intentionally excludes it.

Summary
Item	Status
DEF-01 (used_date crash)	Fix confirmed correct in Migration 03
DEF-02 (valuation defect)	Fix confirmed correct in Migration 04
DEF-03 (forward-deployed API)	No code change needed — Migration 03 closes the gap
DEF-04 (full-batch purchase)	Business confirmation required before Phase 3
Migration ordering	02 → 03 → 04, staged and sequential
Application changes required	None
Rollback safety	DDL-only revert; committed data changes not reversed (documented and accepted)
Phase 3 gate	All 12 Acceptance Criteria must pass
Migration readiness	NOT CLAIMED — Phase 3 staging validation required
Phase 2 is complete. Awaiting explicit Phase 3 authorization.

# AGENTS NEXT REPLY:
Aap ne remediation plan ke 6 bohot ahem aur sensitive gaps point out kiye hain. In sab ko live database catalog, migration scripts, application routes (/api/vouchers, /api/purchases), aur frontend components (FinancialLedgers.tsx, PurchasesView.tsx) ke khilaaf forensically verify kar liya gaya hai.

Neeche har issue ki exact technical verification, root cause analysis, aur zaroori plan remediation tafseel se darj hai:

Issue 1 (Critical): Voucher Balance Double-Counting Risk
Sawaal: v_amount, v_total_settlement, aur v_tokens_amount ki exact definitions kya hain? Supplier balance cash + token se update ho, lekin tokens do baar count na hon.

1. Code & Formula Verification
Migration 20261013_03_fix_create_voucher_atomic.sql mein variables ki definitions yeh hain:

v_amount (Cash Component):
sql
v_amount := (p_voucher_data->>'amount')::NUMERIC;
Yeh parameter sirf aur sirf cash amount represent karta hai (Section 2: "Independent Cash Component Validation").
v_tokens_amount (Token Component):
sql
v_tokens_amount := v_tokens_amount + (v_rec.token_value * v_rec_qty);
Yeh applied tokens ki calculated total value hai (SUM(quantity * token_value)).
v_total_settlement (Combined Settlement):
sql
v_total_settlement := v_amount + v_tokens_amount;
Supplier Balance Update:
sql
UPDATE suppliers
   SET current_balance = current_balance - v_total_settlement
 WHERE id = v_party_id AND tenant_id = p_tenant_id;
Aur vouchers table ke header column amount mein bhi v_total_settlement store hota hai.
2. Double-Counting Risk kahan paida hota hai?
Frontend (FinancialLedgers.tsx): Lines 305–367 mein frontend logic yeh karti hai:
ts
const cash = parseFloat(receiptAmount) || 0;
// Payload:
amount: cash,
token_allocations: tokenAllocations
Frontend amount field mein sirf cash bhejti hai.
Double-Counting Ka Khatra: Agar koi external caller, API consumer, ya future UI developer /api/vouchers ko yeh samajh kar call kare ke amount ka matlab "Total Voucher Amount" hai (maslan 10,000 Total: 4,000 Cash + 6,000 Tokens), aur payload mein amount: 10000 ke sath token_allocations (value 6,000) pass kar de, to RPC yeh karegi: $$\text{v_total_settlement} = 10{,}000 + 6{,}000 = 16{,}000$$ Is se supplier balance se 16,000 deduct ho jayenge jabke payment sirf 10,000 ki thi — tokens do baar count ho jayenge!
Plan Modification / Fix:
Strict Contract Clarification: API aur RPC documentation mein p_voucher_data->>'amount' ko explicitly define kiya jaye ke yeh "cash_amount" hai (agar cash zero hai to 0 pass karein).
API Layer Par Guard: Agar request body mein amount aur token_allocations dono aarahe hon, to API route check kare ya caller cash_amount explicitly specify kare.
Baseline Parity: Historical baseline 20261005_04 mein suppliers.last_payment_amount = v_total_settlement aur last_payment_date = v_date update hota tha, jo 20261013_03 mein omit ho gaya hai — is ko restore karna zaroori hai.
Issue 2 (High): Rollback aur Re-Apply Data Safety
Sawaal: Child slices aur parent quantity changes committed rehne par re-applying migration same tokens ko dobara consume to nahi karegi?

1. DDL Rollback vs DML Data Reality
Migration 03 aur 04 sirf DDL hain (CREATE OR REPLACE FUNCTION).
rollback_20261013_03_... aur rollback_20261013_04_... bhi sirf DDL restore karte hain.
Agar forward migration ke dauran transactions execute hon:
Child consumption slice create hoti hai (usage_status = 'used', remaining_quantity = 0, used_against_voucher_id = <voucher_id>).
Parent batch decrement hoti hai (remaining_quantity = remaining_quantity - requested_qty). Agar remaining quantity 0 ho jaye to parent ka usage_status = 'used' ho jata hai.
Supplier balance deduct ho chuka hota hai.
Agar Migration Rollback ki jaye, to database ka committed data revert nahi hota! Child slices wahan rehti hain aur parent quantity kam hi rehti hai.
2. Re-Apply Karne Par Re-Consumption ka Analysis
Kya same tokens dobara consume honge? Nahi.
Child Slice Re-submission: Agar koi child slice ki UUID pass karega, to RPC ke initial checks foran fail ho jayenge:
sql
IF v_rec.usage_status IS DISTINCT FROM 'available' THEN ... RAISE EXCEPTION;
IF v_rec.used_against_voucher_id IS NOT NULL THEN ... RAISE EXCEPTION;
IF v_rec.remaining_quantity <= 0 THEN ... RAISE EXCEPTION;
Is liye child row dobara consume nahi ho sakti.
Parent Batch Re-submission: Parent batch ka remaining_quantity already reduce ho chuka hai. Agar parent 0 ho chuka hai to wo reject ho jayega. Agar partially remaining hai to wo sirf bachi hui quantity tak consume ho sakta hai.
Asal Risk (Orphaned Business State): Agar rollback kisi functional defect ki wajah se execute kiya gaya, to user-level vouchers aur token deductions database mein "orphaned" reh jayenge. Re-applying migration se tokens dubara consume to nahi honge, lekin rollbacked transactions ko reverse/void karne ke liye ek explicit data compensation script (DML reconciliation) plan mein shamil hona lazmi hai.
Issue 3 (High): Purchase Return Behavior (type = 'return')
Sawaal: type='return' par token valuation, supplier balance direction aur token consumption semantics. Sirf ek test row ka result kaafi nahi.

1. Code Forensics in create_purchase_atomic (20261013_04)
Tokens Valuation & Consumption (Lines 107–169): Chahe v_purchase_type 'purchase' ho ya 'return', agar p_token_ids pass ho jayein:
Tokens stockpile se consume ho jate hain (remaining_quantity = 0, usage_status = 'used').
v_tokens_amount := SUM(token_value * remaining_quantity) calculate ho jata hai.
Supplier Balance Update (Lines 240–245):
sql
IF NOT v_is_return THEN
  v_new_balance := v_current_bal + v_due_amount;
ELSE
  v_cash_received := v_paid_amount;
  v_return_credit := GREATEST(0, v_net_total - v_cash_received);
  v_new_balance   := v_current_bal - v_return_credit;
END IF;
Contradiction:
v_return_credit calculate karte waqt v_tokens_amount ka koi hissa ya reference shamil nahi hai!
UI (PurchasesView.tsx Line 286): Return ke waqt netBillValue = Math.max(0, netBillValueBeforeTokens - tokensAppliedAmount) karta hai.
Commercial Semantics Anomaly: Jab shop supplier ko maal wapas (Return) karti hai, to supplier ne shop ko credit ya refund dena hota hai. Shop apna paint token (jo supplier ka payable tender tha) return mein kyun "burn" karegi? Agar return par tokens burn kar diye gaye to shop ka token stockpile zaya ho jayega aur supplier se milne wala return credit ulta kam ho jayega!
Plan Modification:
create_purchase_atomic mein strict business rule enforce hona chahiye:
sql
IF v_is_return AND p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
  RAISE EXCEPTION 'Stockpile tokens cannot be applied to purchase returns';
END IF;
PurchasesView.tsx mein jab purchaseType === 'return' ho to "Apply Stockpiled Tokens" section ko explicitly disable/hide kiya jaye.
Issue 4 (High): Error Response Contract
Sawaal: I-06 mein raw database error message expose karna acceptance criterion nahi hona chahiye. Client ko safe error response mile aur internal details server-side logs mein rahen.

1. Current State Violation
Current src/app/api/vouchers/route.ts (Line 228–230):
ts
} catch (error: any) {
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}
PostgreSQL ka internal plpgsql exception message (table names, constraints, function stack traces) seedha client ko HTTP 500 ke roop mein bhej raha hai.
Plan mein I-06 ko "POST /api/vouchers with already-used token → 500 with DB error message" ke tor par likhna security aur architectural compliance (OWASP Information Disclosure) ke khilaaf hai.
2. Plan Modification
Acceptance Criteria Update:
Client Response: Safe, sanitized error message (e.g., { success: false, error: "One or more selected tokens are no longer available", code: "TOKEN_UNAVAILABLE" }) aur appropriate HTTP 400 ya 409 status code.
Server Logs: Full error.message aur Postgres SQLSTATE 42703/P0001 server console par console.error ke zariye log hon.
Test I-06 ka criteria change ho kar yeh banega:
Status: 400 ya 409 (Client Error / Conflict), not 500.
Client Body: Safe user-facing message, no raw SQL/schema diagnostics.
Server Output: Diagnostic message logged internally.
Issue 5 (High): Migration 02 Atomicity
Sawaal: Agar constraint DROP ho jaye aur ADD fail ho, to migration runner ka transaction behavior aur constraint restoration verify karo.

1. Code Inspection (20261013_02_allow_used_token_usage_status.sql)
File content:

sql
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_usage_status_check;
ALTER TABLE public.token_transactions
  ADD CONSTRAINT token_transactions_usage_status_check
  CHECK (usage_status IN ('available', 'settled', 'used', 'written_off', 'reversed', 'n_a'));
PostgreSQL Transaction Semantics: Postgres DDL transactional hoti hai. Supabase CLI jab migration file run karti hai to poori file ko ek single BEGIN ... COMMIT block ke andar wrap karti hai. Agar line 18 par ADD CONSTRAINT fail ho jaye (maslan existing data constraint satisfy na kare), to transaction rollback ho jati hai aur dropped constraint restore ho jati hai.
Lekin Standalone / Dashboard Execution Risk: Agar kisi ne file ko Supabase Dashboard SQL Editor ya raw psql connection se run kiya jahan autocommit on ho, to DROP commit ho jayega aur ADD fail hone par table baghair constraint ke reh jayegi.
2. Live Database Reality (Forensic Finding)
Catalog query se verify hua ke:

20261013_02_allow_used_token_usage_status already live database par apply ho chuki hai (version: 20261013001803).
Live database par constraint already mojood hai: CHECK ((usage_status = ANY (ARRAY['available'::text, 'settled'::text, 'used'::text, 'written_off'::text, 'reversed'::text, 'n_a'::text])))
Plan Modification (Staging & Safety): Staging aur clean CI/CD environments ke liye script ko single atomic statement banana chahiye:
sql
ALTER TABLE public.token_transactions
  DROP CONSTRAINT IF EXISTS token_transactions_usage_status_check,
  ADD CONSTRAINT token_transactions_usage_status_check
  CHECK (usage_status IN ('available', 'settled', 'used', 'written_off', 'reversed', 'n_a'));
Single ALTER TABLE statement ke andar DROP aur ADD hamesha completely atomic hote hain.
Issue 6 (Medium): Migration Version Mapping
Sawaal: Actual filenames, embedded version headers aur schema_migrations ledger ko compare karo. _01, _02 jaise suffixes se order assume nahi karna.

1. Ledger Comparison
Live catalog query (supabase_migrations.schema_migrations) ka actual data:

supabase_migrations.schema_migrations.version	Ledger name	Local File in supabase/migrations/	Status
20261012235622	20261013_01_fix_create_purchase_atomic_audit_log	20261013_01_fix_create_purchase_atomic_audit_log.sql	APPLIED
20261013001803	20261013_02_allow_used_token_usage_status	20261013_02_allow_used_token_usage_status.sql	APPLIED
(None)	(Not in ledger)	20261013_03_fix_create_voucher_atomic.sql	PENDING
(None)	(Not in ledger)	20261013_04_fix_create_purchase_atomic_valuation.sql	PENDING
2. Critical Versioning Hazard
Supabase CLI standard format 14-digit timestamp hota hai: YYYYMMDDHHMMSS_<name>.sql.
Local repository mein filenames 20261013_03_... hain.
Agar Supabase CLI runs:
Wo underscore se pehle wala hissa version manti hai (20261013 = 8 digits).
Database mein last version 20261013001803 (14 digits) hai.
Numerically 20261013 < 20261013001803!
Supabase CLI 20261013_03 ko out-of-order ya invalid timestamp flag kar sakti hai ya skip kar sakti hai!
Plan Modification:
Suffix _03 aur _04 ke sahare migration order assume nahi kiya ja sakta.
Migration files ko canonical 14-digit format mein map karna zaroori hai:
Maslan: 20261013010000_20261013_03_fix_create_voucher_atomic.sql
20261013020000_20261013_04_fix_create_purchase_atomic_valuation.sql
Ya explicit CLI migration runner configuration verify ki jaye staging par.
Summary: Plan Amendments Checklist
ID	Issue	Severity	Required Plan Amendment
A-01	Voucher double-counting	Critical	Define p_voucher_data.amount as cash_amount strictly; add API validation guard; restore last_payment_amount/date
A-02	Rollback/Re-apply safety	High	Re-consumption guarded by status/quantity checks, but add explicit DML data reconciliation protocol for aborted runs
A-03	Purchase return semantics	High	Reject token usage on returns in RPC (type='return' AND tokens > 0 -> RAISE); disable tokens in UI for returns
A-04	Error contract	High	Replace raw DB error exposure in I-06 with safe HTTP 400/409 envelope; keep raw diagnostics in server logs
A-05	Migration 02 atomicity	High	Live is already applied; combine DROP + ADD into single ALTER TABLE statement for staging/CI portability
A-06	Migration versioning	Medium	Align 8-digit suffix filenames (20261013_03) with 14-digit Supabase CLI ledger convention (20261013HHMMSS)
Yeh 6 updates Phase 2 Fix Plan document mein integrate kar di gayi hain. In ke sath Phase 3 (Staging Validation) ka test harness bilkul safe aur unambiguous ban jata hai.