# Inventory Company Order Sheet & Receipt Printer — Master Task Register

**Document Ref:** `inventory-company-order-sheet-task.md`  
**Related Audit:** [`audit/inventory-company-order-sheet-audit.md`](file:///d:/bestow/p-industry/audit/inventory-company-order-sheet-audit.md)  
**Related Plan:** [`inventory-company-order-sheet-implementation-plan.md`](file:///d:/bestow/p-industry/inventory-company-order-sheet-implementation-plan.md)  
**Target Store:** Tawakkal Paint House (`TPH` — `36da36b6-c1d2-448c-b685-3d7f354fdfca`)  
**Status:** Ready for Execution (All Architectural Gaps Closed)  

---

## Task Progress Overview

- [ ] **Phase 1: Receipt & Document Template Generators**
  - [ ] **Task 1.1:** Create `src/components/inventory/orderSheetPrintTemplates.ts` with parameterized thermal receipt generator (`80mm` and `58mm`)
  - [ ] **Task 1.2:** Implement A4 full-page formal purchase demand generator with write-in lines for phone/address
  - [ ] **Task 1.3:** Implement dynamic packaging aggregation calculator (`computePackagingTotals`) grouping by distinct units
  - [ ] **Task 1.4:** Generate non-persistent timestamp reference `DEM-YYYYMMDD-HHMM` labeled `(Timestamp Ref)`

- [ ] **Phase 2: Interactive Order Sheet Modal Component**
  - [ ] **Task 2.1:** Scaffold `src/components/inventory/CompanyOrderSheetModal.tsx`
  - [ ] **Task 2.2:** Implement Brand filter dropdown defaulting to first brand (e.g. `GOBI'S`) + instant search
  - [ ] **Task 2.3:** Implement cross-brand persistent draft state (`Record<string, number>`)
  - [ ] **Task 2.4:** Implement interactive quantity grid with stepper controls (`-`, `+`, direct numeric input)
  - [ ] **Task 2.5:** Implement "Select All 0 Stock" action (scoped to active view, sets `qty = 1` for `stock_qty <= 0`)
  - [ ] **Task 2.6:** Implement modal close protection (confirm dialog if `qty > 0` items exist)
  - [ ] **Task 2.7:** Add thermal width selector toggle (80mm default vs 58mm) and print triggers using `printViaIframe`

- [ ] **Phase 3: Integration into Inventory UI**
  - [ ] **Task 3.1:** Import `ClipboardList` from `lucide-react` in `src/components/StockInventory.tsx`
  - [ ] **Task 3.2:** Import `CompanyOrderSheetModal` into `src/components/StockInventory.tsx`
  - [ ] **Task 3.3:** Add `[Company Order Sheet]` action button in the inventory top toolbar
  - [ ] **Task 3.4:** Bind modal visibility state and pass catalog items and tenant metadata

- [ ] **Phase 4: Quality Assurance & Verification**
  - [ ] **Task 4.1:** TypeScript compiler validation (`npx tsc --noEmit`)
  - [ ] **Task 4.2:** Automated zero-price audit check (verify templates contain 0 price/tax/rate keywords)
  - [ ] **Task 4.3:** Test cross-brand ordering (e.g., Gobi's + Reliance) and multi-brand sub-headers on receipt
  - [ ] **Task 4.4:** Verify zero database impact (0 API mutations, strictly in-memory)
