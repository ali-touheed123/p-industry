# PHASE 9 IMPLEMENTATION PLAN — REPORTS / DASHBOARDS / RECONCILIATION

**Date:** October 3, 2026  
**Auditor:** Master Forensic Auditor  
**Project:** PyntFlow POS & Industrial ERP (`p-industry`)  
**Phase:** PHASE 9 — Reports / Dashboards / Reconciliation  
**Execution Rule Adherence:** PLANNING ONLY — NO CODE OR SCHEMA MODIFIED  
**Human Gate Status:** NOT IMPLEMENTED — AWAITING EXPLICIT HUMAN APPROVAL

---

## 1. Overview

This implementation plan provides the engineering remediation path for the 7 verified defects identified in the Phase 9 Forensic Audit covering reports, dashboards, register reconciliation, and financial ledgers.

---

## 2. Planned Changes

### PLAN-REP-001: Exclude Cancelled Invoices Across Ledgers, Dashboards, and Shift Reports
- **Finding Reference:** `FINDING-REP-001` (Severity: CRITICAL)
- **Problem:** Cancelled invoices (`status = 'cancelled'`) remain in the database and are erroneously aggregated into customer ledger balances, CEO revenue/profit metrics, and shift expected cash drawer totals.
- **Evidence:**
  - `src/app/api/ledgers/route.ts:78-86` lacks `.neq('status', 'cancelled')`.
  - `src/components/ceo-panel/OverviewView.tsx:157` only filters `invoice_type !== 'return'`.
  - `src/components/ceo-panel/DayCloseView.tsx:124` does not filter out cancelled records.
  - `src/app/api/shifts/route.ts:244-266` queries shift invoices without checking `status != 'cancelled'`.
- **Root Cause:** Invoice cancellation marks `status = 'cancelled'`, but reporting and shift queries assume all records with `tenant_id` are valid active sales.
- **Required Behavior:** Every reporting query, ledger synthesis, and register cash tally must explicitly filter out cancelled invoices (`status != 'cancelled'`).
- **Files Likely Affected:**
  - `src/app/api/ledgers/route.ts`
  - `src/app/api/shifts/route.ts`
  - `src/components/ceo-panel/OverviewView.tsx`
  - `src/components/ceo-panel/DayCloseView.tsx`
  - `src/components/ShiftDrawer.tsx`
  - `src/components/SalesHistory.tsx`
- **Database Objects Likely Affected:** None (schema already has `status` column).
- **Risks:** Historical reports will show lower gross numbers, which is correct because cancelled sales will no longer inflate totals.
- **Regression Risks:** None; voided invoices should never count towards revenue.
- **Required Tests:**
  1. Create a sale for Rs. 5,000 cash, verify it appears in ledger and drawer.
  2. Cancel the sale via `cancel_invoice_atomic`.
  3. Verify the Rs. 5,000 is removed from customer debtor ledger, CEO overview, and expected drawer cash.
- **Verification Criteria:** Ledger statement running balance must match customer `current_balance`.

---

### PLAN-REP-002: Correct Day Close Fallback Cash Formula (Eliminate Double Return Deduction)
- **Finding Reference:** `FINDING-REP-002` (Severity: HIGH)
- **Problem:** `DayCloseView.tsx` subtracts `cashReturns` inside `cashSales` (lines 127–141) and then subtracts `cashReturns` again in line 182.
- **Evidence:** `DayCloseView.tsx:135` (`cashSales = sales - returns`), followed by line 182 (`openAmt + cashSales - cashReturns...`).
- **Root Cause:** Redundant subtraction in the fallback formula.
- **Required Behavior:** Remove the secondary `- cashReturns` from line 182.
- **Files Likely Affected:** `src/components/ceo-panel/DayCloseView.tsx`
- **Database Objects Likely Affected:** None.
- **Risks:** Minimal (pure frontend display formula correction).
- **Required Tests:** Simulate a shift with Rs. 10,000 sales and Rs. 2,000 cash returns. Verify fallback expected cash equals Rs. 8,000 (not Rs. 6,000).
- **Verification Criteria:** Fallback cash formula in `DayCloseView` matches `ShiftDrawer` output exactly.

---

### PLAN-REP-003: Incorporate Supplier Cash Payments into Day Close
- **Finding Reference:** `FINDING-REP-003` (Severity: HIGH)
- **Problem:** `DayCloseView.tsx` omits `supplierCashPaid` from register reconciliation, creating false cash shortages when supplier payments are made from the drawer.
- **Evidence:** `DayCloseView.tsx:182` lacks `supplierCashPaid`, whereas `ShiftDrawer.tsx:310-313` subtracts it.
- **Root Cause:** `DayCloseView.tsx` never fetched or calculated supplier cash disbursements.
- **Required Behavior:**
  1. Fetch shift-linked supplier cash purchases or pass `supplierCashPaid` in shift metadata.
  2. Deduct `supplierCashPaid` in the `DayCloseView` register reconciliation table.
- **Files Likely Affected:**
  - `src/components/ceo-panel/DayCloseView.tsx`
  - `src/app/api/shifts/route.ts`
- **Database Objects Likely Affected:** None.
- **Risks:** Must ensure only physical cash drawer payouts are deducted (not bank/credit purchases).
- **Verification Criteria:** When a cashier records a supplier cash payout of Rs. 10,000, both `ShiftDrawer` and `DayCloseView` report `variance = 0` (MATCHED).

---

### PLAN-REP-004: Isolate Supplier Cash Payments to Explicit Shift ID (Fix MF-005)
- **Finding Reference:** `FINDING-REP-004` (Severity: HIGH)
- **Problem:** In `src/app/api/shifts/route.ts:270-283`, supplier purchases are queried using `.gte('created_at', startTime)` without `shift_id`.
- **Evidence:** Lines 270–283 query by timestamp and deduct non-cash purchases if `paid_amount > 0`.
- **Root Cause:** The `purchases` table currently lacks a foreign key column `shift_id` to bind cash disbursements to the register shift.
- **Required Behavior:**
  1. Add nullable `shift_id UUID REFERENCES shifts(id)` to `public.purchases`.
  2. Pass `shift_id` from POS when recording a purchase paid from the register drawer.
  3. Update `PATCH /api/shifts` to query `.eq('shift_id', id).eq('payment_type', 'cash')`.
- **Files Likely Affected:**
  - `supabase/migrations/` (New migration adding `shift_id` to `purchases`)
  - `src/app/api/purchases/route.ts`
  - `src/app/api/shifts/route.ts`
  - `src/components/PurchasesView.tsx`
- **Database Objects Likely Affected:** `public.purchases`
- **Risks:** Existing purchase rows will have `shift_id = NULL`; fallback to timestamp should only apply to legacy rows.
- **Verification Criteria:** Purchases recorded after shift opening on counter B do not deduct cash from counter A.

---

### PLAN-REP-005: Standardize "Gross Sales" and "Net Sales" Across Executive Panels
- **Finding Reference:** `FINDING-REP-005` (Severity: MEDIUM)
- **Problem:** Inconsistent definitions across `OverviewView`, `SalesView`, and `SalesHistory`.
- **Evidence:**
  - `OverviewView.tsx:161`: Gross = `subtotal`, Net = Gross - Returns.
  - `SalesView.tsx:141`: Net = forward sales `net_total` (returns not subtracted).
  - `SalesHistory.tsx:483`: Gross = `net_total` (post-discount).
- **Root Cause:** Independent calculation implementations authored in different sprints without a shared math utility.
- **Required Behavior:** Create a shared finance utility `src/utils/salesMath.ts` implementing uniform accounting formulas:
  - `Gross Sales` = Sum of pre-discount subtotal of all forward sales.
  - `Discounts` = Sum of line item and invoice-level discounts.
  - `Net Sales` = Gross Sales - Discounts + Delivery Charges - Sales Returns.
- **Files Likely Affected:**
  - `src/utils/salesMath.ts` (New utility)
  - `src/components/ceo-panel/OverviewView.tsx`
  - `src/components/ceo-panel/SalesView.tsx`
  - `src/components/SalesHistory.tsx`
- **Verification Criteria:** Overview, Sales Register, and Sales History display identical Gross and Net figures for any matching date range.

---

### PLAN-REP-006: Implement Invoice Cancellation Action in Sales History UI
- **Finding Reference:** `FINDING-REP-006` (Severity: MEDIUM)
- **Problem:** `DELETE /api/invoices` exists in the backend but has zero invocations in the frontend.
- **Evidence:** Ripgrep confirms 0 calls to `DELETE /api/invoices`. No UI button exists.
- **Root Cause:** Backend procedure was implemented during Task 6.2, but frontend UI wiring in `SalesHistory.tsx` was never completed.
- **Required Behavior:**
  1. Add a "Cancel / Void Invoice" action button in `SalesHistory.tsx` for manager roles.
  2. Display a confirmation dialog with mandatory cancellation reason input.
  3. Invoke `DELETE /api/invoices?id=${id}&tenant_id=${tenantId}&reason=${reason}`.
  4. Refresh invoices and toast confirmation.
- **Files Likely Affected:** `src/components/SalesHistory.tsx`
- **Risks:** Accidental cancellation by junior cashiers.
- **Mitigation:** Protect with manager/CEO role check or PIN confirmation.
- **Verification Criteria:** Clicking "Cancel Invoice" successfully updates invoice status to `cancelled`, reverts stock via `adjust_item_stock`, and voids client balance.

---

### PLAN-REP-007: Paginate Sales History & Add Date Scoping to CEO Overview
- **Finding Reference:** `FINDING-REP-007` (Severity: MEDIUM)
- **Problem:** `SalesHistory.tsx` silently truncates at 500 records; `OverviewView.tsx` overfetches up to 5,000 full invoices without date boundaries.
- **Evidence:** `SalesHistory.tsx:231` (`limit=500`), `OverviewView.tsx:66` (no date parameters).
- **Required Behavior:**
  1. Add cursor-based "Load More" pagination to `SalesHistory.tsx`.
  2. Pass `startDate` and `endDate` to `GET /api/invoices` in `OverviewView.tsx`.
- **Files Likely Affected:**
  - `src/components/SalesHistory.tsx`
  - `src/components/ceo-panel/OverviewView.tsx`
- **Verification Criteria:** Stores with 2,000+ sales can browse all historical invoices; Overview initial payload drops significantly.

---

## 3. Human Approval Gate

**IMPLEMENTATION STATUS:** `NOT IMPLEMENTED — AWAITING HUMAN APPROVAL`  
Do not execute any code changes until explicit authorization is granted.
