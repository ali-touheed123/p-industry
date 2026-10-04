# PHASE 9 AUDIT TASK LIST — REPORTS / DASHBOARDS / RECONCILIATION

> **Scope Reset Note:** The previous Phase 9 file was a collaborator phase-drift covering the AI Paint Token system.
> This file replaces it with the correct Phase 9 scope: Reports, Dashboards & Reconciliation.
> **Human Gate:** Do NOT implement any task until explicit human approval is granted.

---

- [x] **Task 9.1: Exclude Cancelled Invoices Across All Reporting Layers** (FINDING-REP-001 · CRITICAL)
  - [x] Add `.neq('status', 'cancelled')` filter to `src/app/api/ledgers/route.ts:78-86`
  - [x] Add cancelled-invoice exclusion to `src/components/ceo-panel/OverviewView.tsx:157`
  - [x] Add cancelled-invoice exclusion to `src/components/ceo-panel/DayCloseView.tsx:124`
  - [x] Add cancelled-invoice exclusion to `src/app/api/shifts/route.ts:244-266`
  - [x] Add cancelled-invoice exclusion to `src/components/ShiftDrawer.tsx`
  - [x] Add cancelled-invoice exclusion to `src/components/SalesHistory.tsx`

- [x] **Task 9.2: Fix Double Return Deduction in DayClose Fallback Formula** (FINDING-REP-002 · HIGH)
  - [x] Remove redundant `- cashReturns` from `src/components/ceo-panel/DayCloseView.tsx:182`
  - [x] Verify fallback formula matches `ShiftDrawer` output exactly

- [x] **Task 9.3: Incorporate Supplier Cash Payments into Day Close** (FINDING-REP-003 · HIGH)
  - [x] Fetch `supplierCashPaid` inside `DayCloseView.tsx` (or pass via shift metadata)
  - [x] Deduct `supplierCashPaid` in the `DayCloseView` reconciliation table
  - [x] Update `src/app/api/shifts/route.ts` to expose supplier cash paid per shift

- [x] **Task 9.4: Bind Supplier Purchases to Shift ID (Fix MF-005 Root Cause)** (FINDING-REP-004 · HIGH)
  - [x] Write migration: add nullable `shift_id UUID REFERENCES shifts(id)` to `public.purchases`
  - [x] Pass `shift_id` from POS when recording a cash register purchase
  - [x] Update `PATCH /api/shifts` query to `.eq('shift_id', id).eq('payment_type', 'cash')`
  - [x] Update `src/components/PurchasesView.tsx` to attach `shift_id` on submit

- [x] **Task 9.5: Standardise Gross / Net Sales Definitions Across CEO Panels** (FINDING-REP-005 · MEDIUM)
  - [x] Create `src/utils/salesMath.ts` with shared `grossSales`, `netSales`, and `discounts` formulas
  - [x] Refactor `src/components/ceo-panel/OverviewView.tsx` to use `salesMath`
  - [x] Refactor `src/components/ceo-panel/SalesView.tsx` to use `salesMath`
  - [x] Refactor `src/components/SalesHistory.tsx` to use `salesMath`

- [x] **Task 9.6: Wire Invoice Cancellation Button in Sales History UI** (FINDING-REP-006 · MEDIUM)
  - [x] Add "Cancel / Void Invoice" button in `src/components/SalesHistory.tsx` (manager role only)
  - [x] Add confirmation dialog with mandatory cancellation reason field
  - [x] Invoke `DELETE /api/invoices?id=&tenant_id=&reason=` on confirmation
  - [x] Refresh invoice list and show toast on success

- [x] **Task 9.7: Paginate Sales History & Scope CEO Overview by Date** (FINDING-REP-007 · MEDIUM)
  - [x] Add cursor-based "Load More" pagination to `src/components/SalesHistory.tsx` (currently hard-capped at 500)
  - [x] Pass `startDate` / `endDate` params to `GET /api/invoices` in `src/components/ceo-panel/OverviewView.tsx` (currently fetches up to 5,000 invoices unbounded)
