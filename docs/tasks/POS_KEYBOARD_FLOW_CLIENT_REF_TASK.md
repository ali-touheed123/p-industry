# PyntFlow POS — Keyboard Flow, Client Reference & Cart Edits Task Register

**Document Path:** `docs/tasks/POS_KEYBOARD_FLOW_CLIENT_REF_TASK.md`
**Project:** PyntFlow Paint Industry POS & Industrial ERP (`p-industry`)
**Status:** `✅ FULLY IMPLEMENTED & VERIFIED`
**Execution Mode:** Audit done, questions answered, ready to implement
**Date:** October 22, 2026
**Audited By:** Antigravity AI

---

## 1. Master Task Overview

```
┌──────────────┬──────────────────────────────────────────────────────────────────────────┬──────────┬───────────────┐
│ Task ID      │ Task Title                                                               │ Priority │ Status        │
├──────────────┼──────────────────────────────────────────────────────────────────────────┼──────────┼───────────────┤
│ TASK-KBD-1A  │ DB Migration: Add `reference` column to `clients` table                  │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-1B  │ Update `Client` TypeScript interface                                     │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-1C  │ Update `/api/clients` POST + PATCH to handle `reference`                 │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-1D  │ Add Reference input to Quick-Add form in PosBilling                      │ P1       │ ✅ COMPLETE   │
│ TASK-KBD-1E  │ Add Reference field to Customer page (`FinancialLedgers.tsx`)           │ P1       │ ✅ COMPLETE   │
│ TASK-KBD-2A  │ Change Enter on product search: SELECT only, Shift+Enter = add direct    │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-2B  │ Qty input: ArrowUp/Down to adjust, Enter moves to Rate                  │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-2C  │ New Rate input in search row (auto-fills retail price)                   │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-2D  │ New Disc% input in search row                                            │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-2E  │ Wire Enter chain: Disc → Add → reset → back to search                   │ P0       │ ✅ COMPLETE   │
│ TASK-KBD-2F  │ Auto-populate Rate when product is selected                              │ P1       │ ✅ COMPLETE   │
│ TASK-KBD-2G  │ Reset all inputs + auto-focus search after add                           │ P1       │ ✅ COMPLETE   │
│ TASK-KBD-3A  │ Make Rate cell in cart table editable (input, not text display)          │ P0       │ ✅ COMPLETE   │
└──────────────┴──────────────────────────────────────────────────────────────────────────┴──────────┴───────────────┘
```

---

## 2. Design Decisions (Locked)

| # | Decision | Answer |
|---|----------|--------|
| D1 | "Reference" field meaning | **Referrer/Agent name** — who referred this client |
| D2 | Where to add Reference | **Both** PosBilling Quick-Add AND ClientCreditRecovery page |
| D3 | When keyboard chain triggers | **Always** — Enter = select only, Shift+Enter = add direct |
| D4 | Rate input default value | **Auto-fill retail price**, user can override |
| D5 | originalRate on cart rate edit | **Stay untouched** — Token calculations must remain correct |

---

## 3. Detailed Task Specifications

---

### TASK-KBD-1A — DB Migration: Add `reference` column to `clients`

- **Task ID:** `TASK-KBD-1A`
- **Priority:** `P0 - Blocker`
- **Status:** `✅ COMPLETE` — Column `reference TEXT NULL` added to `public.clients`. Verified via `information_schema`.
- **Description:** Add a nullable text column `reference` to the `public.clients` table to store the referrer/agent name who sent this client.
- **Migration SQL:**
  ```sql
  ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS reference TEXT NULL;
  COMMENT ON COLUMN public.clients.reference IS 'Referrer or agent name who sent this client';
  ```
- **Tool:** `supabase-mcp-server → apply_migration`
- **Files Touched:** Supabase DB only (migration)
- **Dependencies:** None
- **Acceptance Criteria:**
  - Column exists in `clients` table with `NULL` default
  - Existing rows unaffected (all NULL)
  - Migration is idempotent (`IF NOT EXISTS`)
- **Risk Level:** Low (additive only, no existing data touched)

---

### TASK-KBD-1B — Update `Client` TypeScript Interface

- **Task ID:** `TASK-KBD-1B`
- **Priority:** `P0`
- **Status:** `✅ COMPLETE` — Added `reference?: string` to `Client` interface in `src/types/index.ts`
- **Description:** Add `reference?: string` to the `Client` interface in shared types.
- **Files Touched:** [`src/types/index.ts`](file:///d:/bestow/p-industry/src/types/index.ts) (line ~106, inside `Client` interface)
- **Change:**
  ```diff
    token_balance?: number;
  + reference?: string;
    created_at: string;
  ```
- **Dependencies:** `TASK-KBD-1A`
- **Acceptance Criteria:**
  - TypeScript compiles with no errors
  - `reference` is optional (won't break existing client reads)
- **Risk Level:** Low

---

### TASK-KBD-1C — Update `/api/clients` POST & PATCH

- **Task ID:** `TASK-KBD-1C`
- **Priority:** `P0`
- **Status:** `✅ COMPLETE` — `reference` added to POST insert and PATCH update in `src/app/api/clients/route.ts`
- **Description:** Update the clients API route to accept, store, and update the `reference` field.
- **Files Touched:** [`src/app/api/clients/route.ts`](file:///d:/bestow/p-industry/src/app/api/clients/route.ts)
- **Changes:**
  - **POST** (~line 65): destructure `reference` from body; include `reference: reference || null` in the Supabase insert
  - **PATCH** (~line 116): destructure `reference`; add `if (reference !== undefined) updates.reference = reference || null;`
- **Dependencies:** `TASK-KBD-1A`, `TASK-KBD-1B`
- **Acceptance Criteria:**
  - `POST /api/clients` with `reference: "Ahmad Bhai"` stores the value in DB
  - `PATCH /api/clients` with `reference: "..."` updates the field
  - `reference` not sent = no change (PATCH) or NULL (POST)
- **Risk Level:** Low

---

### TASK-KBD-1D — Add Reference Input to Quick-Add Form in PosBilling

- **Task ID:** `TASK-KBD-1D`
- **Priority:** `P1`
- **Status:** `✅ COMPLETE` — State `newClientReference` added, input wired into Quick Add form, sent in POST payload, cleared on submit.
- **Description:** Add a "Referrer / Agent" input field to the Quick Add Client section inside the Customer Directory modal in PosBilling.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L2447-L2498)
- **Changes:**
  - Add state: `const [newClientReference, setNewClientReference] = useState<string>('')`
  - Add input between phone and Create button:
    ```tsx
    <input
      type="text"
      value={newClientReference}
      onChange={(e) => setNewClientReference(e.target.value)}
      placeholder="Referrer / Agent name..."
      className="pos-text-input"
      style={{ width: '130px' }}
    />
    ```
  - Pass `reference: newClientReference || undefined` in the POST body
  - Reset `setNewClientReference('')` after successful creation
- **Dependencies:** `TASK-KBD-1C`
- **Acceptance Criteria:**
  - Reference input appears in Quick Add form
  - Value saved to DB on Create
  - Field clears after creation
  - Reference is optional (clients can still be added without it)
- **Risk Level:** Low

---

### TASK-KBD-1E — Add Reference Field to ClientCreditRecovery Page

- **Task ID:** `TASK-KBD-1E`
- **Priority:** `P1`
- **Status:** `✅ COMPLETE` — The Customer page is rendered via `FinancialLedgers.tsx` (activeTab `'customers'`). Added `newPartyReference` state, Reference input in Add Party modal, wired to `/api/clients` POST payload, and displayed Reference in header and profile card. `ClientCreditRecovery.tsx` audited and confirmed to contain no client add/edit forms.
- **Files Touched:** [`src/components/FinancialLedgers.tsx`](file:///d:/bestow/p-industry/src/components/FinancialLedgers.tsx)
- **Note at Implementation Time:** Audit showed no direct POST in this file — must check at implementation whether an add/edit form exists. If no form exists, mark N/A.
- **Dependencies:** `TASK-KBD-1C`
- **Acceptance Criteria:**
  - If form exists: Reference input is present and saves to DB
  - If no form found: task closed as N/A
- **Risk Level:** Low

---

### TASK-KBD-2A — Change Enter on Product Search: SELECT Only, Shift+Enter = Add Direct

- **Task ID:** `TASK-KBD-2A`
- **Priority:** `P0 - Core`
- **Status:** `? COMPLETE`
- **Description:** Change the keyboard behavior in the product search box `onKeyDown` handler. Currently `Enter` immediately calls `handleAddItem`. New behavior: `Enter` selects the highlighted product and moves focus to Qty. `Shift+Enter` adds directly to cart (preserves fast-add).
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1532-L1543)
- **Current code (line ~1532):**
  ```tsx
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (showProductDropdown && filteredCatalog.length > 0 && ...) {
      handleAddItem(filteredCatalog[activeProductIndex]); // adds immediately
    }
  }
  ```
- **New behavior:**
  ```tsx
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter = direct add (bypass chain)
    e.preventDefault();
    const prod = filteredCatalog[activeProductIndex] || selectedProduct;
    if (prod) handleAddItem(prod, undefined, false);

  } else if (e.key === 'Enter') {
    // Plain Enter = SELECT product, move to Qty
    e.preventDefault();
    const prod = filteredCatalog[activeProductIndex]
      || (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
    if (prod) {
      setSelectedProduct(prod);
      setInputRate(prod.retail_price || 0);   // auto-fill (Decision D4)
      setProductQuery(`${prod.name} (${prod.shade_code || '—'})`);
      setShowProductDropdown(false);
      qtyInputRef.current?.focus();           // move to Qty
    }
  }
  ```
- **Dependencies:** `TASK-KBD-2C` (needs `qtyInputRef`, `setInputRate`)
- **Acceptance Criteria:**
  - Enter → product selected, dropdown closes, Qty focused
  - Shift+Enter → item added immediately
  - Mouse click on dropdown item → still adds immediately (unchanged)
- **Risk Level:** Medium (changes core add flow behavior)

---

### TASK-KBD-2B — Qty Input: ArrowUp/Down to Adjust, Enter Moves to Rate

- **Task ID:** `TASK-KBD-2B`
- **Priority:** `P0`
- **Status:** `? COMPLETE`
- **Description:** The existing Qty input gets a `ref` and keyboard handler. `ArrowUp/Down` increments/decrements the value. `Enter` moves focus to the Rate input.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1621-L1633)
- **Changes:**
  - Add `const qtyInputRef = useRef<HTMLInputElement>(null);`
  - Attach `ref={qtyInputRef}` to the Qty `<input>`
  - Add `onKeyDown` handler:
    ```tsx
    onKeyDown={(e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); setInputQty(prev => prev + 1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setInputQty(prev => Math.max(1, prev - 1)); }
      else if (e.key === 'Enter') { e.preventDefault(); rateInputRef.current?.focus(); }
      else if (e.key === 'Escape') { setSelectedProduct(null); setProductQuery(''); searchInputRef.current?.focus(); }
    }}
    ```
- **Dependencies:** `TASK-KBD-2C` (needs `rateInputRef`)
- **Acceptance Criteria:**
  - ArrowUp/Down adjusts qty without leaving the field
  - Enter moves focus to Rate
  - Escape cancels and returns to search
- **Risk Level:** Low

---

### TASK-KBD-2C — New Rate Input in Search Row (Auto-fills Retail Price)

- **Task ID:** `TASK-KBD-2C`
- **Priority:** `P0 - Core`
- **Status:** `? COMPLETE`
- **Description:** Add `inputRate` state and a visible Rate input field in the product entry row, between Qty and Disc fields. When a product is selected, auto-fills with the product's `retail_price`.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1621-L1650)
- **New state + ref:**
  ```tsx
  const [inputRate, setInputRate] = useState<number>(0);
  const rateInputRef = useRef<HTMLInputElement>(null);
  ```
- **New JSX (in product entry row, after Qty):**
  ```tsx
  <div style={{ width: '110px', flexShrink: 0, display: 'flex', alignItems: 'center',
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px' }}>
    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
      color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
      Rate:
    </span>
    <input
      ref={rateInputRef}
      type="number"
      min={0}
      step="any"
      value={inputRate || ''}
      placeholder="0"
      onChange={(e) => setInputRate(Number(e.target.value) || 0)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); discInputRef.current?.focus(); }
        else if (e.key === 'Escape') { searchInputRef.current?.focus(); }
      }}
      style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none',
        textAlign: 'center', outline: 'none' }}
    />
  </div>
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Rate field visible in search row at all times
  - Auto-fills with `selectedProduct.retail_price` when product is selected
  - Enter moves focus to Disc% input
- **Risk Level:** Low

---

### TASK-KBD-2D — New Disc% Input in Search Row

- **Task ID:** `TASK-KBD-2D`
- **Priority:** `P0`
- **Status:** `? COMPLETE`
- **Description:** Add `inputDiscount` state and a Disc% input field in the product entry row, after Rate and before the Add button.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1621-L1650)
- **New state + ref:**
  ```tsx
  const [inputDiscount, setInputDiscount] = useState<number>(0);
  const discInputRef = useRef<HTMLInputElement>(null);
  ```
- **New JSX (after Rate field):**
  ```tsx
  <div style={{ width: '90px', flexShrink: 0, display: 'flex', alignItems: 'center',
    background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '4px 8px' }}>
    <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace',
      color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginRight: '4px' }}>
      Dis%:
    </span>
    <input
      ref={discInputRef}
      type="number"
      min={0}
      max={100}
      step="any"
      value={inputDiscount || ''}
      placeholder="0"
      onChange={(e) => setInputDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); addItemBtnRef.current?.click(); }
        else if (e.key === 'Escape') { searchInputRef.current?.focus(); }
      }}
      style={{ width: '100%', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace',
        fontWeight: 700, color: '#0F172A', background: 'transparent', border: 'none',
        textAlign: 'center', outline: 'none' }}
    />
  </div>
  ```
- **Dependencies:** `TASK-KBD-2C`
- **Acceptance Criteria:**
  - Disc% field visible in search row
  - Enter triggers Add Item
  - Max 100, min 0 clamped
- **Risk Level:** Low

---

### TASK-KBD-2E — Wire Enter Chain: Disc → Add → Reset → Back to Search

- **Task ID:** `TASK-KBD-2E`
- **Priority:** `P0 - Core`
- **Status:** `? COMPLETE`
- **Description:** Connect final steps: Enter on Disc% triggers Add Item. `handleAddItem` extended to accept `overrideDiscount`. After add, all inputs reset and focus returns to search box.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L666-L751)
- **Changes:**

  **1. Extend `handleAddItem` signature:**
  ```tsx
  const handleAddItem = (
    specificItem?: Item,
    overrideRate?: number,
    skipCheck: boolean = false,
    overrideDiscount?: number   // ← new
  ) => {
    // When building newLineItem:
    discountPercent: overrideDiscount !== undefined ? overrideDiscount : 0,
  ```

  **2. Add button gets a ref:**
  ```tsx
  const addItemBtnRef = useRef<HTMLButtonElement>(null);
  ```

  **3. Add button `onClick` passes inputRate + inputDiscount:**
  ```tsx
  onClick={() => {
    const prod = selectedProduct || (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
    if (prod) {
      handleAddItem(
        prod,
        inputRate > 0 ? inputRate : undefined,
        false,
        inputDiscount > 0 ? inputDiscount : undefined
      );
    }
  }}
  ```

  **4. Reset at end of `handleAddItem`:**
  ```tsx
  setInputRate(0);
  setInputDiscount(0);
  setTimeout(() => searchInputRef.current?.focus(), 30);
  ```

- **Dependencies:** `TASK-KBD-2C`, `TASK-KBD-2D`
- **Acceptance Criteria:**
  - Full chain: Search → Enter → Qty → Enter → Rate → Enter → Disc → Enter → Added → back to Search
  - Rate and Disc reset to 0 after each add
  - Focus returns automatically to search box after every add
- **Risk Level:** Medium (touches `handleAddItem` core logic)

---

### TASK-KBD-2F — Auto-Populate Rate When Product is Selected

- **Task ID:** `TASK-KBD-2F`
- **Priority:** `P1`
- **Status:** `? COMPLETE`
- **Description:** Whenever `selectedProduct` is set (keyboard Enter or select), `inputRate` automatically reflects the product's `retail_price`. Handled inline in `TASK-KBD-2A`.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx)
- **Implementation (part of TASK-KBD-2A):**
  ```tsx
  setSelectedProduct(prod);
  setInputRate(prod.retail_price || 0);  // auto-fill
  ```
- **Dependencies:** `TASK-KBD-2A`, `TASK-KBD-2C`
- **Acceptance Criteria:**
  - Rate input shows `retail_price` immediately after product selection
  - Switching products updates the rate input
- **Risk Level:** Low

---

### TASK-KBD-2G — Reset All Inputs + Auto-Focus Search After Add

- **Task ID:** `TASK-KBD-2G`
- **Priority:** `P1`
- **Status:** `? COMPLETE`
- **Description:** After an item is added to cart, all entry-row inputs reset to defaults and focus returns to search so the operator can immediately search the next item.
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L747-L751)
- **At end of `handleAddItem`:**
  ```tsx
  setProductQuery('');
  setSelectedProduct(null);
  setInputQty(1);
  setInputRate(0);           // new
  setInputDiscount(0);       // new
  setShowProductDropdown(false);
  setTimeout(() => searchInputRef.current?.focus(), 30);   // new
  ```
- **Dependencies:** `TASK-KBD-2E`
- **Acceptance Criteria:**
  - After add: search box focused, Qty=1, Rate=0, Disc%=0
  - Operator can type next product without touching mouse
- **Risk Level:** Low

---

### TASK-KBD-3A — Make Rate Cell Editable in Cart Table

- **Task ID:** `TASK-KBD-3A`
- **Priority:** `P0`
- **Status:** `? COMPLETE`
- **Description:** The Rate column in the cart table currently shows a plain text number. Replace it with an editable `<input type="number">` so the operator can adjust price directly in the cart. `originalRate` is NOT changed (Decision D5).
- **Files Touched:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L1879-L1881)
- **Current:**
  ```tsx
  <td style={{ textAlign: 'right', ... }}>
    {item.rate.toLocaleString(undefined, { minimumFractionDigits: 2 })}
  </td>
  ```
- **Replacement:**
  ```tsx
  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
    <input
      type="number"
      min={0}
      step="any"
      value={item.rate === 0 ? '' : item.rate}
      placeholder="0.00"
      onChange={(e) => {
        const val = Math.max(0, parseFloat(e.target.value) || 0);
        setLineItems((prev) =>
          prev.map((li) => li.id === item.id ? { ...li, rate: val } : li)
          // originalRate stays unchanged (D5 — Token-safe)
        );
      }}
      style={{
        width: '72px',
        textAlign: 'right',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#1E293B',
        fontSize: '11px',
        fontWeight: 600,
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        borderRadius: '4px',
        padding: '2px 4px',
        outline: 'none',
      }}
      onFocus={(e) => (e.target.style.borderColor = '#F97316')}
      onBlur={(e) => (e.target.style.borderColor = '#E2E8F0')}
      title="Click to edit rate"
    />
  </td>
  ```
- **Dependencies:** None
- **Acceptance Criteria:**
  - Rate cell in cart is now an editable input
  - Typing a new value updates `item.rate` → Amount auto-recalculates
  - `originalRate` unchanged → Token deduction still correct
  - Visual style consistent with existing `discountPercent` input
- **Risk Level:** Low

---

## 4. Keyboard Flow Summary (Final Design)

```
┌──────────────────────────────────────────────────────────────────────┐
│                      POS Keyboard Entry Flow                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Search Box]  ← F3 focuses here from anywhere                       │
│       │                                                              │
│       ├── Type product name / code / barcode / shade                 │
│       ├── ArrowDown / ArrowUp → navigate dropdown                    │
│       ├── Enter → SELECT product (close dropdown, fill Rate,         │
│       │           move focus to Qty)                                 │
│       └── Shift+Enter → ADD directly to cart (fast path)            │
│                                                                      │
│  [Qty Input]  ← auto-focused after product selection                 │
│       ├── ArrowUp / ArrowDown → increment / decrement qty            │
│       ├── Type number directly                                       │
│       ├── Enter → move focus to Rate input                           │
│       └── Escape → cancel selection, back to search                  │
│                                                                      │
│  [Rate Input]  ← auto-filled with retail_price (Decision D4)        │
│       ├── Type to override price                                     │
│       ├── Enter → move focus to Disc% input                         │
│       └── Escape → back to search                                    │
│                                                                      │
│  [Disc% Input]  ← starts at 0                                        │
│       ├── Type discount percentage (0–100)                          │
│       ├── Enter → ADD item to cart → reset all → back to Search     │
│       └── Escape → back to search                                    │
│                                                                      │
│  Cart Table:                                                         │
│       ├── Product Name → editable (already works)                    │
│       ├── Shade Code   → editable (already works)                    │
│       ├── Rate         → NOW editable (TASK-KBD-3A)                  │
│       └── Disc%        → editable (already works)                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. File Impact Summary

| File | Task(s) | Change Type |
|------|---------|-------------|
| `src/types/index.ts` | 1B | Add `reference?` to `Client` interface |
| `src/app/api/clients/route.ts` | 1C | POST + PATCH handle `reference` |
| `src/components/PosBilling.tsx` | 1D, 2A–2G, 3A | States, refs, UI inputs, handler changes |
| `src/components/ClientCreditRecovery.tsx` | 1E | Reference field (verify at impl time) |
| Supabase DB | 1A | `ALTER TABLE clients ADD COLUMN reference TEXT NULL` |

---

## 6. Implementation Order (Recommended)

```
Feature 1 (Reference Field):
  TASK-KBD-1A → 1B → 1C → 1D → 1E

Feature 2 (Keyboard Chain — build inputs first, then wire):
  TASK-KBD-2C → 2D → 2A → 2B → 2E → 2F → 2G

Feature 3 (Cart Rate — independent):
  TASK-KBD-3A   ← can be done any time in parallel
```

> [!TIP]
> `TASK-KBD-3A` is fully independent. It can be implemented in parallel with Feature 1 since it touches only the cart table, not the search row or client modal.

> [!IMPORTANT]
> `TASK-KBD-2E` touches `handleAddItem` which has downstream effects on stock validation, token logic, and the pending-rate confirmation modal. Test thoroughly after this task.

> [!WARNING]
> `TASK-KBD-2A` changes the Enter behavior that all existing users are familiar with. The Shift+Enter fast-path must work perfectly as a safety net before this is deployed.
