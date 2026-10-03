# PHASE 9 AUDIT TASK LIST — REPORTS / DASHBOARDS / RECONCILIATION

> **Scope Reset Note:** The previous Phase 9 file was a collaborator phase-drift covering the AI Paint Token system.
> This file replaces it with the correct Phase 9 scope: Reports, Dashboards & Reconciliation.
> **Human Gate:** Do NOT implement any task until explicit human approval is granted.

---

- [ ] **Task 9.1: Exclude Cancelled Invoices Across All Reporting Layers** (FINDING-REP-001 · CRITICAL)
  - [ ] Add `.neq('status', 'cancelled')` filter to `src/app/api/ledgers/route.ts:78-86`
  - [ ] Add cancelled-invoice exclusion to `src/components/ceo-panel/OverviewView.tsx:157`
  - [ ] Add cancelled-invoice exclusion to `src/components/ceo-panel/DayCloseView.tsx:124`
  - [ ] Add cancelled-invoice exclusion to `src/app/api/shifts/route.ts:244-266`
  - [ ] Add cancelled-invoice exclusion to `src/components/ShiftDrawer.tsx`
  - [ ] Add cancelled-invoice exclusion to `src/components/SalesHistory.tsx`

- [ ] **Task 9.2: Fix Double Return Deduction in DayClose Fallback Formula** (FINDING-REP-002 · HIGH)
  - [ ] Remove redundant `- cashReturns` from `src/components/ceo-panel/DayCloseView.tsx:182`
  - [ ] Verify fallback formula matches `ShiftDrawer` output exactly

- [ ] **Task 9.3: Incorporate Supplier Cash Payments into Day Close** (FINDING-REP-003 · HIGH)
  - [ ] Fetch `supplierCashPaid` inside `DayCloseView.tsx` (or pass via shift metadata)
  - [ ] Deduct `supplierCashPaid` in the `DayCloseView` reconciliation table
  - [ ] Update `src/app/api/shifts/route.ts` to expose supplier cash paid per shift

- [ ] **Task 9.4: Bind Supplier Purchases to Shift ID (Fix MF-005 Root Cause)** (FINDING-REP-004 · HIGH)
  - [ ] Write migration: add nullable `shift_id UUID REFERENCES shifts(id)` to `public.purchases`
  - [ ] Pass `shift_id` from POS when recording a cash register purchase
  - [ ] Update `PATCH /api/shifts` query to `.eq('shift_id', id).eq('payment_type', 'cash')`
  - [ ] Update `src/components/PurchasesView.tsx` to attach `shift_id` on submit

- [ ] **Task 9.5: Standardise Gross / Net Sales Definitions Across CEO Panels** (FINDING-REP-005 · MEDIUM)
  - [ ] Create `src/utils/salesMath.ts` with shared `grossSales`, `netSales`, and `discounts` formulas
  - [ ] Refactor `src/components/ceo-panel/OverviewView.tsx` to use `salesMath`
  - [ ] Refactor `src/components/ceo-panel/SalesView.tsx` to use `salesMath`
  - [ ] Refactor `src/components/SalesHistory.tsx` to use `salesMath`

- [ ] **Task 9.6: Wire Invoice Cancellation Button in Sales History UI** (FINDING-REP-006 · MEDIUM)
  - [ ] Add "Cancel / Void Invoice" button in `src/components/SalesHistory.tsx` (manager role only)
  - [ ] Add confirmation dialog with mandatory cancellation reason field
  - [ ] Invoke `DELETE /api/invoices?id=&tenant_id=&reason=` on confirmation
  - [ ] Refresh invoice list and show toast on success

- [ ] **Task 9.7: Paginate Sales History & Scope CEO Overview by Date** (FINDING-REP-007 · MEDIUM)
  - [ ] Add cursor-based "Load More" pagination to `src/components/SalesHistory.tsx` (currently hard-capped at 500)
  - [ ] Pass `startDate` / `endDate` params to `GET /api/invoices` in `src/components/ceo-panel/OverviewView.tsx` (currently fetches up to 5,000 invoices unbounded)
