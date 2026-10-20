# Inventory Company Order Sheet & Receipt Printer — Architectural Audit

**Document Ref:** `audit/inventory-company-order-sheet-audit.md`  
**Target Module:** Stock Inventory (`src/components/StockInventory.tsx`)  
**Store / Tenant:** Tawakkal Paint House (`TPH` — `36da36b6-c1d2-448c-b685-3d7f354fdfca`)  
**Scope:** Standalone Lightweight Order Sheet & Instant Thermal/Standard Receipt Generator  
**Status:** Audit Finalized & Gaps Closed  

---

## 1. Executive Summary & Problem Context

In paint retail, shopkeepers regularly place replenishment orders with traveling sales reps and order bookers representing paint manufacturers (e.g., Gobi's, Reliance, Brighto, Berger).

### Current Workflow Gap:
1. **Manual / Paper Hassle:** Shopkeepers inspect shelves, write demand lists on paper pads with hand-scrawled shade names and pack sizes, which frequently leads to incorrect packaging units or missed shade numbers.
2. **Purchases / GRN Mismatch:** Existing purchase entry screens (`PurchasesView.tsx`) require supplier ledger accounting, cost prices, tax percentages, payment methods, and invoice numbers. However, when placing an initial order with a booker, **no prices or accounting entries exist**—it is purely a physical stock replenishment demand.
3. **Explicit User Mandate:** The shop owner requires a direct, lightweight demand slip generator accessible right from the Inventory screen that does **NOT** touch the database, creates no bookkeeping records, ignores prices and taxes, and immediately prints a clean receipt slip for the company representative.

---

## 2. Current Architecture & Codebase Assessment

### 2.1 Inventory Screen (`src/components/StockInventory.tsx`)
* **State Availability:** `StockInventory.tsx` receives `items: Item[]`, `tenantName: string`, and `tenantId: string` as props.
* **Catalog Data:** With 657 seeded SKUs in `TPH`, each item already has:
  * `code`: Unique manufacturer SKU code (e.g., `GQ8800`, `GG600`, `BSMG1`)
  * `name`: Descriptive product title and shade
  * `brand`: Brand identifier (e.g., `GOBI'S`, `RELIANCE`, `BRIGHTO`)
  * `unit` & `pack_size`: Pack size specification (e.g., `Quarter`, `Gallon`, `Drum`, `PCS`, `KG`)
  * `stock_qty`: Current quantity in store (currently `0.00`)
* **Existing Modals in Component:**
  * `showAddProductModal` (Single product add)
  * `showReceiveModal` (Bulk receiving)
  * `showAiScanModal` (AI invoice OCR)
  * Target: A dedicated **Company Order Sheet** modal (`CompanyOrderSheetModal.tsx`).

### 2.2 Print Engine & Receipt Rendering Infrastructure (Verified)
* **`printViaIframe`:** Verified at `src/utils/iframePrint.ts` (signature: `printViaIframe(htmlContent: string, onError?: (err: Error) => void): boolean`).
* **`escapeHtml`:** Verified exported from `src/utils/receiptRenderCore.ts`.
* **Icons:** Verified `ClipboardList` is available from `lucide-react` and must be imported in `StockInventory.tsx`.

---

## 3. Structural Comparison: Heavyweight vs. Lightweight Approach

| Evaluation Criteria | Heavyweight Database Approach (Rejected) | Lightweight In-Memory Approach (Selected) |
| :--- | :--- | :--- |
| **Database Overhead** | Creates new tables (`order_sheets`, `order_items`) | **Zero Database Changes** (0 migrations, 0 tables) |
| **Accounting Coupling** | Couples with supplier balances, vouchers, and bills | **Completely Decoupled** (No financial tracking) |
| **Price / Tax Handling** | Requires rates, discounts, taxes | **Zero Prices** (Only Item Code, Name, Packing, Qty) |
| **Execution Latency** | High (API calls, foreign keys, database joins) | **Instant (< 100ms)** (Operates on memory catalog) |
| **Offline Reliability** | Fails if network or Supabase connection drops | **100% Reliable** (Works even if network stutters) |
| **User Experience** | Multi-step form with supplier dropdowns | **3-Click Workflow**: Pick Brand ➔ Enter Qty ➔ Print |

---

## 4. Key Architectural Decisions (ADRs) & Gap Resolutions

### ADR-01: Pure Client-Side State with Accidental-Close Protection
The order sheet draft exists only in local React state during the user's session.
* **Gap Resolution:** To prevent accidental loss of a drafted order, if any item has `qty > 0`, attempting to close the modal will prompt a confirmation dialog (`"Discard drafted order quantities?"`).

### ADR-02: Zero Prices & Zero Taxes Policy with Concrete Validation
No cost prices, retail prices, discounts, or tax fields will be displayed in the modal or on the printed receipt.
* **Gap Resolution:** Automated template audit test to verify no financial keywords (`cost_price`, `retail_price`, `rate`, `tax`, `gst`, `discount`, `price`) exist in the output HTML.

### ADR-03: Dynamic Multi-Unit Packaging Aggregation
* **Gap Resolution:** The receipt summary does not use a hardcoded Quarter/Gallon/Drum formula. It dynamically tallies all distinct packaging units present in the order (e.g., `12 Quarters, 8 Gallons, 2 Drums, 5 PCS, 10 KG`).

### ADR-04: Cross-Brand Draft Persistence & Multi-Brand Printing
* **Gap Resolution:** A single `Record<string, number>` (`itemId -> qty`) stores order quantities across brand switches. On print, if items from multiple brands are ordered, the receipt automatically groups them under clean brand section sub-headers.

### ADR-05: Non-Persistent Timestamp Order Reference
* **Gap Resolution:** Because there is no database sequence, an ad-hoc reference is formatted as `DEM-YYYYMMDD-HHMM` and clearly labeled `(Timestamp Reference)` on the printed slip.

### ADR-06: Dual Thermal Width (80mm Default + 58mm Toggle) & A4 Support
* **Gap Resolution:** Both 80mm (default) and 58mm widths are supported via a toggle in the modal. A4 format displays the shop name with blank write-in lines for phone/address.

### ADR-07: High-Performance Catalog Rendering for 657 SKUs
* **Gap Resolution:** Modal defaults to the first available brand (`GOBI'S`) rather than an unfiltered 657-item view. The item list is memoized and search is instant.

### ADR-08: Ambiguity-Free "Select All 0 Stock" Action
* **Gap Resolution:** The action scopes strictly to the currently visible items (active brand and search query), sets `qty = 1` for items with `stock_qty <= 0` or `null`, and handles numeric/string conversions safely.
