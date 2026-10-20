# Inventory Company Order Sheet & Receipt Printer — Implementation Plan

**Document Ref:** `inventory-company-order-sheet-implementation-plan.md`  
**Related Audit:** [`audit/inventory-company-order-sheet-audit.md`](file:///d:/bestow/p-industry/audit/inventory-company-order-sheet-audit.md)  
**Target Component:** `src/components/StockInventory.tsx`  
**New Sub-Component:** `src/components/inventory/CompanyOrderSheetModal.tsx`  
**Print Utility:** `src/components/inventory/orderSheetPrintTemplates.ts` & `src/utils/iframePrint.ts`  
**Status:** Approved & Finalized with All Gaps Closed  

---

## 1. Overview & Architecture Blueprint

This implementation plan details the addition of a lightweight, on-the-spot **Company Order Sheet & Receipt Printing** tool directly inside the PyntFlow Inventory section.

### Core Principles:
1. **Zero Database Writes:** No schema migrations, no new tables, no database storage. Operates 100% in local React memory.
2. **Zero Price/Tax Exposure:** Strictly outputs physical demand (Item Code, Product Name/Shade, Packaging Unit, Quantity).
3. **Instant Printing:** Single-click output to standard 80mm/58mm thermal receipt printers and A4 document printers using PyntFlow's isolated `printViaIframe` engine.
4. **Cross-Brand Draft Persistence:** Single state map preserves quantities across brand switching and search filtering.

---

## 2. Component Hierarchy & File Structure

```
src/
├── components/
│   ├── StockInventory.tsx                    <-- Adds [Company Order Sheet] button & modal state
│   └── inventory/
│       ├── CompanyOrderSheetModal.tsx        <-- Interactive Order Sheet creator & grid
│       └── orderSheetPrintTemplates.ts      <-- HTML/CSS generators for 80mm, 58mm & A4 layouts
└── utils/
    ├── iframePrint.ts                        <-- Existing silent print utility (verified)
    └── receiptRenderCore.ts                  <-- Existing escapeHtml utility (verified)
```

---

## 3. UI & Feature Specifications (`CompanyOrderSheetModal.tsx`)

### 3.1 Modal Header & Navigation
* **Title:** `Company Order Sheet / Demand Booker`
* **Default Brand Selection:** Auto-selects the first brand (e.g. `GOBI'S`) upon modal opening to keep rendering fast and focused. User can switch to other brands (`RELIANCE`, `BRIGHTO`, etc.) or view `All Brands`.
* **Search / Filter Input:** Real-time search across item codes, names, and shades.
* **Printer Width Toggle:** Toggle button between `80mm (Standard POS)` and `58mm (Compact Thermal)`.
* **Auto-Fill Actions:**
  * `[Select All 0 Stock]`: Scopes to currently active brand/search view. Sets `qty = 1` for any item where `Number(stock_qty || 0) <= 0`.
  * `[Clear Quantities]`: Resets active quantities in the current view to 0.

### 3.2 Product Order Grid Table
| Column | Description | Control |
| :--- | :--- | :--- |
| **Code** | Official manufacturer SKU (e.g., `GQ8800`) | Bold monospace badge |
| **Product & Shade** | Full item title & shade description | Text |
| **Pack Size** | Packaging unit (`Quarter`, `Gallon`, `Drum`, `PCS`, `KG`, etc.) | Chip / Badge |
| **Current Stock** | Live in-store quantity (e.g., `0.00`) | Numeric display (red if 0) |
| **Order Quantity** | Desired demand count | Quantity stepper (`-`, `+`) + direct numeric input |

### 3.3 Draft State Model
```typescript
// Single global map of itemId to ordered quantity
const [orderQuantities, setOrderQuantities] = useState<Record<string, number>>({});
```
* **Survives Filter Switches:** Switching between `GOBI'S` and `RELIANCE` does **not** erase entered quantities.
* **Multi-Brand Printing:** If items from multiple brands have `qty > 0`, the printout groups items under clean brand sub-headers (`=== GOBI'S ===`, `=== RELIANCE ===`).

### 3.4 Modal Discard Confirmation
* If `Object.values(orderQuantities).some(q => q > 0)` and the user clicks **Cancel** or the **X** close button, a native confirmation dialog triggers:
  `"You have entered order quantities. Are you sure you want to discard this order sheet?"`

### 3.5 Bottom Summary Bar & Controls
* **Dynamic Packaging Breakdown:** Automatically calculates totals per distinct unit:
  ```typescript
  // Example output: "32 Packs Total (12 Gallon, 6 Quarter, 2 Drum, 4 PCS)"
  ```
* **Order Notes Field:** Single-line text input (e.g., *"Urgent delivery required by Thursday noon"*).
* **Action Buttons:**
  * `[Close / Cancel]`: Guarded by discard confirmation.
  * `[Print Thermal Slip (80mm/58mm)]`: Prints thermal receipt slip.
  * `[Print A4 Sheet]`: Prints full-page demand document with write-in lines.

---

## 4. Print Templates Specifications (`orderSheetPrintTemplates.ts`)

### 4.1 Thermal Slip Format (80mm / 58mm POS Receipt)

* **Width Control:** Parameterized (`80mm` default, `58mm` selectable).
* **Header:**
  * Shop Name: `escapeHtml(tenantName)`
  * Document Title: `COMPANY DEMAND SLIP`
  * Order Ref: `DEM-YYYYMMDD-HHMM` (labeled `Timestamp Ref`)
  * Date & Time: Live formatted local timestamp
  * Target Company: Name of Brand(s)
* **Table (Zero Prices):**
  * Columns: `CODE`, `ITEM / SHADE`, `PACK`, `QTY`
  * If multi-brand: Grouped by brand section headers
* **Footer:**
  * Dynamic packaging totals tally
  * Notes (if provided)
  * Signature boxes: `Order Given By: _________` and `Booker Signature: _________`

### 4.2 A4 Formal Purchase Demand Sheet

* Full-width professional layout (210mm x 297mm).
* Shop Name header, with blank write-in lines for `Phone: ____________` and `Address/City: ____________`.
* Clean tabular layout with alternating row background for readability.
* Dedicated notes section and official sign-off stamps.

---

## 5. Implementation Phases & Step-by-Step Execution

### Phase 1: Create Print Template Generators
* File: `src/components/inventory/orderSheetPrintTemplates.ts`
* Implement:
  * Dynamic packaging aggregation helper: `computePackagingTotals(items, quantities)`
  * `generateThermalOrderSlip(orderData, options: { width: '80mm' | '58mm' }): string`
  * `generateA4OrderSheet(orderData): string`
* Validate HTML escaping via `escapeHtml` from `src/utils/receiptRenderCore.ts`.

### Phase 2: Create `CompanyOrderSheetModal` Component
* File: `src/components/inventory/CompanyOrderSheetModal.tsx`
* Implement:
  * Persistent `Record<string, number>` draft state.
  * Dynamic brand extraction from `items` prop.
  * Default brand selection (`GOBI'S`).
  * Discard confirmation dialog when closing with active quantities.
  * "Select All 0 Stock" action (sets `qty = 1` for current visible 0-stock items).
  * 80mm / 58mm width toggle.
  * Thermal and A4 print buttons calling `printViaIframe`.

### Phase 3: Integrate Modal into `StockInventory.tsx`
* File: `src/components/StockInventory.tsx`
* Import `ClipboardList` from `lucide-react`.
* Add `[Company Order Sheet]` action button in the inventory top toolbar.
* Render `<CompanyOrderSheetModal>` controlled by `showOrderSheetModal` boolean state.

### Phase 4: Quality Assurance & Verification
* Run `npx tsc --noEmit` to verify type safety.
* Automated zero-price verification: script checks that rendered templates contain zero price/tax keywords.
* Verify 80mm thermal print preview and A4 print preview.
