# Paint Token Management — Comprehensive Implementation Plan

**Target System:** PyntFlow Paint ERP / POS Platform  
**Document Reference:** Section 1–33 Specification & Audit Findings (`token-system-audit.md`)  
**Status:** Approved Architecture & Implementation Plan  

---

## 1. Architectural Alignment & Decisions Summary

Based on the deep audit and finalized requirements, the 12 core architectural decisions are:

| # | Topic | Final Decision |
|---|---|---|
| **A1** | **Legacy Virtual Balance & POS Tender** | **Completely Removed & Deprecated**: Legacy `clients.token_balance`, POS token-tender payments, and phantom 'General' token records are completely removed. Tokens are strictly physical assets. |
| **A2** | **Opening Stock Flow** | **Explicit Stockpile Origin**: First-class physical stockpile seeding flow. Shop owners enter physical token inventory counts (Brand, Series, Unit, Value). It is a distinct stockpile origin alongside Shop Retained and Customer Redeemed that participates fully in available stockpile aggregation, settlement, and write-offs. |
| **A3** | **UI Location** | **Dedicated Navigation**: New primary sidebar tab **"Token Management"** for Brand/Series/Unit configuration, alongside the existing **"Tokens"** workspace for Stockpile, Activity, and Redemptions. |
| **A4** | **Cash Outflow** | **Direct Shift Drawer**: Cash payouts on redemptions are read directly from `token_transactions` by Shift Drawer without creating redundant expense entries. |
| **A5** | **Invoice Edit vs. Cancellation** | **Preserve on Edit, Revert on Cancel**: Normal invoice edits do NOT reverse or re-generate token records (avoiding duplicate records). Invoice cancellation atomically reverses associated token records according to physical state: unconsumed Shop Retained stockpile records and Issued activity logs are reversed via reversal entries; already-settled/consumed tokens preserve historical integrity and cannot be blindly wiped. |
| **A6** | **Existing Data Migration** | **Fresh Start**: Old pre-production `token_transactions` data is dropped/reset for the clean architecture. |
| **A7** | **Series Renaming** | **Auto-Deactivate Old & Fresh New Config**: Renaming a Series deactivates the old Series (preserving historical integrity & redemptions) and creates a new active Series with fresh/default token configuration. The new Series does NOT inherit or copy old token values. |
| **A8** | **Purchases / Vouchers** | **Preserve Workflow**: Existing ability to apply available stockpiled tokens against supplier purchases and payment vouchers is preserved, adapted to the new 4-part identity. |
| **A9** | **Tenancy Scope** | **Per-Tenant Configuration**: Brands, Series, and Unit Token Values are configured per-branch/tenant independently. |
| **A10** | **Backend Atomicity** | **Server-Side Transaction**: Token generation and deduction logic is moved entirely inside `POST /api/invoices` and `PATCH /api/invoices`. |
| **A11** | **POS Receipts** | **Line-Item Badges**: POS sales receipts display token details (Brand, Series, Unit, Value, Keep/Remove) per line. |
| **A12** | **Drawer Formula** | **Accurate Math**: `expectedCash = opening + cashSales - cashReturns - supplierCash - pettyExpenses - tokenRedemptionCashPayouts`. |

---

## 2. Core Business Domain & Token Identity

A physical paint token is strictly defined by 4 immutable attributes:
```text
Token Identity = Brand + Series + Unit + Token Value
```
* Color/shade code, formulation, tint base, retail price, cost price, and item SKU code are **NOT** part of token identity.
* Products inherit token properties automatically from their **Brand + Series + Unit** association.

---

## 3. Database Architecture & Schema Specification

### 3.1 New Tables

#### 1. Table: `brands`
Manages manufacturer paint brands per tenant.
```sql
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brands_tenant_name UNIQUE (tenant_id, LOWER(name))
);
CREATE INDEX idx_brands_tenant ON brands(tenant_id, status);
```

#### 2. Table: `brand_series`
Manages product series per brand (e.g. "Super Emulsion", "Weathercoat", "Synthetic Enamel").
```sql
CREATE TABLE brand_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_brand_series_tenant_brand_name UNIQUE (tenant_id, brand_id, LOWER(name))
);
CREATE INDEX idx_brand_series_brand ON brand_series(tenant_id, brand_id, status);
```

#### 3. Table: `custom_units`
Globally reusable unit names within the tenant (beyond Gallon, Drum, Quarter).
```sql
CREATE TABLE custom_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_custom_units_tenant_name UNIQUE (tenant_id, LOWER(name))
);
```

#### 4. Table: `series_token_configs`
Configures token enablement and values per Unit under each Series.
```sql
CREATE TABLE series_token_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES brand_series(id) ON DELETE CASCADE,
    unit_name TEXT NOT NULL, -- 'Gallon', 'Drum', 'Quarter', or custom unit name
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    token_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (token_value >= 0),
    is_drum_auto BOOLEAN NOT NULL DEFAULT TRUE, -- If TRUE and unit is Drum, syncs with Gallon * 4
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_series_token_configs UNIQUE (tenant_id, series_id, LOWER(unit_name))
);
CREATE INDEX idx_series_token_configs ON series_token_configs(tenant_id, series_id);
```

#### 5. Table: `token_redemptions` & `token_redemption_items`
Records customer physical token redemption events (supporting multi-line, multi-brand redemptions in one receipt).
```sql
CREATE TABLE token_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    redemption_no TEXT NOT NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL DEFAULT 'Walk-in Customer',
    total_tokens INTEGER NOT NULL CHECK (total_tokens > 0),
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    payout_method TEXT NOT NULL DEFAULT 'cash' CHECK (payout_method = 'cash'),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE token_redemption_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    redemption_id UUID NOT NULL REFERENCES token_redemptions(id) ON DELETE CASCADE,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    brand_name TEXT NOT NULL,
    series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL,
    series_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    token_value NUMERIC(10,2) NOT NULL CHECK (token_value > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total NUMERIC(10,2) NOT NULL CHECK (line_total > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 3.2 Unified Ledger: `token_transactions`
Refactored for the 4-part identity and historical snapshot preservation:
```sql
CREATE TABLE token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'issued',         -- POS Sale Keep Token (Customer took physical token)
        'shop_retained',   -- POS Sale Remove Token (Discount applied, shop kept token in safe)
        'redeemed',        -- Customer handed physical token for cash payout (enters safe)
        'opening_stock',   -- Drawer initialization / safe seeding
        'settle_vendor',   -- Handed over to manufacturer sales rep
        'write_off',       -- Damaged / Lost / Expired / Invalid
        'used_purchase',   -- Applied against supplier purchase / payment voucher
        'reversal'         -- Inversion of invoice edit/cancellation
    )),
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    redemption_id UUID REFERENCES token_redemptions(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
    brand_name TEXT NOT NULL,
    series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL,
    series_name TEXT NOT NULL,
    unit_name TEXT NOT NULL,
    token_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    remaining_quantity INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    usage_status TEXT NOT NULL DEFAULT 'available' CHECK (usage_status IN ('available', 'settled', 'written_off', 'reversed', 'n_a')),
    shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
    notes TEXT,
    write_off_reason TEXT, -- 'Damaged', 'Lost', 'Invalid', 'Other'
    settled_vendor_name TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_token_tx_tenant_usage ON token_transactions(tenant_id, usage_status, type);
CREATE INDEX idx_token_tx_identity ON token_transactions(tenant_id, brand_name, series_name, unit_name, token_value);
CREATE INDEX idx_token_tx_invoice ON token_transactions(invoice_id);
```

### 3.3 Alterations to Existing Tables
- **`items`**:
  - Add `series_id UUID REFERENCES brand_series(id) ON DELETE SET NULL`.
  - Add `brand_id UUID REFERENCES brands(id) ON DELETE SET NULL`.
  - Maintain `brand TEXT` for backward compatibility during query joins.

---

## 4. Implementation Phases & Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DATABASE SCHEMA & MIGRATIONS                                  │
│ • Migration: Create brands, brand_series, custom_units, series_token_   │
│   configs, token_redemptions, token_redemption_items                   │
│ • Migration: Re-architect token_transactions with 4-part identity      │
│ • Seed default standard units (Gallon, Drum, Quarter)                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: BRAND, SERIES & TOKEN CONFIGURATION ENGINE                    │
│ • Backend CRUD APIs: /api/brands, /api/brand-series, /api/token-configs │
│ • Automatic Drum value calculation (Gallon × 4) with manual override   │
│ • Series rename -> auto-deactivate old series, create new active series │
│ • UI: Dedicated "Token Management" tab in POS workspace               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: PRODUCT CATALOG & BULK ENTRY INHERITANCE                      │
│ • Connect Products to Series in Bulk Product Entry & Edit              │
│ • Product token values auto-inherit from Series + Unit config          │
│ • Eliminate shade-level token configuration                            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: ATOMIC POS CHECKOUT & INVOICE CANCELLATION REVERSALS          │
│ • Move token processing into POST /api/invoices (atomic transaction)   │
│ • Keep Token -> Issued Activity log only (No virtual balance created)  │
│ • Remove Token -> Discount applied + Shop Retained Stockpile           │
│ • Mixed sales support with single collapsed activity entry             │
│ • Normal invoice EDIT does NOT reverse or duplicate token records      │
│ • Invoice CANCELLATION atomically reverses tokens preserving history   │
│ • Deprecate clients.token_balance & remove POS token-tender input      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: MULTI-LINE REDEMPTION & CASH DRAWER INTEGRATION               │
│ • Multi-line Redemption Dialog: Brand + Series + Unit + Qty            │
│ • Auto-resolution of token value (cashier cannot type value)           │
│ • Cash payout deducted from active Shift Drawer expected cash          │
│ • Receipts: Line-item breakdown with Brand, Series, Unit, Value, Qty   │
│ • Stockpile entry created with status = 'available'                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: STOCKPILE, SETTLEMENT & WRITE-OFF                             │
│ • Stockpile aggregation by (Brand + Series + Unit + Value)             │
│ • Brand-specific vendor settlement with partial quantity support       │
│ • Write-off dialog with mandatory reason (Damaged, Lost, Invalid, Other)│
│ • Preserve Purchase / Voucher token application                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: VERIFICATION & END-TO-END QUALITY ASSURANCE                   │
│ • Execute all 33 mandatory test scenarios                              │
│ • Full TypeScript compilation check (`npx tsc --noEmit`)               │
│ • End-to-end audit verification                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Step-by-Step Technical Execution

### Phase 1: Database Migration
1. Create `supabase/migrations/20261002_01_paint_token_management.sql`.
2. Implement tables: `brands`, `brand_series`, `custom_units`, `series_token_configs`, `token_redemptions`, `token_redemption_items`, and refactor `token_transactions`.
3. Add foreign keys to `items` (`brand_id`, `series_id`).
4. Set up atomic stored procedure `process_invoice_tokens` for atomic invoice token operations.

### Phase 2: Configuration APIs & Management UI
1. Create `/api/brands/route.ts` (GET, POST, PATCH).
2. Create `/api/brand-series/route.ts` (GET, POST, PATCH).
   - Handles Series renaming by deactivating old record and creating new record.
3. Create `/api/token-configs/route.ts` (GET, PUT).
   - Gallon enable/disable + value.
   - Drum default Gallon * 4 logic + manual override flag.
   - Quarter manual config.
   - Custom unit support.
4. Build `src/components/TokenManagementView.tsx` with high-aesthetic UI.
5. Register `"token-management"` tab in `src/app/[slug]/page.tsx`.

### Phase 3: Bulk Product Entry & Catalog Integration
1. Update `src/components/BulkProductEntry.tsx` and `src/components/ProductFormModal.tsx` to include Series dropdown filtered by Brand.
2. In POS catalog loading (`refreshItems`), link products with their active `series_token_configs` based on `series_id` + `pack_size`/`unit`.

### Phase 4: Atomic POS Checkout & Invoice Cancellation Reversals
1. Update `src/app/api/invoices/route.ts`:
   - `POST`: Atomically evaluate each line item. If `item.token_action === 'remove'`, record `shop_retained` in `token_transactions`. If `item.token_action === 'keep'`, record `issued` in `token_transactions` (Customer Token Activity log only; no virtual credit balance modification).
   - `PATCH (Normal Edit)`: Normal invoice edits do NOT touch, delete, or duplicate token records. Token records created at invoice inception remain unchanged.
   - `Cancellation / Return`: Atomically reverses associated token records according to physical state:
     - For `shop_retained` tokens whose `usage_status` is still `'available'`, mark original record as `'reversed'` and log a reversal entry.
     - If `shop_retained` tokens were already consumed/settled before cancellation, preserve historical settlement records and log an adjusting reversal entry without corrupting ledger history.
     - For `issued` tokens, log a cancellation reversal in Customer Token Activity.
2. Remove client-side async `POST /api/tokens` loops in `src/components/PosBilling.tsx`.
3. Remove POS token-tender / payment input field and optimistic `setSelectedClient(...token_balance)` in `src/components/PosBilling.tsx`.
4. Update POS Receipt printing component to render token badges per line item.
5. Deprecate `clients.token_balance` column in database and remove all phantom `'General'` / `brand = null` insertions in `/api/tokens`.

### Phase 5: Multi-Line Customer Redemption
1. Build `src/components/TokenRedemptionModal.tsx`:
   - Multi-line table supporting Brand, Series, Unit, Whole-Number Qty.
   - Read-only Token Value auto-resolved from configuration.
   - Cash payout calculation.
   - Walk-in or account customer selection.
2. Backend `POST /api/tokens/redeem`:
   - Atomically insert `token_redemptions` + `token_redemption_items`.
   - Insert `token_transactions` with `type = 'redeemed'`, `usage_status = 'available'`.
   - Record cash payout under `shift_id`.
3. Update `ShiftDrawer.tsx` to deduct redemption cash payouts from drawer expected cash.

### Phase 6: Stockpile Aggregation, Opening Stock, Settlement & Write-Off
1. **Opening Stock Flow**:
   - Provide dedicated drawer/safe Opening Stock entry form allowing shop owners to seed initial physical token batches (`Brand`, `Series`, `Unit`, `Token Value`, `Quantity`).
   - Recorded with `type = 'opening_stock'`, `usage_status = 'available'`.
   - Participates fully in available stockpile count, settlement, write-off, and aggregation as a distinct origin alongside `Shop Retained` and `Customer Redeemed`.
2. Refactor `TokenLedger.tsx` / `TokensView.tsx`:
   - Stockpile cards aggregated by `(brand_name, series_name, unit_name, token_value)`.
   - Settlement dialog filtered strictly by Brand, allowing partial quantity settlement.
   - Write-off modal with mandatory reason dropdown (`Damaged`, `Lost`, `Invalid`, `Other`).
3. Update `PurchasesView.tsx` and `FinancialLedgers.tsx` token selection modals to display and consume tokens using the new 4-part identity.

### Phase 7: Verification & Test Execution
1. Validate against all 33 test scenarios from the specification.
2. Run `npx tsc --noEmit` to ensure 0 TypeScript compilation errors.
3. Verify live drawer and accounting consistency.
