# Implementation Plan: Special Receipt Feature

**Product:** PyntFlow POS & Industrial ERP  
**Target Milestone:** Special Receipt Engine & CEO Audit Trail  
**Author:** Senior Full-Stack Engineer  
**Status:** DRAFT — Awaiting User Approval  
**Target Database:** PostgreSQL 17 (Supabase `ignspvajzblmsbertmmv`)  

---

## 1. Executive Summary & Architecture Overview

The "Special Receipt" feature introduces a secondary, completely decoupled receipt system designed for counter sales where companies require printing unbranded or customized receipts outside manufacturer-fixed price bands.

The implementation preserves the existing Regular Receipt engine without regression, while providing:
1. **A dedicated blank-canvas receipt designer** in the POS panel with zero automatic identity leaks (no store name, phone, address, logo, system branding, or browser headers/footers).
2. **A per-branch brand selector** to flag which product brands trigger the special receipt recommendation.
3. **A visually distinct "SPECIAL SAVE & PRINT" button** on the billing summary with dynamic blinking when matching brands are present in the cart, mapped to keyboard shortcut **`F6`**.
4. **Controlled pre-print editing** of item prices, discounts, descriptions, and totals. **Quantity is strictly locked** to protect physical stock decrement. The edited prices persist directly into `invoices` and `invoice_items` so that physical stock, profit reports, and Day Close cash remain 100% mathematically balanced.
5. **A tamper-proof, append-only CEO audit log** (`special_print_log`) storing `master_total` (sum of `items.retail_price * qty`), `charged_total`, `event_type` (`'sale'` | `'reprint'`), and complete JSONB snapshots (`receipt_snapshot` with per-line `list_price`, `template_snapshot`).
6. **Unified Transactional Atomicity:** Invoice save, stock decrement, customer balance update, and audit log write happen in **ONE single database transaction** via `create_special_invoice_atomic`. There are zero orphan invoices and zero unlogged receipts.
7. **Isolated Sales History Reprints:** Invoices marked `printed_as = 'special'` reprint exclusively from the logged snapshot via a dedicated snapshot endpoint, never leaking shop branding.

### 1.1 Conflicts Between Final Owner Decisions and Earlier Plan / Requirements

The following explicit conflicts between final owner decisions and earlier requirements or draft specifications are recorded and resolved here:

| # | Topic | Original Requirement / Earlier Plan | Final Owner Decision (Superseding) | Technical & Architectural Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **C1** | **Option A Content Rule vs Original Req 6** | Req 6 allowed free editing of unit rates and totals in the modal. | Cashier applies line discounts only; unit rates and totals locked. | Stored invoice uses real discounted amounts; paper derives `sum(qty * pre-discount rate)` server-side. |
| **C2** | **RLS is service_role Only vs Original Req 8** | Req 8: "RLS: insert only by permitted POS user, select only by CEO". | PyntFlow uses service_role API routes with application-level session auth (`requireTenantAuth`). | Public tables use service_role RLS; client anon/authenticated have all DML revoked; SECURITY DEFINER RPCs enforce immutability. |
| **C3** | **Standard POS Returns of Special Items Not Blocked (Accepted Risk)** | Earlier draft claimed standard returns would block special items. | Technically impossible to block; accepted risk. | No warning on standard return screen; legitimate returns handled via dedicated special return flow. |
| **C4** | **CEO Log Multi-Branch Scope (owner_name / email heuristic)** | Earlier draft considered explicit company_group_id. | Text heuristic accepted for this release. | Known limitation recorded; TASK-SR-01b tracks future company group migration. |
| **C5** | **Tenant Delete Cascades Log Rows (Accepted)** | Immutability trigger would block parent tenant deletion. | CASCADE allowed via `pg_trigger_depth() > 1`. | Immutability trigger permits deletion cascading from parent tenant (`pg_trigger_depth() > 1`), blocks direct DELETE (`depth = 1`). |
| **C6** | **Tokens Hidden on ALL Receipts Including Regular (Approved Global Change)** | Tokens printed on regular receipts. | Token claim slips and token notes suppressed globally on all receipts. | Render-layer change only in `receiptRenderCore.ts` and `receiptAdapters.ts`; database token ledger records unchanged. |
| **C7** | **Option E — No Receipt for Special Returns** | Earlier draft proposed blank-canvas return slip. | Zero receipt of any kind for special returns. | Confirmed; API returns `print_receipt: false`; return recorded in DB and audit trail. |
| **C8** | **F6 is Always Save and Print (No Save-Without-Print for Special)** | Earlier plan had separate F2 save-only for special sales. | F6 = Save & Print only. | No save-without-print button for special sales; audit log requires print intent. |

#### Authoritative Architecture Decisions

| Decision ID | Topic | Decision & Technical Rule |
| :--- | :--- | :--- |
| **D1** | **Special Invoice Edit Block** | Special invoices cannot be edited by anyone (staff, CEO, developer); wrong sale requires cancel + re-issue. |
| **D2** | **Special Receipt Reprint Restrictions** | Reprints permitted strictly for counter staff with fresh `can_use_special_receipt` in that branch; CEO has view-only access in CEO panel. |
| **D3** | **F6 Keyboard Shortcut** | Mapped strictly to Save & Print. Save-without-print is completely suppressed for special sales. |
| **D4** | **Special Return Printing** | Option E mandate: Zero paper output (no customer slip, no internal copy). |
| **D5** | **Cancellation of Special Returns** | Standard invoice cancellation endpoints (`PATCH /api/invoices` and `DELETE /api/invoices`) strictly block cancelling special return invoices (`invoice_type = 'return' AND printed_as = 'special'`). Residual risk of direct RPC calls to `cancel_invoice_atomic` is documented. |

### 1.2 POS Invoice Storage Rule & Worked Mathematical Example

PyntFlow maintains strict mathematical accounting across the POS drawer, inventory valuation, and sales reporting. Per Owner Decision 1, special invoices adhere strictly to the standard POS invoice storage rule:
- **`invoices.subtotal`** = sum of line totals **AFTER** line discounts.
- **`invoices.discount`** = invoice-level discount only (**strictly `0`** for special sales).
- Line discounts live exclusively in `invoice_items.discount` and `invoice_items.total_price`.

#### Worked Example: 2 x Rs. 2,000 Retail Items with Rs. 300 Discount Per Unit (Total Rs. 600 Discount)

| Field / Entity | Stored DB Value | Calculation / Source | Special Paper Output |
| :--- | :--- | :--- | :--- |
| `items.retail_price` | `2,000` | Catalog price in database | *Not printed* |
| `invoice_items.qty` | `2` | Sold quantity | `2` |
| `invoice_items.unit_price` | `2,000` | Pre-discount rate | `2,000` |
| `invoice_items.discount` | `600` | Line total discount (all units combined: 2 × 300) | **NEVER PRINTED** (suppressed) |
| `invoice_items.total_price` | `3,400` | Line total after discount (`2 * 2000 - 600`) | Derived `4,000` (`2 * 2000`) |
| `invoices.subtotal` | `3,400` | Sum of `invoice_items.total_price` | *Not printed* |
| `invoices.discount` | `0` | Invoice-level discount only (strictly 0) | **NEVER PRINTED** |
| `invoices.net_total` | `3,400` | Subtotal − invoice discount (`3,400 - 0`) | *Not printed as net* |
| `invoices.cash_paid` | `3,400` | Actual cash collected in drawer | *Not printed* |
| **Paper Receipt Total** | *Derived* | `sum(qty * pre_discount_rate) = 4,000` | **`Total: 4,000`** |

> [!IMPORTANT]
> **Rejection of Option B (4,000 / 600 / 3,400):** Option B would store `subtotal = 4,000` and `invoices.discount = 600`. This is explicitly rejected because it pollutes invoice-level discounts with line-item discounts, distorting POS profit reports, shift drawer summaries, and accounting ledger exports. Option A (`subtotal = 3,400`, `discount = 0`) perfectly preserves POS accounting integrity.

---

## 2. Final Data Model & Migration SQL Drafts

### 2.1 Codebase Tenancy, Foreign Keys & Immutability Rules
Following live database verification (PostgreSQL 17.6 on Supabase):
- The system user table is **`public.app_users`** with allowed roles `'ceo'`, `'developer'`, `'staff'` (POS user).
- Multi-tenancy entity is **`public.tenants`** (`id UUID`, `slug`, `name`, `type`, `owner_name`, `email`). All child tables reference `tenant_id`. No auxiliary `shop_id` column is added.
- **`special_print_log` Foreign Keys & Cascade Decisions:**
  - `invoice_id` and `user_id` are plain `UUID` columns (**NO** foreign key constraints, **NO** `ON DELETE SET NULL`). `invoice_no` and `printed_by` remain as immutable denormalized text copies. Even if an invoice or user is later archived or deleted, the audit log record remains 100% intact with its original identifiers.
  - `tenant_id` references `public.tenants(id) ON DELETE CASCADE`.
  - **Tenant Deletion Behavior:** The developer panel deletes tenants via `DELETE FROM tenants WHERE id = ...`. If `special_print_log` blocked deletion on tenant delete, the developer panel's tenant deletion would fail. Therefore, the immutability trigger allows cascade deletes only when `pg_trigger_depth() > 1` (a delete cascading from parent `tenants`). Direct `DELETE FROM special_print_log` (depth = 1) is blocked with an exception.
- **Trigger Immutability & Privilege Revocations:**
  - A row-level trigger `trg_immutable_special_print_log` blocks `UPDATE` and direct `DELETE`.
  - A statement-level trigger `trg_immutable_special_print_log_truncate` blocks `TRUNCATE`.
  - DML privileges are revoked: `REVOKE ALL ON public.special_receipt_templates, public.special_receipt_brands, public.special_print_log FROM anon, authenticated;`.
  - `REVOKE UPDATE, DELETE, TRUNCATE ON public.special_print_log FROM service_role;`.
- **Scope of Protection (What is & is not protected):**
  - *Protected:* All application code, Next.js API routes, Supabase client connections (`service_role`, `authenticated`, `anon`), and direct SQL DML queries (`UPDATE`, `DELETE`, `TRUNCATE`). Any attempt to alter, delete, or truncate records via application logic or standard database roles fails at both privilege checks and trigger executions.
  - *Not Protected:* PostgreSQL superusers (e.g., `postgres` role in raw DB console) possessing DDL privileges who can run `ALTER TABLE ... DISABLE TRIGGER`, drop the trigger/table, or modify table structures.

### 2.2 SQL Migration Draft (`20261021_01_special_receipt_system.sql`)
*(Note: Draft text only. Will NOT be applied until explicit approval).*

```sql
-- ============================================================================
-- Migration: 20261021_01_special_receipt_system.sql
-- Description: Special Receipt Engine & Immutable CEO Audit Trail
-- Database: PostgreSQL 17 (Supabase)
-- ============================================================================

-- 1. Add permission flag to app_users
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS can_use_special_receipt BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.app_users.can_use_special_receipt IS 
  'Enables access to the POS Special Receipt designer, brand selection, and Special Print action.';

-- 2. Add internal receipt type tracker to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS printed_as TEXT NOT NULL DEFAULT 'regular'
  CHECK (printed_as IN ('regular', 'special'));

COMMENT ON COLUMN public.invoices.printed_as IS 
  'Internal tracker: whether this invoice was printed with regular or special receipt. Never shown on receipts.';

-- 2b. Add original_invoice_id to invoices (used exclusively by Special Returns)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS original_invoice_id UUID;

COMMENT ON COLUMN public.invoices.original_invoice_id IS 
  'Nullable plain UUID referencing original sales invoice for special returns. No FK constraint.';

-- 2c. Add original_invoice_item_id to invoice_items (used exclusively by Special Returns)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS original_invoice_item_id UUID;

COMMENT ON COLUMN public.invoice_items.original_invoice_item_id IS 
  'Nullable plain UUID referencing original sales invoice_items.id for special returns. No FK constraint.';

-- 3. Table: special_receipt_templates
CREATE TABLE IF NOT EXISTS public.special_receipt_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  paper_size    TEXT NOT NULL DEFAULT 'thermal_80'
                  CHECK (paper_size IN ('thermal_80', 'thermal_58', 'a4', 'a5')),
  template_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_special_receipt_templates_tenant 
  ON public.special_receipt_templates(tenant_id);

-- 4. Table: special_receipt_brands
CREATE TABLE IF NOT EXISTS public.special_receipt_brands (
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  brand_id   UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_special_receipt_brands_lookup 
  ON public.special_receipt_brands(tenant_id, brand_id);

-- 5. Table: special_print_log
CREATE TABLE IF NOT EXISTS public.special_print_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_id        UUID,                                     -- Plain UUID, no FK constraint
  invoice_no        TEXT NOT NULL,                            -- Immutable denormalized copy
  printed_by        TEXT NOT NULL,                            -- Cashier name copy
  user_id           UUID,                                     -- Plain UUID, no FK constraint
  event_type        TEXT NOT NULL DEFAULT 'sale'
                      CHECK (event_type IN ('sale', 'reprint', 'return')),
  printed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  master_total      NUMERIC NOT NULL DEFAULT 0,               -- Sum of catalog items.retail_price * qty
  printed_total     NUMERIC NOT NULL DEFAULT 0,               -- Derived sum of qty * pre-discount rate
  charged_total     NUMERIC NOT NULL DEFAULT 0,               -- Actual net total charged
  delivery_charge   NUMERIC NOT NULL DEFAULT 0,               -- Logistics fee (excluded from catalog variance)
  original_invoice_id UUID,                                   -- Plain UUID for return events
  receipt_snapshot  JSONB NOT NULL,                           -- Contains items with list_price & charged_rate
  template_snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_special_print_log_tenant_date 
  ON public.special_print_log(tenant_id, printed_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_print_log_invoice_id 
  ON public.special_print_log(invoice_id);

CREATE INDEX IF NOT EXISTS idx_special_print_log_original_invoice 
  ON public.special_print_log(original_invoice_id) WHERE original_invoice_id IS NOT NULL;

-- Partial unique index: ensures exactly one 'sale' event per invoice_id (prevents duplicate sale logs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_special_print_log_sale
  ON public.special_print_log(invoice_id) WHERE event_type = 'sale';

-- 6. Triggers for special_print_log Immutability
CREATE OR REPLACE FUNCTION public.prevent_special_print_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow cascade deletion when parent tenant is deleted (trigger depth > 1)
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'special_print_log is an immutable audit trail. Updates and direct deletes are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_special_print_log ON public.special_print_log;
CREATE TRIGGER trg_immutable_special_print_log
BEFORE UPDATE OR DELETE ON public.special_print_log
FOR EACH ROW EXECUTE FUNCTION public.prevent_special_print_log_mutation();

CREATE OR REPLACE FUNCTION public.prevent_special_print_log_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'special_print_log is an immutable audit trail. Truncating is prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_special_print_log_truncate ON public.special_print_log;
CREATE TRIGGER trg_immutable_special_print_log_truncate
BEFORE TRUNCATE ON public.special_print_log
FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_special_print_log_truncate();

-- 7. Revoke table-level privileges from anon and authenticated; block mutations for service_role
REVOKE ALL ON public.special_receipt_templates, public.special_receipt_brands, public.special_print_log FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.special_print_log FROM service_role;

-- 8. Row Level Security Policies (Standard PyntFlow service_role backend architecture)
ALTER TABLE public.special_receipt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_receipt_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_print_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "special_receipt_templates_service_role" ON public.special_receipt_templates;
CREATE POLICY "special_receipt_templates_service_role" 
  ON public.special_receipt_templates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "special_receipt_brands_service_role" ON public.special_receipt_brands;
CREATE POLICY "special_receipt_brands_service_role" 
  ON public.special_receipt_brands FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "special_print_log_service_role" ON public.special_print_log;
CREATE POLICY "special_print_log_service_role" 
  ON public.special_print_log FOR ALL TO service_role USING (true) WITH CHECK (true);
```

### 2.3 Atomic RPC Functions: `create_special_invoice_atomic` & `log_special_reprint_atomic`

```sql
-- 1. Atomic Sale & Print RPC
CREATE OR REPLACE FUNCTION public.create_special_invoice_atomic(
  p_invoice_data    jsonb,
  p_items           jsonb,
  p_receipt_snap    jsonb,
  p_printed_by      text,
  p_user_id         uuid,
  p_tokens          jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id        UUID;
  v_invoice_no       TEXT;
  v_invoice_type     TEXT;
  v_invoice_id       UUID;
  v_client_id        UUID;
  v_shift_id         UUID;
  v_master_total     NUMERIC := 0;
  v_printed_total    NUMERIC := 0;
  v_charged_total    NUMERIC := 0;
  v_subtotal_calc    NUMERIC := 0;
  v_discount_calc    NUMERIC := 0;
  v_delivery_calc    NUMERIC := 0;
  v_paid_amount      NUMERIC := 0;
  v_due_amount       NUMERIC := 0;
  v_cash_paid        NUMERIC := 0;
  v_card_paid        NUMERIC := 0;
  v_bank_paid        NUMERIC := 0;
  v_others_paid      NUMERIC := 0;
  v_item             JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_name        TEXT;
  v_catalog_name     TEXT;
  v_item_qty         NUMERIC;
  v_item_price       NUMERIC;
  v_item_discount    NUMERIC;
  v_item_total_price NUMERIC;
  v_line_expected    NUMERIC;
  v_master_price     NUMERIC;
  v_clean_items      JSONB := '[]'::jsonb;
  v_enriched_items   JSONB := '[]'::jsonb;
  v_enriched_snap    JSONB;
  v_stored_template  JSONB;
  v_user_rec         RECORD;
  v_inv_res          JSONB;
  v_existing_inv     RECORD;
  v_existing_log     RECORD;
BEGIN
  v_tenant_id    := (p_invoice_data->>'tenant_id')::UUID;
  v_invoice_no   := TRIM(p_invoice_data->>'invoice_no');
  v_invoice_type := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_client_id    := NULLIF(p_invoice_data->>'client_id', '')::UUID;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF v_invoice_no IS NULL OR v_invoice_no = '' THEN
    RAISE EXCEPTION 'invoice_no is required';
  END IF;

  -- R1g: Validate shift exists, belongs to tenant, and is active/open
  v_shift_id := (p_invoice_data->>'shift_id')::UUID;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special invoice';
  END IF;
  PERFORM 1 FROM shifts WHERE id = v_shift_id AND tenant_id = v_tenant_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', v_shift_id;
  END IF;

  -- A10: Transaction-level advisory lock serializes double submits on (tenant_id, invoice_no)
  PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || v_invoice_no));

  -- B4: Enforce invoice_type = 'sales' (returns strictly handled via create_special_return_atomic)
  IF v_invoice_type <> 'sales' THEN
    RAISE EXCEPTION 'create_special_invoice_atomic only accepts sales invoices. Return invoices must use create_special_return_atomic.';
  END IF;

  -- Security: Verify user identity & fresh special permission in database
  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec
    FROM app_users
   WHERE id = p_user_id;

  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Special checkout is restricted to counter staff';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;
  IF v_user_rec.tenant_id <> v_tenant_id THEN
    RAISE EXCEPTION 'User does not belong to target branch';
  END IF;

  -- B1: Idempotency Check
  SELECT * INTO v_existing_inv
    FROM invoices
   WHERE tenant_id = v_tenant_id
     AND invoice_no = v_invoice_no;

  IF FOUND THEN
    -- Accept duplicate ONLY if printed_as = 'special' AND special_print_log exists with event_type = 'sale' AND log.user_id = p_user_id
    IF v_existing_inv.printed_as <> 'special' THEN
      RAISE EXCEPTION 'Invoice number % already exists as a non-special invoice', v_invoice_no;
    END IF;

    SELECT * INTO v_existing_log
      FROM special_print_log
     WHERE invoice_id = v_existing_inv.id
       AND event_type = 'sale'
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice number % exists as special but missing sales audit log', v_invoice_no;
    END IF;

    IF v_existing_log.user_id <> p_user_id THEN
      RAISE EXCEPTION 'Invoice number % was created by another user (%)', v_invoice_no, v_existing_log.printed_by;
    END IF;

    -- Return identical shape as fresh return for transparent frontend retry
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice_id', v_existing_inv.id,
      'invoice_no', v_invoice_no,
      'master_total', v_existing_log.master_total,
      'printed_total', v_existing_log.printed_total,
      'charged_total', v_existing_log.charged_total,
      'invoice', row_to_json(v_existing_inv)::jsonb,
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- Option A Content Rule & Server Derivations:
  -- Cashier cannot edit unit rates or totals. Only line discounts are applied in the modal.
  -- Invoice-level discount is explicitly REJECTED (F8); only per-line discounts are allowed.

  -- F8: Reject any non-zero invoice-level discount sent by client.
  IF COALESCE((p_invoice_data->>'discount')::NUMERIC, 0) > 0 THEN
    RAISE EXCEPTION 'Invoice-level discounts are not allowed on special invoices. Use per-line discounts only.';
  END IF;

  v_discount_calc := 0;
  v_delivery_calc := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);

  IF v_delivery_calc < 0 THEN
    RAISE EXCEPTION 'Delivery charge cannot be negative';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id          := NULLIF(v_item->>'item_id', '')::UUID;
    v_item_code        := TRIM(COALESCE(v_item->>'item_code', ''));
    v_item_qty         := (v_item->>'qty')::NUMERIC;
    v_item_price       := (v_item->>'unit_price')::NUMERIC;
    v_item_discount    := COALESCE((v_item->>'discount')::NUMERIC, 0);
    v_item_total_price := (v_item->>'total_price')::NUMERIC;
    v_item_name        := COALESCE(v_item->>'item_name', 'Item');

    -- Line validation (Option A: Reject, never silently clamp)
    IF v_item_qty IS NULL OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity (%) for item "%": must be greater than zero', v_item_qty, v_item_name;
    END IF;
    IF v_item_price IS NULL OR v_item_price < 0 THEN
      RAISE EXCEPTION 'Invalid unit price (%) for item "%": cannot be negative', v_item_price, v_item_name;
    END IF;
    IF v_item_discount < 0 OR v_item_discount > (v_item_qty * v_item_price) THEN
      RAISE EXCEPTION 'Invalid discount (%) for item "%": must be between 0 and line gross (%)',
        v_item_discount, v_item_name, (v_item_qty * v_item_price);
    END IF;

    v_line_expected := (v_item_qty * v_item_price) - v_item_discount;
    IF v_item_total_price IS NULL OR ABS(ROUND(v_item_total_price - v_line_expected, 2)) > 0.02 THEN
      RAISE EXCEPTION 'Total price mismatch for item "%": client sent %, calculated %',
        v_item_name, v_item_total_price, v_line_expected;
    END IF;

    -- B5: Item catalog lookup (strict: RAISE EXCEPTION if missing)
    IF v_item_id IS NOT NULL THEN
      SELECT retail_price, name INTO v_master_price, v_catalog_name
        FROM items WHERE id = v_item_id AND tenant_id = v_tenant_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found for tenant', v_item_id;
      END IF;
    ELSIF v_item_code <> '' THEN
      SELECT id, retail_price, name INTO v_item_id, v_master_price, v_catalog_name
        FROM items WHERE tenant_id = v_tenant_id AND code = v_item_code;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with code "%" not found for tenant', v_item_code;
      END IF;
    ELSE
      RAISE EXCEPTION 'Item ID or code is required for each line item';
    END IF;

    -- Accumulate totals:
    v_master_total := v_master_total + (v_master_price * v_item_qty);
    v_printed_total := v_printed_total + (v_item_price * v_item_qty);
    v_subtotal_calc := v_subtotal_calc + v_item_total_price;

    -- B6: Clean item for create_invoice_atomic (strip receipt overrides, force pure catalog name)
    v_clean_items := v_clean_items || jsonb_build_array(
      (v_item - 'receipt_name' - 'receipt_shade' - 'receipt_pack_size' - 'receipt_notes')
      || jsonb_build_object(
        'item_id', v_item_id,
        'item_name', v_catalog_name,
        'unit_price', v_item_price,
        'discount', v_item_discount,
        'total_price', v_item_total_price
      )
    );

    -- R5b: Enriched snapshot with strict whitelist per-item keys (v_enriched_items does NOT merge raw v_item)
    v_enriched_items := v_enriched_items || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id,
        'item_code', v_item_code,
        'item_name', v_catalog_name,
        'receipt_name', LEFT(COALESCE(v_item->>'receipt_name', v_catalog_name), 200),
        'receipt_shade', LEFT(COALESCE(v_item->>'receipt_shade', ''), 100),
        'receipt_pack_size', LEFT(COALESCE(v_item->>'receipt_pack_size', ''), 100),
        'receipt_notes', LEFT(COALESCE(v_item->>'receipt_notes', ''), 200),
        'qty', v_item_qty,
        'unit_price', v_item_price,
        'pre_discount_rate', v_item_price,
        'discount', v_item_discount,
        'total_price', v_item_total_price,
        'catalog_name', v_catalog_name,
        'list_price', v_master_price,
        'charged_rate', (v_item_total_price / v_item_qty),
        'line_discount', v_item_discount,
        'line_variance', (v_item_total_price - (v_master_price * v_item_qty))
      )
    );
  END LOOP;

  -- F7: Delivery charge is included in both printed_total and charged_total, but NOT in master_total.
  -- master_total = sum(catalog retail_price * qty)  — delivery excluded (catalog cost basis)
  -- printed_total = sum(qty * unit_price) + delivery — what the paper shows
  -- charged_total  = subtotal_after_line_discounts + delivery — actual money collected
  v_printed_total := v_printed_total + v_delivery_calc;
  v_charged_total := v_subtotal_calc + v_delivery_calc - v_discount_calc;

  -- B3: Payments Validation with 0.02 rounding tolerance
  v_paid_amount := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount  := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_cash_paid   := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid   := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid   := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);

  IF ABS(ROUND((v_cash_paid + v_card_paid + v_bank_paid + v_others_paid) - v_paid_amount, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Tender breakdown (cash % + card % + bank % + others %) does not equal paid_amount (%) within 0.02 tolerance',
      v_cash_paid, v_card_paid, v_bank_paid, v_others_paid, v_paid_amount;
  END IF;

  IF ABS(ROUND((v_paid_amount + v_due_amount) - v_charged_total, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Paid amount (%) + due amount (%) does not equal charged total (%) within 0.02 tolerance',
      v_paid_amount, v_due_amount, v_charged_total;
  END IF;

  IF v_due_amount > 0 AND v_client_id IS NULL THEN
    RAISE EXCEPTION 'Credit sales with balance due require a registered customer account';
  END IF;

  -- 2. Call standard atomic invoice creator (tokens passed through identically)
  v_inv_res := public.create_invoice_atomic(
    p_invoice_data || jsonb_build_object(
      'subtotal', v_subtotal_calc,
      'discount', v_discount_calc,
      'delivery_charge', v_delivery_calc,
      'net_total', v_charged_total,
      'paid_amount', v_paid_amount,
      'due_amount', v_due_amount
    ),
    v_clean_items,
    p_tokens
  );

  v_invoice_id := COALESCE((v_inv_res->>'invoice_id')::UUID, (v_inv_res->'invoice'->>'id')::UUID);

  -- 3. Explicitly mark invoice as special
  UPDATE invoices
     SET printed_as = 'special'
   WHERE id = v_invoice_id;

  -- A3: Authoritative server-side template resolution & snapshot construction
  -- Uses BLANK_SPECIAL_TEMPLATE_JSON constant matching src/types/receipt.ts if no DB row exists.
  SELECT template_json INTO v_stored_template
    FROM special_receipt_templates
   WHERE tenant_id = v_tenant_id;

  IF NOT FOUND OR v_stored_template IS NULL THEN
    v_stored_template := '{
      "paper_size": "thermal_80",
      "header": {"showShopName": false, "customShopName": "", "showAddress": false, "customAddress": "", "showPhone": false, "customPhone": "", "showLogo": false, "logoUrl": ""},
      "invoiceInfo": {"showCashier": false},
      "footer": {"showPoweredBy": false, "poweredByText": ""},
      "tokenClaimSlip": {"enabled": false}
    }'::jsonb;
  END IF;

  -- R4 & R5b: Server-constructed snapshot with whitelisted keys and correct delivery-excluded variance
  v_enriched_snap := jsonb_build_object(
    'header_note', LEFT(COALESCE(p_receipt_snap->>'header_note', ''), 500),
    'footer_note', LEFT(COALESCE(p_receipt_snap->>'footer_note', ''), 500),
    'delivery_charge', v_delivery_calc,
    'items', v_enriched_items,
    'master_total', v_master_total,
    'printed_total', v_printed_total,
    'charged_total', v_charged_total,
    'total_variance', ((v_charged_total - v_delivery_calc) - v_master_total)
  );

  -- 5. Insert immutable audit log with exception handling for partial index concurrency (A10)
  BEGIN
    INSERT INTO special_print_log (
      tenant_id,
      invoice_id,
      invoice_no,
      printed_by,
      user_id,
      event_type,
      printed_at,
      master_total,
      printed_total,
      charged_total,
      delivery_charge,
      receipt_snapshot,
      template_snapshot
    ) VALUES (
      v_tenant_id,
      v_invoice_id,
      v_invoice_no,
      p_printed_by,
      p_user_id,
      'sale',
      NOW(),
      v_master_total,
      v_printed_total,
      v_charged_total,
      v_delivery_calc,
      v_enriched_snap,
      v_stored_template
    );
  EXCEPTION WHEN unique_violation THEN
    -- In race conditions, return existing log row idempotently
    SELECT * INTO v_existing_log
      FROM special_print_log
     WHERE invoice_id = v_invoice_id AND event_type = 'sale' LIMIT 1;
    RETURN jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'invoice_id', v_invoice_id,
      'invoice_no', v_invoice_no,
      'master_total', v_existing_log.master_total,
      'printed_total', v_existing_log.printed_total,
      'charged_total', v_existing_log.charged_total,
      'delivery_charge', v_existing_log.delivery_charge,
      'invoice', v_inv_res->'invoice',
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END;

  -- Return server-derived totals and snapshots so client prints strictly from verified data
  RETURN jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'invoice_id', v_invoice_id,
    'invoice_no', v_invoice_no,
    'master_total', v_master_total,
    'printed_total', v_printed_total,
    'charged_total', v_charged_total,
    'delivery_charge', v_delivery_calc,
    'invoice', v_inv_res->'invoice',
    'snapshot', v_enriched_snap,
    'template', v_stored_template
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_special_invoice_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_special_invoice_atomic TO service_role;

-- 2. Atomic Reprint Logging RPC (A4 & D2)
CREATE OR REPLACE FUNCTION public.log_special_reprint_atomic(
  p_invoice_id      uuid,
  p_user_id         uuid,
  p_printed_by      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orig_log        RECORD;
  v_user_rec        RECORD;
  v_inv_tenant      UUID;
  v_inv_status      TEXT;
  v_inv_printed_as  TEXT;
BEGIN
  -- A4: Verify user identity & authorization first
  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec
    FROM app_users
   WHERE id = p_user_id;

  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;

  -- D2 Mandate: Special receipt reprint is allowed ONLY for staff with fresh can_use_special_receipt in that branch.
  -- CEO and developer roles are strictly blocked from reprinting. CEO only views snapshot in log view.
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Reprint restricted to authorized counter staff. CEO reprint is not permitted.';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;

  -- R5d: Uniform error on not found or branch mismatch (no branch existence leakage)
  SELECT tenant_id, status, printed_as 
    INTO v_inv_tenant, v_inv_status, v_inv_printed_as
    FROM invoices
   WHERE id = p_invoice_id;

  IF NOT FOUND OR v_inv_tenant <> v_user_rec.tenant_id THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;

  IF v_inv_printed_as <> 'special' THEN
    RAISE EXCEPTION 'Invoice % is not a special receipt invoice', p_invoice_id;
  END IF;

  IF v_inv_printed_as <> 'special' THEN
    RAISE EXCEPTION 'Invoice % is not a special receipt invoice', p_invoice_id;
  END IF;

  IF v_inv_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot reprint cancelled invoice %', p_invoice_id;
  END IF;

  -- Note on returned invoices:
  -- If an invoice was partially or fully returned, reprinting is permitted.
  -- The reprint reflects the original sale as it was printed at checkout, and an audit row is logged with event_type = 'reprint'.

  -- Verify original special print log exists
  SELECT * INTO v_orig_log
    FROM special_print_log
   WHERE invoice_id = p_invoice_id
     AND event_type = 'sale'
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original special print record not found for invoice %', p_invoice_id;
  END IF;

  -- Insert immutable reprint audit record
  INSERT INTO special_print_log (
    tenant_id,
    invoice_id,
    invoice_no,
    printed_by,
    user_id,
    event_type,
    printed_at,
    master_total,
    printed_total,
    charged_total,
    receipt_snapshot,
    template_snapshot
  ) VALUES (
    v_orig_log.tenant_id,
    v_orig_log.invoice_id,
    v_orig_log.invoice_no,
    p_printed_by,
    p_user_id,
    'reprint',
    NOW(),
    v_orig_log.master_total,
    v_orig_log.printed_total,
    v_orig_log.charged_total,
    v_orig_log.receipt_snapshot,
    v_orig_log.template_snapshot
  );

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'snapshot', v_orig_log.receipt_snapshot,
    'template', v_orig_log.template_snapshot
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.log_special_reprint_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_special_reprint_atomic TO service_role;
```

### 2.4 RPC Field Provenance Matrix (B8 Audit)

Every parameter and field processed by `create_special_invoice_atomic` is audited below by authoritative source:

| Field | Source | Validation & Security Rule |
| :--- | :--- | :--- |
| `tenant_id` | **Session** (`auth.session.tenantId`) | Enforced in API route from authenticated session; validated against `app_users.tenant_id`. |
| `user_id` (`p_user_id`) | **Session** (`auth.session.userId`) | Enforced in API route; checked fresh in DB for active status and `can_use_special_receipt`. |
| `printed_by` (`p_printed_by`) | **Session** (`auth.session.fullName` / `username`) | Enforced in API route from session token. |
| `shift_id` | **Session / Active Shift** | Looked up in API route for the active open shift of the tenant; never trusted from body. |
| `created_by` | **Session** (`auth.session.fullName` / `username`) | Enforced in API route; overrides client body. |
| `invoice_type` | **Hardcoded Server Rule** | Strictly enforced to `'sales'` in RPC (returns rejected). |
| `date` | **Server / Session Context** | Coalesced to `CURRENT_DATE` in `create_invoice_atomic`. |
| `invoice_no` | **Client Request** | Validated via DB idempotency: duplicate rejected unless previous special sale by same user. |
| `client_id` | **Client Request** | Validated against `clients` table; required if `due_amount > 0`. |
| `client_name` | **Database Catalog / Sanitized** | Looked up from `clients` if `client_id` provided; otherwise `'Walk-in Customer'`. |
| `items[].item_id` | **Client Request** | Strictly verified in `items` table `WHERE tenant_id = v_tenant_id`; exception raised if missing. |
| `items[].qty` | **Client Request** | Verified server-side: NUMERIC > 0. Physical stock deducted in DB. Locked from editing in modal. |
| `items[].unit_price` | **Client Request** | Option A: Pre-discount unit rate from cart. Locked from editing in modal. Printed on special receipt. |
| `items[].discount` | **Client Request** | Line discount applied by cashier in special modal. Verified: 0 <= discount <= qty * unit_price. |
| `items[].total_price` | **Client Request** | Rejected unless equals `qty * unit_price - discount` within 0.02 tolerance. |
| `items[].item_name` (DB) | **Database Catalog** | Overwritten in `v_clean_items` by authoritative `items.name` from DB catalog. |
| `items[].receipt_name` | **Client Request** | Stored strictly in `receipt_snapshot`; stripped from `invoice_items`. |
| `items[].receipt_shade` | **Client Request** | Stored strictly in `receipt_snapshot`; stripped from `invoice_items`. |
| `master_price` | **Database Catalog** | Authoritatively read from `items.retail_price`. |
| `master_total` | **Computed Server-Side** | `sum(qty * items.retail_price)` computed in PL/pgSQL loop. |
| `printed_total` | **Computed Server-Side** | `sum(qty * unit_price)` (what the special receipt displays: pre-discount rates). |
| `delivery_charge` | **Client Request** | Verified server-side: NUMERIC >= 0. |
| `invoice-level discount`| **Client Request** | Default disallowed in special checkout modal (set to 0; line discounts only). |
| `charged_total` | **Computed Server-Side** | `sum(line totals) + delivery_charge - invoice_discount` computed in PL/pgSQL. Actual billed money. |
| `paid_amount` | **Client Request** | Validated server-side: must equal sum of tenders and `charged_total - due_amount` within 0.02. |
| `due_amount` | **Client Request** | Validated server-side: rejected if > 0 without registered `client_id`. |
| `cash_paid`, `card_paid`, `bank_paid`, `others_paid` | **Client Request** | Validated server-side: sum must equal `paid_amount` within 0.02. |
| `tokens` | **Client Request** | **Decision 1: Full Pass-Through.** Passed directly to `create_invoice_atomic`. Token business logic operates identically for special and regular sales. Token claim slips and notes are suppressed at the print render layer. |
| `receipt_snapshot` | **Constructed Server-Side** | Assembled in PL/pgSQL with enriched catalog comparison (`master_total`, `printed_total`, `charged_total`). |
| `template_snapshot` | **Loaded Server-Side** | Resolved from `special_receipt_templates` for `tenant_id` (fallback: `BLANK_SPECIAL_TEMPLATE_JSON`). |

---

## 3. API Authorization & Multi-Branch Access Rules

### 3.1 CEO Authorization Architecture (Decision 6 - Option 1)
- **Branch Selection After Login:** In the CEO panel, the CEO selects an active branch from their authorized branch selector. The Special Receipt Log View displays audit logs for that selected branch.
- **Authorization Enforcement (`requireTenantAuth`):**
  - Uses the same branch authorization mechanism as existing CEO panel screens (`requireTenantAuth` in [`src/lib/session.ts`](file:///d:/bestow/p-industry/src/lib/session.ts)), which resolves CEO multi-branch access via sister-tenant matching (`owner_name` / `email`).
  - This ensures consistent behavior across all CEO dashboard views without introducing divergent auth patterns.
- **Accepted Architectural Limitation:** The reliance on `owner_name` / `email` text heuristic is recorded as an accepted limitation under Section 1.1 Conflicts (C4). The proposal for an explicit company group table (`company_group_id` / `owner_user_id`) remains tracked under `TASK-SR-01b` as a future release item.

### 3.2 Fresh Database Permission Check (Anti-Stale Token Rule)
In all routes touching the Special Receipt feature, **do NOT trust `session.can_use_special_receipt`**.
Every handler queries `app_users` fresh from Supabase on every request. If permission is revoked in the Developer Panel, the cashier's active session is blocked on their next action without requiring logout.

### 3.3 Endpoint Authorization Matrix

| HTTP Method & Route | Role Requirement | Fresh DB Check | Scope / Access Rule |
| :--- | :--- | :--- | :--- |
| `POST /api/invoices/special` | `'staff'` only | Fresh query `can_use_special_receipt === true` | Calls `create_special_invoice_atomic`. CEO and Developer are rejected (`403 Forbidden`). |
| `POST /api/invoices` (Regular checkout) | Any authorized | None | Ignores/rejects `printed_as = 'special'`. Forces `printed_as = 'regular'`. |
| `PATCH /api/invoices` (Invoice Edit) | Any authorized | None | **D1 Mandate:** Rejects if `invoices.printed_as = 'special'` (`400 Bad Request`). Special invoices cannot be edited by anyone. |
| `GET /api/special-receipt-templates` | `'staff'` | Fresh query `can_use_special_receipt === true` | Scoped to caller's `tenant_id`. Rejects unauthorized staff with 403. |
| `POST /api/special-receipt-templates` | `'staff'` | Fresh query `can_use_special_receipt === true` | Scoped to caller's `tenant_id`. |
| `GET /api/special-receipt-brands` | `'staff'` | Fresh query `can_use_special_receipt === true` | Scoped to caller's `tenant_id`. Rejects unauthorized staff with 403. |
| `POST /api/special-receipt-brands` | `'staff'` | Fresh query `can_use_special_receipt === true` | Scoped to caller's `tenant_id`. |
| `GET /api/special-print-log` | `'ceo'` only | Verified role `'ceo'` in DB | Scoped to CEO's assigned branch (`auth.session.tenantId`). Developer is rejected (`403 Forbidden`). |
| `GET /api/special-print-log/snapshot` | Authorized `'staff'` or `'ceo'` | Fresh query for staff; tenant check for CEO | Returns snapshot for single `invoice_id`. Used by Sales History reprint (staff) and Log View preview (CEO). |
| `POST /api/special-print-log/reprint` | Authorized `'staff'` only | Fresh query `can_use_special_receipt === true` | **D2 Mandate:** Calls `log_special_reprint_atomic`. Staff with branch permission ONLY. CEO and Developer are rejected (`403 Forbidden`). Blocked if cancelled. |
| `POST / PUT / DELETE /api/special-print-log` | Any | *None* | **Hard blocked: `405 Method Not Allowed`** (Log rows are written only by atomic RPCs). |

### 3.4 `/api/invoices/special` Validation Parity Suite (A5 Audit)

To guarantee that special checkout enforces identical financial, credit, and shift controls as regular checkout ([`POST /api/invoices`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts#L116-L253)), `/api/invoices/special` executes the following explicit checks before invoking `create_special_invoice_atomic`:

1. **Authentication & Branch Isolation:**
   - Calls `requireTenantAuth(req, tenant_id)`. Verifies session is valid and caller is authorized for `tenant_id`.
   - Rejects non-staff roles with `403 Forbidden` (`role === 'staff'` strictly required; CEO and Developer cannot initiate special sales).
2. **Fresh Permission Verification:**
   - Queries `app_users` fresh from DB: `SELECT is_active, can_use_special_receipt FROM app_users WHERE id = auth.user.id`.
   - Rejects if `is_active !== true` or `can_use_special_receipt !== true`.
3. **Session-Derived User Identity:**
   - `created_by` and `printed_by` are derived directly from the authenticated session (`auth.user.fullName` || `auth.user.username`). Client payload values are strictly ignored.
4. **Active Shift Lookup & Validation:**
   - Queries `shifts` table for the tenant: `WHERE tenant_id = tenant_id AND status = 'open' LIMIT 1`.
   - Rejects with `400 Bad Request` if no open shift exists (`"Cannot record sale without an active open shift"`). Binds verified `shift_id`.
5. **VAL-03 Price & Margin Bounds Validation:**
   - `subtotal >= 0`, `discount >= 0`, `delivery_charge >= 0`, `net_total >= 0`, `paid_amount >= 0`, `due_amount >= 0`.
   - For every item: `qty > 0`, `unit_price >= 0`, `discount_percent >= 0 && discount_percent <= 100`, `discount >= 0 && discount <= (qty * unit_price)`.
6. **Customer Account & Credit Limit Enforcement:**
   - If `due_amount > 0` and `client_id` is null/empty: Rejects with `400 Bad Request` (`"Cannot record a credit sale without a customer account"`).
   - If `client_id` is provided and `due_amount > 0`: Queries `clients` table for `credit_limit` and `current_balance`. If `current_balance + due_amount > credit_limit`, rejects with `400 Bad Request` (`"Insufficient credit limit. Available limit: Rs. ..."`).
7. **Rate Limiting & Anti-Spam:**
   - Applies the same IP and tenant-scoped rate limiting headers used by `/api/invoices` to prevent rapid automated replay submissions.

---

## 4. Frontend Plan & Component Architecture

### A. Blank-Canvas Special Template Definition
In [`src/types/receipt.ts`](file:///d:/bestow/p-industry/src/types/receipt.ts), `BLANK_SPECIAL_TEMPLATE_JSON` guarantees zero identity defaults:
- `header.showShopName: false`, `customShopName: ''`
- `header.showAddress: false`, `customAddress: ''`
- `header.showPhone: false`, `customPhone: ''`
- `header.showLogo: false`, `logoUrl: ''`
- `invoiceInfo.showCashier: false`
- `footer.showPoweredBy: false`, `poweredByText: ''`
- `tokenClaimSlip.enabled: false`

### B. Special Receipt Designer in POS Panel
- **File:** `src/components/SpecialReceiptSettings.tsx`
- **Location:** Dedicated sub-tab inside POS Receipt Settings (`activeTab === 'receipt'`).
- **Visibility:** Visible **only if** `currentUser?.can_use_special_receipt === true`.
- **Features:** Live thermal preview simulator (`DevReceiptPreview`), blank canvas customization, brand trigger checkboxes.

### C. Billing Summary Button Placement
- **File:** [`src/components/PosBilling.tsx`](file:///d:/bestow/p-industry/src/components/PosBilling.tsx#L2064-L2108)
- Placed directly **ABOVE** the orange `SAVE & PRINT (F5)` button.
- Violet/indigo gradient `#4F46E5`, 800 weight font.
- Dynamic pulse/blink animation when any item in cart belongs to a brand in `specialBrandIds`.
- Keyboard shortcut: **`F6`** (Decision 3: F6 is always Save & Print; no save-without-print for special).

### D. Special Print Pre-Print Editor Modal Spec (Option A Content Rule)
When `SPECIAL SAVE & PRINT (F6)` is clicked, `SpecialPrintModal.tsx` opens:
1. **Frontend Invoice Number Generation:**
   - The modal generates `invoice_no` **ONCE** when the modal opens and reuses it across any retry attempts.
2. **Rates and Totals are STRICTLY LOCKED (Option A):**
   - The cashier **CANNOT edit unit rates and CANNOT edit the total**. Rates are pulled directly from the cart's pre-discount prices and displayed as locked.
   - The `Qty` column is strictly locked to prevent inventory corruption.
3. **Line Discounts Only:**
   - Cashier enters line-level discounts only (`discount` in Rs. or `discount_percent`).
   - Invoice-level discount field is disabled/hidden by default in the special modal.
4. **Editable Receipt-Only Overrides (Receipt Snapshot):**
   - Line item description text override (`receipt_name`, e.g. generic product description).
   - Shade code / pack size override (`receipt_shade`, `receipt_pack_size`).
   - Header note / footer note text overrides.
   - `create_special_invoice_atomic` strips these overrides from DB `invoice_items` (preserving catalog integrity) and saves them exclusively in `receipt_snapshot`.
5. **Special Printed Receipt Appearance:**
   - Printed special receipt shows pre-discount rates and a total derived server-side as `sum(qty * pre-discount rate)`.
   - **Zero Discount Disclosure:** The receipt renderer NEVER outputs discount lines, discount percentages, or the word "Discount" anywhere on the paper.
   - Payment lines (paid/change/balance) are hidden by default to avoid revealing the price difference.
6. **Live Totals Bar & Metrics:**
   - Master Catalog Total: `sum(qty * catalog items.retail_price)`.
   - Printed Total: `sum(qty * pre-discount rate) + delivery_charge` (what the paper displays).
   - Charged Total: actual net total charged to customer after line discounts + delivery_charge.
   - Price Variance: `(charged_total - delivery_charge) - master_total` (displayed in amber).

### E. CEO Special Print Log View & Preview Modal (Decision 2 & 6)
- **Navigation:** [`src/components/ceo-panel/ExecutiveSidebar.tsx`](file:///d:/bestow/p-industry/src/components/ceo-panel/ExecutiveSidebar.tsx) under "Special Print Log" (`ScrollText` icon).
- **Access:** Restricted to role `'ceo'` for their selected branch (using existing `requireTenantAuth` sister-branch resolution).
- **Table Columns:** Date & Time, Branch Name, Cashier Name, Invoice #, Invoice Status (`completed` / `cancelled`), Event Type (`Sale` / `Reprint` / `Return`), Master Total, Printed Total, Charged Total, Delivery Charge, Price Variance, Action (`Preview Receipt`).
- **Event Type & Status Badges:**
  - Sales: Green "SALE" badge.
  - Reprints: Blue "REPRINT" badge.
  - Returns: Orange "RETURN" badge (with clickable link to original special invoice).
  - Cancelled Invoices: Red "CANCELLED" badge.
- **Financial Metric Cards Rule:** Header metric cards (Total Sales Count, Total Master Value, Total Charged Value, Total Variance) **STRICTLY EXCLUDE rows where `event_type IN ('reprint', 'return')`** to prevent revenue duplication or return distortion.
- **Preview Modal (`SpecialReceiptPreviewModal.tsx`):**
  - Renders pixel-perfect receipt using `log.receipt_snapshot` and `log.template_snapshot`.
  - Shows comprehensive 3-way line comparison: Item Name, Qty, Master Catalog Price, Printed Paper Rate, Actual Charged Rate, Line Variance.
  - Read-only; zero editing or reprinting capability (CEO does NOT have a reprint button per D2).

---

## 5. Developer Panel User Management Changes

In [`src/components/dev-panel/DevUserModal.tsx`](file:///d:/bestow/p-industry/src/components/dev-panel/DevUserModal.tsx):
- Add state: `const [canUseSpecialReceipt, setCanUseSpecialReceipt] = useState<boolean>(false);`.
- Render toggle when `role === 'staff'`:
  - Label: *"Special Receipt Permission"*.
  - Subtext: *"Allow this POS cashier to design and print unbranded Special Receipts"*.
- Saves to `app_users.can_use_special_receipt` via `/api/users`.

---

## 6. Print Flow Sequence Diagram & Failure Handling

### 6.1 Transactional Sequence Diagram (B7)

```mermaid
sequenceDiagram
    autonumber
    actor Cashier as POS Cashier
    participant Modal as SpecialPrintModal
    participant API as /api/invoices/special
    participant DB as PostgreSQL (create_special_invoice_atomic)
    participant Frame as iframePrint Service

    Cashier->>Modal: Clicks "Confirm & Print Special Receipt" (or F6)
    Note over Modal: Generates invoice_no ONCE; locks submit button (submitting = true)
    Modal->>API: POST /api/invoices/special (p_invoice_data, p_items, p_receipt_snap)
    
    rect rgb(240, 248, 255)
    Note over API,DB: Single PostgreSQL Transaction (create_special_invoice_atomic)
    API->>DB: Verify app_users (staff, is_active, fresh can_use_special_receipt)
    API->>DB: Idempotency check: accept only if special sale by same user; else RAISE EXCEPTION
    API->>DB: Line validation: qty > 0, price >= 0, line discount bounds, strict total_price check
    API->>DB: Look up items in DB catalog (RAISE EXCEPTION if missing, no price fallback)
    API->>DB: Strip receipt overrides from items, force catalog name for invoice_items
    API->>DB: Validate payment breakdown & charged_total
    API->>DB: Execute create_invoice_atomic (invoice_type = 'sales')
    API->>DB: UPDATE invoices SET printed_as = 'special'
    API->>DB: INSERT into special_print_log (master_total, charged_total, snapshots)
    end

    alt Database Transaction Fails
        DB-->>API: ROLLBACK (Zero changes persisted)
        API-->>Modal: 400/500 Error JSON
        Modal->>Cashier: Show error toast. Print dialog is NEVER called.
    else Transaction Commits Successfully
        DB-->>API: COMMIT (invoice_id, invoice_no, master_total, charged_total, snapshot, template)
        API-->>Modal: 200 OK with server-returned enriched snapshot and template
        Note over Modal,Frame: B7: Frontend prints strictly from RETURNED snapshot, not local HTML
        Modal->>Frame: printViaIframe(buildSpecialThermalHtml(data.snapshot, data.template))
        Frame-->>Cashier: Browser Print Dialog opens (zero margin, title "Receipt")
    end
```

### 6.2 Failure & Concurrency Edge Cases

| Failure Event | System Behavior & Data State |
| :--- | :--- |
| **Audit log insert failure** | Handled inside `create_special_invoice_atomic` transaction. The transaction aborts and rolls back completely. **No invoice is created, no stock is deducted, no receipt prints.** |
| **Cashier double-clicks button** | Frontend sets `submitting = true` on initial click, disabling the submit button. Concurrently, `create_special_invoice_atomic` idempotency detects the previous special sale by the same user and returns the identical response shape idempotently without duplicate records. |
| **Duplicate invoice_no from regular sale or other user** | If `(tenant_id, invoice_no)` exists but `printed_as <> 'special'` or `log.user_id <> p_user_id`, `create_special_invoice_atomic` raises an immediate exception. |
| **Network drop after DB save** | Database has saved both invoice and log. On retry with the reused `invoice_no`, `create_special_invoice_atomic` safely returns the existing record with its original `snapshot` and `template` for seamless printing. |
| **Browser closed mid-flow** | Both invoice and audit log are permanently committed. The invoice is marked `printed_as = 'special'`. Authorized staff can reprint from Sales History using the special reprint engine. |

---

## 7. Decisions for Edit, Cancel, Return & Tokens

### 7.1 Invoice Edit (`update_invoice_atomic` & D1 Enforcement)
- **D1 Decision:** Special invoices cannot have items or prices edited by ANYONE (staff, CEO, developer). A wrong special sale must be cancelled and re-created as a new special sale.
- **Server-Side Enforcement:**
  1. In `update_invoice_atomic`:
     ```sql
     -- Lock old invoice for update
     SELECT * INTO v_old_invoice FROM invoices WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;

     -- D1 Enforcement: Reject edits to special invoices
     IF v_old_invoice.printed_as = 'special' THEN
       RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
     END IF;
     ```
  2. In `PATCH /api/invoices`:
     Before invoking the RPC, verify `invoice.printed_as !== 'special'`. If special, return `400 Bad Request` with `{ success: false, error: 'Special invoices cannot be edited. Cancel and re-issue a new special sale.' }`.
- **UI Enforcement (`SalesHistory.tsx:2620`):**
  - The "Edit / Add in POS" button is hidden/disabled when `selectedInvoice.printed_as === 'special'`, displaying a badge/tooltip: *"Special invoices cannot be edited. Cancel and re-issue a new special sale if incorrect."*
- **Correction Workflow:**
  - Cashier or CEO clicks "Cancel Invoice".
  - `cancel_invoice_atomic` restores inventory stock and client ledger balances safely.
  - Cashier issues a new special sale via POS with corrected items/prices.

### 7.2 Invoice Cancellation (`cancel_invoice_atomic`)
- **Real Cancellation Route Verification:**
  - In `src/app/api/invoices/route.ts`, cancellation is handled by two endpoints:
    1. **`PATCH /api/invoices`** (lines 371–385): triggered when `body.status === 'cancelled'` or `body.action === 'cancel'`.
    2. **`DELETE /api/invoices`** (lines 535–546): triggered with query parameters `?id=...&tenant_id=...&reason=...`.
  - There is NO `/api/invoices/cancel` endpoint in the codebase.
- **Enforcement on Special Return Invoices (D5):**
  - Both `PATCH /api/invoices` (line 372) and `DELETE /api/invoices` (line 535) must check: if `invoice.invoice_type === 'return' AND invoice.printed_as === 'special'`, reject immediately with `400 Bad Request: Special return invoices cannot be cancelled via standard cancellation. Manual review required.`
  - Rationale: Special return invoices cannot be cancelled via standard cancellation. Live `cancel_invoice_atomic` reverses customer balance with the flawed logic `v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref)` (ignoring `card_paid`), which would corrupt customer balances if executed on a card or mixed return.
- **Residual Risk of Direct RPC Invocation:**
  - `cancel_invoice_atomic` is a PostgreSQL function created with `SECURITY DEFINER`. If called directly via PostgREST RPC (`/rest/v1/rpc/cancel_invoice_atomic`) using service role keys or direct SQL console, it executes without going through Next.js API route guards. Direct RPC execution remains an open residual risk unless `cancel_invoice_atomic` itself is patched with an explicit guard checking `IF v_invoice.invoice_type = 'return' AND v_invoice.printed_as = 'special' THEN RAISE EXCEPTION ...`.
- **Sale Invoice Cancellation Behavior:**
  - For special *sales* invoices (`invoice_type = 'sales' AND printed_as = 'special'`), cancellation via `cancel_invoice_atomic` safely reverses stock and customer balances. It does NOT print any receipt, preserves `printed_as = 'special'`, and CEO Special Print Log view marks the row with a red "CANCELLED" pill.

### 7.3 Sales Return of a Special Invoice (Decision 4 & Phase 8)
- **Hard Rules for Special Sales Returns:**
  1. The refund unit price **MUST** come from the original special invoice line (`total_price / qty`), **NEVER** from catalog `items.retail_price`.
  2. **Option E Mandate:** **NO receipt of any kind is printed for special returns.** No customer slip, no internal paper copy is generated. The transaction is completely recorded in the database and audit trail (`print_receipt: false`).
  3. **Original Invoice Guard (R1b):** Original invoice must satisfy `invoice_type = 'sales' AND printed_as = 'special'`. Returning a return invoice is strictly prohibited.
  4. **F9 Original Discount Guard:** If the original invoice has `invoices.discount > 0`, the return is rejected with an exception requiring manual review. Original delivery charge is NOT refunded (`delivery_charge = 0` on return).
  5. **In-Request Duplicate Line Guard (R1a):** In-request duplicate lines referencing the same `original_item_id` are accumulated so combined requested quantity cannot exceed remaining returnable quantity.
  6. **Cents Rule across ALL Returns (R1f):**
     - For each line item across all return invoices linked to `p_original_invoice_id`:
       `v_remaining_qty := v_orig_item.qty - already_returned_qty_for_line;`
     - If this return completes the line's remaining quantity (`v_item_qty = v_remaining_qty`):
       `line_refund := v_orig_item.total_price - already_refunded_amount_for_line;`
     - Else:
       `line_refund := ROUND(v_item_qty * (v_orig_item.total_price / v_orig_item.qty), 2);`
     - **Worked Test:** 3 units at Rs. 1,000 total price returned 1 + 1 + 1 across three separate calls:
       - Call 1: `ROUND(1 * 1000 / 3, 2) = Rs. 333.33` (remaining = 2).
       - Call 2: `ROUND(1 * 1000 / 3, 2) = Rs. 333.33` (remaining = 1).
       - Call 3: completes line: `1000.00 - 666.66 = Rs. 333.34` (remaining = 0).
       - Sum: `333.33 + 333.33 + 333.34 = Rs. 1000.00` exact. Zero rounding loss.
  7. **Tender Validation & Server Khata Offset (R1c, Owner Decision):**
     - **NO Store Credit / No Client Advance:** Special return refunds are strictly cash, card, or cash+card (`mixed`). Parameters and tests for `p_store_credit` or `'credit'` payment type are eliminated.
     - **Credit-Sale Returns & Server-Computed Khata Offset:**
       On credit-sale returns (`client_id IS NOT NULL`), the server (never cashier) computes how much of the return reduces the client's outstanding balance:
       $$\text{khata\_offset} = \max(0, \min(\text{return\_net}, \text{orig\_due\_remaining}, \text{clients.current\_balance}))$$
       where `orig_due_remaining = GREATEST(0, original.due_amount - SUM(prior offsets))`.
     - **Dynamic Prior Offsets Derivation (No New Column):**
       Prior offsets are derived dynamically as `SUM(net_total - paid_amount)` over prior non-cancelled special returns of that original invoice.
     - **Cashier Payout Split:**
       `cash_refund + card_refund` must equal `return_net - khata_offset` (within 0.02 tolerance). Cashier only splits the remainder between cash and card.
     - **Walk-in Customers (`client_id IS NULL`):** `khata_offset = 0`, so `cash_refund + card_refund` must equal `return_net`.
     - **Client Balance Floor:** Client balance is reduced by `khata_offset` only (`current_balance = current_balance - khata_offset`). Since `khata_offset <= clients.current_balance`, balance never goes negative.
     - **Return Invoice Header Fields:**
       `paid_amount = cash_refund + card_refund`, `net_total = return_net`, `due_amount = 0`.
     - **`payment_type` Definition:**
       - If `cash_paid > 0 AND card_paid > 0`: `payment_type = 'mixed'`.
       - Else if `card_paid > 0`: `payment_type = 'card'`.
       - Else: `payment_type = 'cash'`.
  8. **Payment Type Compatibility Analysis across System:**
     - **`cancel_invoice_atomic`:** **INCOMPATIBLE** (Evidence: `live_function_definitions.md:907–917`). Computes `v_store_credit := GREATEST(0, v_invoice.net_total - v_cash_ref)`. Because it ignores `card_paid`, cancelling a return with card refund mistakenly adds `card_paid` to `clients.current_balance`, corrupting customer khata. (Mitigated by blocking special return cancellation in both `PATCH` and `DELETE` routes).
     - **`salesMath.ts`:** **COMPATIBLE** (Evidence: `src/utils/salesMath.ts:141–153`). `physicalCash -= cash_paid` and `digitalPaid -= card_paid`. Khata offset is non-cash, so neither drawer cash nor digital paid is deducted.
     - **`ShiftDrawer.tsx`:** **COMPATIBLE** (Evidence: `src/components/ShiftDrawer.tsx:234–241`). `cashReturns` takes `cp > 0 ? cp : 0`. When `payment_type = 'mixed'`, `!payment_type || payment_type === 'cash'` is false, preventing phantom cash deductions.
     - **`shifts/route.ts`:** **COMPATIBLE** (Evidence: `src/app/api/shifts/route.ts:268–274`). `cashAmount = cp > 0 ? cp : (!pt || pt === 'cash' || pt === 'refund' ? fallback : 0)`. Mixed returns correctly report only `cash_paid`.
  9. **Shift Validation (R1g):** Caller passes explicit `p_shift_id uuid`. RPC validates that shift exists, belongs to tenant, and has `status = 'open'`. No guessing queries.
  10. **Audit Log Insertion (R1d):** Inserts exact row into `public.audit_logs` matching live columns: `tenant_id, user_name, action, action_type, entity_type, entity_id, details`.
  11. **Stock Replenishment (R1e):** Line items locked `FOR UPDATE` before updating `items.stock_qty`, scoped by `AND tenant_id = v_user_rec.tenant_id`, with strict `IF v_orig_item.item_id IS NULL THEN RAISE EXCEPTION`.
  12. **`p_tokens` Parameter & Lid-Open Policy (R1i, Owner Decision):** `p_tokens` removed from `create_special_return_atomic` signature. Return lines skip token issuance. Buckets with opened lids are rejected; returns refund full original unit charged price with zero token deduction.

#### `create_special_return_atomic` Authoritative Function Definition
```sql
CREATE OR REPLACE FUNCTION public.create_special_return_atomic(
  p_original_invoice_id  uuid,
  p_items                jsonb,    -- [{original_item_id, qty}]
  p_user_id              uuid,
  p_printed_by           text,
  p_shift_id             uuid,
  p_cash_refunded        numeric DEFAULT 0,
  p_card_refunded        numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_rec               RECORD;
  v_orig_invoice           RECORD;
  v_orig_item              RECORD;
  v_item                   RECORD;
  v_orig_item_id           UUID;
  v_item_qty               NUMERIC;
  v_line_unit_price        NUMERIC;
  v_line_net               NUMERIC;
  v_prior_returned_qty     NUMERIC := 0;
  v_prior_refunded_amount  NUMERIC := 0;
  v_remaining_qty          NUMERIC := 0;
  v_return_subtotal        NUMERIC := 0;
  v_return_net             NUMERIC := 0;
  v_return_inv_id          UUID    := gen_random_uuid();
  v_new_invoice_no         TEXT;
  v_cashier_refund         NUMERIC := 0;
  v_expected_payout        NUMERIC := 0;
  v_payment_type           TEXT;
  v_shift_id               UUID;
  v_cash_paid              NUMERIC := 0;
  v_card_paid              NUMERIC := 0;
  v_paid_amount            NUMERIC := 0;
  v_snap_items             JSONB   := '[]'::jsonb;
  v_curr_stock             NUMERIC;
  v_prior_offsets          NUMERIC := 0;
  v_orig_due_remaining     NUMERIC := 0;
  v_client_bal             NUMERIC := 0;
  v_khata_offset           NUMERIC := 0;
BEGIN
  -- Verify user: staff with fresh can_use_special_receipt in same branch
  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec FROM app_users WHERE id = p_user_id;
  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Special returns are restricted to authorized counter staff';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;

  -- R1g: Validate Shift exists, is open, and belongs to user tenant
  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special return';
  END IF;
  SELECT id INTO v_shift_id
    FROM shifts
   WHERE id = p_shift_id
     AND tenant_id = v_user_rec.tenant_id
     AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', p_shift_id;
  END IF;

  -- Advisory lock serializes concurrent returns on the same original invoice
  PERFORM pg_advisory_xact_lock(hashtext(v_user_rec.tenant_id::text || ':return:' || p_original_invoice_id::text));

  -- R1b: Lock original invoice FOR UPDATE; enforce invoice_type = 'sales' AND printed_as = 'special'
  SELECT * INTO v_orig_invoice
    FROM invoices
   WHERE id = p_original_invoice_id
     AND tenant_id = v_user_rec.tenant_id
     AND printed_as = 'special'
     AND invoice_type = 'sales'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original invoice % not found, not sales type, or not special', p_original_invoice_id;
  END IF;

  IF v_orig_invoice.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot process return for cancelled special invoice %', v_orig_invoice.invoice_no;
  END IF;

  -- F9: Reject if original invoice has invoice-level discount
  IF COALESCE(v_orig_invoice.discount, 0) > 0 THEN
    RAISE EXCEPTION 'Original invoice % has an invoice-level discount (%) which makes per-line refund calculation ambiguous. Manual review required.',
      v_orig_invoice.invoice_no, v_orig_invoice.discount;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one return line item is required';
  END IF;

  -- Non-negative tender guards
  v_cash_paid := COALESCE(p_cash_refunded, 0);
  v_card_paid := COALESCE(p_card_refunded, 0);

  IF v_cash_paid < 0 OR v_card_paid < 0 THEN
    RAISE EXCEPTION 'Refund amounts cannot be negative (cash: %, card: %)', v_cash_paid, v_card_paid;
  END IF;

  -- ── PRE-PASS & PASS 1: Aggregate duplicate lines by original_item_id, validate lines, apply Cents Rule ──
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    IF v_item.orig_id IS NULL OR v_item.total_req_qty <= 0 THEN
      RAISE EXCEPTION 'Each return item must have a valid original_item_id and positive qty';
    END IF;

    SELECT * INTO v_orig_item
      FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Original line item % not found in invoice %', v_item.orig_id, v_orig_invoice.invoice_no;
    END IF;

    -- Query prior returns for this specific original line
    SELECT COALESCE(SUM(ii.qty), 0), COALESCE(SUM(ii.total_price), 0)
      INTO v_prior_returned_qty, v_prior_refunded_amount
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.original_invoice_id = p_original_invoice_id
       AND i.invoice_type = 'return'
       AND i.status <> 'cancelled'
       AND ii.original_invoice_item_id = v_item.orig_id;

    v_remaining_qty := v_orig_item.qty - v_prior_returned_qty;

    IF v_item.total_req_qty > v_remaining_qty THEN
      RAISE EXCEPTION 'Return qty (%) exceeds remaining returnable qty (%) for item "%"',
        v_item.total_req_qty, v_remaining_qty, v_orig_item.item_name;
    END IF;

    -- R1f Cents Rule: If this return completes the line's remaining qty, refund = line.total_price - already_refunded
    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;

    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);
    v_return_subtotal := v_return_subtotal + v_line_net;
    v_return_net      := v_return_net      + v_line_net;

    v_snap_items := v_snap_items || jsonb_build_array(
      jsonb_build_object(
        'original_item_id',  v_item.orig_id,
        'item_id',           v_orig_item.item_id,
        'item_name',         v_orig_item.item_name,
        'shade_code',        v_orig_item.shade_code,
        'qty',               v_item.total_req_qty,
        'unit_price',        v_line_unit_price,
        'line_total',        v_line_net
      )
    );
  END LOOP;

  -- ── SERVER-COMPUTED KHATA OFFSET & CASHIER PAYOUT VALIDATION ───────────────
  IF v_orig_invoice.client_id IS NOT NULL THEN
    -- Derive prior offsets dynamically as SUM(net_total - paid_amount) over prior non-cancelled special returns of this invoice
    SELECT COALESCE(SUM(net_total - paid_amount), 0) INTO v_prior_offsets
      FROM invoices
     WHERE original_invoice_id = p_original_invoice_id
       AND invoice_type = 'return'
       AND status <> 'cancelled';

    v_orig_due_remaining := GREATEST(0, COALESCE(v_orig_invoice.due_amount, 0) - v_prior_offsets);

    SELECT current_balance INTO v_client_bal
      FROM clients
     WHERE id = v_orig_invoice.client_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found for invoice %', v_orig_invoice.client_id, v_orig_invoice.invoice_no;
    END IF;

    -- Formula: khata_offset = LEAST(return_net, original.due_amount - SUM(prior offsets), clients.current_balance), floored at 0
    v_khata_offset := GREATEST(0, LEAST(v_return_net, v_orig_due_remaining, v_client_bal));
  ELSE
    v_khata_offset := 0;
  END IF;

  v_cashier_refund  := v_cash_paid + v_card_paid;
  v_expected_payout := v_return_net - v_khata_offset;

  IF ABS(ROUND(v_cashier_refund - v_expected_payout, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Cashier refund (cash % + card % = %) must equal return net (%) minus khata offset (%) = % within 0.02 tolerance',
      v_cash_paid, v_card_paid, v_cashier_refund, v_return_net, v_khata_offset, v_expected_payout;
  END IF;

  v_paid_amount := v_cash_paid + v_card_paid;

  -- Payment type determination
  IF v_cash_paid > 0 AND v_card_paid > 0 THEN
    v_payment_type := 'mixed';
  ELSIF v_card_paid > 0 THEN
    v_payment_type := 'card';
  ELSE
    v_payment_type := 'cash';
  END IF;

  -- Generate unique return invoice number
  v_new_invoice_no := 'RET-' || v_orig_invoice.invoice_no || '-'
    || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-'
    || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  -- ── INSERT invoice header ────────────────────────────────────────────────
  INSERT INTO invoices (
    id, tenant_id, invoice_no, invoice_type, status, printed_as,
    original_invoice_id, client_id, client_name,
    date, shift_id, created_by,
    subtotal, discount, delivery_charge, net_total,
    paid_amount, due_amount, cash_paid, card_paid, bank_paid, others_paid,
    payment_type, remarks
  ) VALUES (
    v_return_inv_id,
    v_user_rec.tenant_id,
    v_new_invoice_no,
    'return',
    'completed',
    'special',
    p_original_invoice_id,
    v_orig_invoice.client_id,
    v_orig_invoice.client_name,
    CURRENT_DATE,
    v_shift_id,
    p_printed_by,
    ROUND(v_return_subtotal, 2),
    0,
    0,
    ROUND(v_return_net, 2),
    ROUND(v_paid_amount, 2),
    0,
    v_cash_paid,
    v_card_paid,
    0,
    0,
    v_payment_type,
    'Special Return for Invoice #' || v_orig_invoice.invoice_no
  );

  -- ── PASS 2: INSERT invoice_items & replenish stock with FOR UPDATE lock ──
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    SELECT * INTO v_orig_item FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;

    -- Query prior returns for cents rule calculation
    SELECT COALESCE(SUM(ii.qty), 0), COALESCE(SUM(ii.total_price), 0)
      INTO v_prior_returned_qty, v_prior_refunded_amount
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.original_invoice_id = p_original_invoice_id
       AND i.invoice_type = 'return'
       AND i.status <> 'cancelled'
       AND ii.original_invoice_item_id = v_item.orig_id;

    v_remaining_qty := v_orig_item.qty - v_prior_returned_qty;
    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;
    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);

    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name,
      unit, shade_code, pack_size,
      qty, unit_price, discount, discount_percent, total_price,
      original_invoice_item_id
    ) VALUES (
      v_return_inv_id,
      v_orig_item.item_id,
      v_orig_item.item_code,
      v_orig_item.item_name,
      v_orig_item.unit,
      v_orig_item.shade_code,
      v_orig_item.pack_size,
      v_item.total_req_qty,
      ROUND(v_line_unit_price, 2),
      0,
      0,
      ROUND(v_line_net, 2),
      v_item.orig_id
    );

    -- R1e: Stock replenish with lock, tenant scope, and NULL check
    IF v_orig_item.item_id IS NULL THEN
      RAISE EXCEPTION 'Cannot replenish stock: item_id is NULL for line item "%"', v_orig_item.item_name;
    END IF;

    SELECT stock_qty INTO v_curr_stock FROM items
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found for tenant % during stock replenishment', v_orig_item.item_id, v_user_rec.tenant_id;
    END IF;

    UPDATE items
       SET stock_qty = v_curr_stock + v_item.total_req_qty
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id;
  END LOOP;

  -- Update client current_balance strictly by khata offset portion
  IF v_khata_offset > 0 AND v_orig_invoice.client_id IS NOT NULL THEN
    UPDATE clients
       SET current_balance = current_balance - ROUND(v_khata_offset, 2)
     WHERE id = v_orig_invoice.client_id;
  END IF;

  -- ── Audit log row (event_type = 'return') in special_print_log ───────────
  INSERT INTO special_print_log (
    tenant_id,
    invoice_id,
    invoice_no,
    printed_by,
    user_id,
    event_type,
    printed_at,
    master_total,
    printed_total,
    charged_total,
    delivery_charge,
    receipt_snapshot,
    template_snapshot,
    original_invoice_id
  ) VALUES (
    v_user_rec.tenant_id,
    v_return_inv_id,
    v_new_invoice_no,
    p_printed_by,
    p_user_id,
    'return',
    NOW(),
    0,
    0,
    ROUND(v_return_net, 2),
    0,
    jsonb_build_object(
      'items',               v_snap_items,
      'original_invoice_id', p_original_invoice_id,
      'original_invoice_no', v_orig_invoice.invoice_no,
      'refund_total',        ROUND(v_return_net, 2),
      'khata_offset',        ROUND(v_khata_offset, 2),
      'cash_paid',           ROUND(v_cash_paid, 2),
      'card_paid',           ROUND(v_card_paid, 2),
      'payment_type',        v_payment_type
    ),
    '{}'::jsonb,
    p_original_invoice_id
  );

  -- R1d: Insert exact audit_logs row matching live create_invoice_atomic columns
  INSERT INTO audit_logs (
    tenant_id, user_name, action, action_type, entity_type, entity_id, details
  ) VALUES (
    v_user_rec.tenant_id,
    COALESCE(v_orig_invoice.client_name, 'Walk-in Customer'),
    'Credit Note Return',
    'return',
    'invoice',
    v_return_inv_id,
    jsonb_build_object(
      'invoice_no', v_new_invoice_no,
      'original_invoice_no', v_orig_invoice.invoice_no,
      'net_total', ROUND(v_return_net, 2),
      'paid_amount', ROUND(v_paid_amount, 2),
      'due_amount', 0,
      'khata_offset', ROUND(v_khata_offset, 2),
      'cash_paid', ROUND(v_cash_paid, 2),
      'card_paid', ROUND(v_card_paid, 2),
      'payment_type', v_payment_type,
      'items_count', jsonb_array_length(p_items)
    )
  );

  -- Option E: ZERO printed receipt
  RETURN jsonb_build_object(
    'success',           true,
    'return_invoice_id', v_return_inv_id,
    'return_invoice_no', v_new_invoice_no,
    'refund_total',      ROUND(v_return_net, 2),
    'khata_offset',      ROUND(v_khata_offset, 2),
    'cashier_refund',    ROUND(v_cashier_refund, 2),
    'print_receipt',     false
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_special_return_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_special_return_atomic TO service_role;
```

### 7.4 CEO Log View Aggregates & Display (C4)
- **Current Status Display:** In `SpecialPrintLogView.tsx`, the current `invoices.status` is joined and displayed for each row (`completed`, `cancelled`). Cancelled sales are styled with a distinct red pill.
- **R4 Delivery Charge Column & Variance Formula:**
  - `special_print_log` includes dedicated column `delivery_charge NUMERIC NOT NULL DEFAULT 0`.
  - In `SpecialPrintLogView.tsx`:
    - Table columns: `Date/Time, Branch, Cashier, Invoice #, Status, Event, Master Total, Printed Total, Charged Total, Delivery Charge, Price Variance`.
    - **Header Metric Cards (STRICTLY `event_type = 'sale'` ONLY):**
      - Total Master Value: `SUM(master_total) FILTER (WHERE event_type = 'sale')`
      - Total Charged Value: `SUM(charged_total) FILTER (WHERE event_type = 'sale')`
      - Total Delivery Value: `SUM(delivery_charge) FILTER (WHERE event_type = 'sale')`
      - **Authoritative Price Variance Formula:**
        $$\text{Price Variance} = \sum (\text{charged\_total} - \text{delivery\_charge}) - \sum \text{master\_total}$$
        *(Excludes logistics delivery charge from product price variance so pure merchandising variance is displayed).*
  - Reprint rows are displayed in the audit table with an explicit blue "REPRINT" badge.
  - Return rows are displayed with an explicit orange "RETURN" badge and link to the original special invoice.

### 7.5 Token Handling Across All Receipts (Owner Decision 1)
- **Render-Layer Suppression Across ALL Receipts:**
  - Token claim slip and token note text are hidden on **ALL receipt types** (regular, special, reprint).
  - This is a render-layer change only in `src/utils/receiptRenderCore.ts` (`tokenClaimSlipSection` and `tokenNoteHtml` disabled / returning empty string) and `src/utils/receiptAdapters.ts`.
- **Business Logic Fully Preserved for Sales:**
  - Token business logic works **identically** for regular and special sales, for registered and walk-in customers, including "keep" and "remove" token actions.
  - `create_special_invoice_atomic` passes `p_tokens` through directly to `create_invoice_atomic`.
  - Token ledger records (`token_transactions`) are created and updated exactly as in normal sales.
  - Walk-in customers who keep a token: claim codes (e.g., `CLM-...`) are generated and stored in the database as normal, but nothing is printed on any physical paper slip. This behavior is explicitly accepted.
- **Special Returns Skip Tokens & Lid-Open Policy (R1i, Owner Decision):**
  - Special returns do NOT issue tokens or create stockpile entries. `create_special_return_atomic` does NOT accept or process `p_tokens`.
  - **Lid-Open Return Policy:** Buckets with opened lids are strictly rejected and not accepted for return. Accepted returns always refund the full original unit charged price with zero token deduction.
---

## 8. Print Layer & Browser Identity Suppression

### 8.1 Print Document Structure
To completely eliminate browser header/footer leaks (URL, store slug, date, page title):
1. **Neutral Document Title:**
   - The HTML document sets `<title>Receipt</title>` (neutral, non-empty).
   - If the user uses "Save as PDF", the suggested filename defaults to `Receipt.pdf` rather than an unbranded blank or the shop slug.
2. **Zero Margins in CSS:**
   ```css
   @media print {
     @page {
       margin: 0 !important;
       size: auto;
     }
     body {
       margin: 0 !important;
       padding: 3mm !important;
     }
   }
   ```
3. **Browser Compatibility Disclosure:**
   - `@page { margin: 0 }` header/footer suppression is verified for Chromium-based browsers (Google Chrome, Microsoft Edge, Brave).
   - Safari and Firefox handle page margins differently depending on OS driver settings. Validation must be conducted on target physical thermal hardware.
4. **No URL-Bearing Elements:** No `<base href>`, canonical links, or visible hyperlink hrefs.

---

## 9. Sales History Special Reprint Engine (D2)

- When any user clicks "Reprint" on an invoice in `SalesHistory.tsx`:
  - If `inv.printed_as === 'special'`:
    - **D2 Mandate:** Check if current user is **staff with fresh `can_use_special_receipt` in that branch**.
    - **CEO is strictly blocked from reprinting**; CEO only views the stored snapshot preview inside the CEO Audit Log View.
    - If user is not authorized staff, the "Reprint" button is hidden/disabled with tooltip: *"Reprint restricted to authorized counter staff"*.
    - If authorized staff clicks reprint:
      1. Calls `POST /api/special-print-log/reprint` with `invoice_id`.
      2. Server RPC `log_special_reprint_atomic` validates staff branch and fresh permission, inserts immutable audit record (`event_type = 'reprint'`), and returns the original `receipt_snapshot` and `template_snapshot`.
      3. Frontend receives the returned snapshot and prints via iframe.
    - **Guaranteed:** Never passes a special invoice to `buildSalesHistoryThermalHtml` or regular `assignedTemplate`.

---

## 10. Phased Rollout Plan

To ensure zero risk to daily POS operations, the feature is rolled out in strictly sequential phases (Phase 0 through Phase 8):

1. **Phase 0: Staging & Backup**
   - Apply migration draft `20261021_01_special_receipt_system.sql` on a dedicated Supabase branch/staging project (`azzonbwaevtywisxlxej`).
   - Run complete staging test suite (`staging_sql_tests.sql`) verifying all constraints, triggers, and RPC signatures.
   - Execute a complete database backup of the production database prior to production apply.
2. **Phase 1: Database Schema & Immutability Triggers**
   - Apply columns `app_users.can_use_special_receipt`, `invoices.printed_as`, `invoices.original_invoice_id`, and `invoice_items.original_invoice_item_id`.
   - Create tables `special_receipt_templates`, `special_receipt_brands`, `special_print_log`.
   - Apply triggers `trg_immutable_special_print_log` and `trg_immutable_special_print_log_truncate`.
   - Apply partial unique index `idx_special_print_log_sale`.
   - Apply privilege revocations (`REVOKE ALL FROM anon, authenticated`).
3. **Phase 2: Atomic RPC Functions**
   - Create `create_special_invoice_atomic` (with Decision 1 token pass-through, server template fallback, POS subtotal/discount rule, and 0.02 rounding tolerance) and `log_special_reprint_atomic`.
   - Update `update_invoice_atomic` to reject edits on `printed_as = 'special'`.
   - Revoke public execution, grant to `service_role`.
4. **Phase 3: Backend API Endpoints**
   - Deploy `/api/invoices/special`, `/api/special-receipt-templates`, `/api/special-receipt-brands`, `/api/special-print-log`, `/api/special-print-log/snapshot`, `/api/special-print-log/reprint`.
   - Add rejection safeguard in `PATCH /api/invoices` for `printed_as = 'special'`.
5. **Phase 4: Token Suppression & Receipt Core Refactoring**
   - Deploy `src/utils/receiptRenderCore.ts` Decision 1 patch (disable `tokenClaimSlipSection` and `tokenNoteHtml` globally — affects all receipt types).
   - Update `src/utils/receiptAdapters.ts` to ensure consistent suppression across thermal and A4 renderers.
6. **Phase 5: Special Receipt Designer & Brand Selection**
   - Deploy Developer Panel permission toggle.
   - Deploy POS Special Receipt Designer & Brand Selection view.
7. **Phase 6: POS Counter UI & Sales History Reprints**
   - Deploy POS Billing Summary button & Option A Line-Discount Special Modal with dynamic blinking and `F6` shortcut.
   - Deploy Sales History Special Reprint Engine (staff only) and edit-lock on special invoices.
8. **Phase 7: CEO Special Print Log & Multi-Branch Auditing**
   - Deploy CEO Special Print Log View & Preview Modal (with reprint and return sum exclusions and cancelled status tags).
   - Staging acceptance gate for Phases 0–7 before Phase 8.
9. **Phase 8: Special Return Engine (Dedicated Flow & Option E Zero-Print)**
   - Deploy `create_special_return_atomic` RPC (with open shift check, advisory lock, `original_invoice_item_id` tracking, and tender rule).
   - Deploy `/api/invoices/special-return` backend endpoint.
   - Deploy POS Sales History "Special Return" UI: read-only pre-fill from original invoice, quantity guard, refund tender picker, Option E paperless completion.
   - CEO log view: display `'return'` event_type rows with `original_invoice_id` reference and link to original invoice.
   - Full staging acceptance test before production deploy.

> [!NOTE]
> **TASK-SR-01b (Multi-branch CEO scope expansion)** is a separate proposal and is NOT part of this release.

---

## 11. Backward Compatibility and Rollback Plan

### 11.1 Backward Compatibility Guarantees
1. **Regular POS Operations Untouched:**
   - Standard sales ([`POST /api/invoices`](file:///d:/bestow/p-industry/src/app/api/invoices/route.ts)), standard returns, shift drawer balances, Day Close, inventory tracking, and sales reports remain 100% functionally identical.
   - The ONLY global modification across regular sales is the owner-approved render-layer suppression of token claim slips and token notes in `src/utils/receiptRenderCore.ts` (Decision 1).
2. **Database Function Stability:**
   - `create_invoice_atomic` and `cancel_invoice_atomic` definitions and parameter signatures are **completely unmodified**.
   - `update_invoice_atomic` receives a non-invasive 4-line guard at the start: if `v_old_invoice.printed_as = 'special'`, raise exception. Regular invoices proceed through the unmodified existing logic.
3. **Schema Non-Breaking Additions:**
   - All added columns (`invoices.printed_as`, `invoices.original_invoice_id`, `invoice_items.original_invoice_item_id`, `app_users.can_use_special_receipt`) are nullable with safe defaults (`'regular'`, `NULL`, `false`), ensuring zero regression on existing queries or ORM mappers.

### 11.2 Rollback Procedures

If issues arise at any stage of deployment, the feature can be cleanly rolled back without data corruption:

#### Scenario A: Frontend / API Layer Rollback (Instant Revert)
1. **Action:** Revert frontend/API deployment commit in Vercel/production hosting.
2. **Result:**
   - Special Receipt button in POS, Special Designer tab, and Sales History reprint button disappear immediately.
   - `/api/invoices/special` returns 404/503.
   - Regular POS sales continue operating normally.
   - Existing special invoices in DB retain `printed_as = 'special'` and can still be viewed or cancelled in Sales History.

#### Scenario B: Complete Database Rollback (Zero Residuals)
If database changes must be unwound:
1. **Revert `update_invoice_atomic`:**
   Execute the pre-migration function definition (captured in `docs/special-receipt/live_function_definitions.md §1.2`) to remove the `printed_as = 'special'` guard.
2. **Drop Special Functions:**
   ```sql
   -- Drop create_special_return_atomic (signature: p_original_invoice_id, p_items, p_user_id, p_printed_by, p_shift_id, p_cash_refunded, p_card_refunded)
   DROP FUNCTION IF EXISTS public.create_special_return_atomic(uuid, jsonb, uuid, text, uuid, numeric, numeric);
   DROP FUNCTION IF EXISTS public.log_special_reprint_atomic(uuid, uuid, text);
   -- Drop create_special_invoice_atomic (signature: p_invoice_data, p_items, p_receipt_snap, p_printed_by, p_user_id, p_tokens)
   DROP FUNCTION IF EXISTS public.create_special_invoice_atomic(jsonb, jsonb, jsonb, text, uuid, jsonb);
   ```
3. **Drop Special Tables:**
   ```sql
   DROP TABLE IF EXISTS public.special_print_log CASCADE;
   DROP TABLE IF EXISTS public.special_receipt_brands CASCADE;
   DROP TABLE IF EXISTS public.special_receipt_templates CASCADE;
   ```
4. **Drop Added Columns (Optional):**
   ```sql
   ALTER TABLE public.invoice_items DROP COLUMN IF EXISTS original_invoice_item_id;
   ALTER TABLE public.invoices DROP COLUMN IF EXISTS original_invoice_id;
   ALTER TABLE public.invoices DROP COLUMN IF EXISTS printed_as;
   ALTER TABLE public.app_users DROP COLUMN IF EXISTS can_use_special_receipt;
   ```

---

## 12. Open Questions for Owner Confirmation

The following operational details are surfaced for owner confirmation prior to implementation:

1. **Visibility of Payment / Balance Lines on Special Receipt Paper:**
   - *Current Plan (Option A default):* Payment breakdown lines (`Cash Paid`, `Change Due`, `Balance Due`) are **100% hidden** on the printed special receipt so the paper shows only the items, quantities, pre-discount unit rates, and the server-derived printed total (`sum(qty * pre-discount rate)`). This ensures no discrepancy between charged cash and printed total is visible.
   - *Confirmation Needed:* Should payment / balance lines remain hidden under all circumstances, even when paid in full or when there is an outstanding balance?
2. **Credit Sale Representation on Special Receipts:**
   - If a registered customer makes a special purchase with a balance due (`due_amount > 0`), the invoice records real customer debt in `clients.current_balance`.
   - *Current Plan:* The printed receipt shows the printed total without printing balance due or credit terms.
   - *Confirmation Needed:* Confirm this is acceptable, or if a generic "Credit Sale" indicator is desired on the paper.
3. **Delivery Charges in Special Modal:**
   - Under Option A, invoice-level discount is disallowed (line discounts only).
   - *Current Plan:* Delivery charges entered in POS cart are passed through as an un-discounted delivery fee line, added to both `printed_total` and `charged_total`.
   - *Confirmation Needed:* Confirm delivery charges should be allowed and printed at full value on special receipts.
4. **Master Total Provenance When Cart Rate Differs From Catalog Retail Price:**
   - Under Decision 8, `master_total` is computed from `items.retail_price * qty` (authoritative DB catalog).
   - In rare cases, the cashier's cart rate prior to discount may differ from catalog retail price (e.g. client last-purchase rate autofill or tiered pricing).
   - In this scenario:
     - The printed receipt shows the pre-discount cart rate.
     - `special_print_log.printed_total` records `sum(qty * cart_rate)`.
     - `special_print_log.master_total` records `sum(qty * catalog retail_price)`.
     - The CEO audit view will reflect a variance between `printed_total` and `master_total`.
   - *Confirmation Needed:* Confirm this comparison accurately meets the CEO's audit requirements.
5. **Token-Missing Deduction on Special Returns (F3) — CLOSED:**
   - **Owner Decision (Final):** Buckets with opened lids are strictly rejected and not accepted for return. Accepted returns always refund the full original unit charged price. There is zero token deduction on special returns.
   - *Status:* CLOSED by owner decision. `TASK-FIX-04` is retained as optional future documentation.
6. **Server-Side Cart Rate Enforcement (R5a):**
   - `create_special_invoice_atomic` accepts the cart's pre-discount `unit_price` without asserting that `unit_price == items.retail_price` (because counter operators sometimes use custom cart prices).
   - The server enforces line totals (`total_price = qty * unit_price - discount`), while `master_total` strictly computes catalog value (`sum(qty * items.retail_price)`), preserving full CEO audit visibility.
   - *Confirmation Needed:* Confirm that counter staff are permitted to sell at cart rates differing from catalog retail prices, with variance logged in the CEO audit trail.
