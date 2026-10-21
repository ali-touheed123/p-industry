-- ============================================================================
-- File: docs/special-receipt/staging_migration.sql
-- Description: Special Receipt Engine & Immutable CEO Audit Trail
--              Apply ONLY to staging project azzonbwaevtywisxlxej.
--              NOT for production.
-- Source: implementation_plan.md §2.2, §2.3, §7.3, §7.1
-- Generated: 2026-10-21
-- ============================================================================

-- ============================================================================
-- SECTION 1: SCHEMA ADDITIONS
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
  invoice_id        UUID,
  invoice_no        TEXT NOT NULL,
  printed_by        TEXT NOT NULL,
  user_id           UUID,
  event_type        TEXT NOT NULL DEFAULT 'sale'
                      CHECK (event_type IN ('sale', 'reprint', 'return')),
  printed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  master_total      NUMERIC NOT NULL DEFAULT 0,
  printed_total     NUMERIC NOT NULL DEFAULT 0,
  charged_total     NUMERIC NOT NULL DEFAULT 0,
  delivery_charge   NUMERIC NOT NULL DEFAULT 0,
  original_invoice_id UUID,
  receipt_snapshot  JSONB NOT NULL,
  template_snapshot JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_special_print_log_tenant_date
  ON public.special_print_log(tenant_id, printed_at DESC);

CREATE INDEX IF NOT EXISTS idx_special_print_log_invoice_id
  ON public.special_print_log(invoice_id);

CREATE INDEX IF NOT EXISTS idx_special_print_log_original_invoice
  ON public.special_print_log(original_invoice_id) WHERE original_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_special_print_log_sale
  ON public.special_print_log(invoice_id) WHERE event_type = 'sale';

-- ============================================================================
-- SECTION 2: IMMUTABILITY TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_special_print_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
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

-- ============================================================================
-- SECTION 3: REVOKE PRIVILEGES & RLS
-- ============================================================================

REVOKE ALL ON public.special_receipt_templates, public.special_receipt_brands, public.special_print_log FROM anon, authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.special_print_log FROM service_role;

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

-- ============================================================================
-- SECTION 4: create_special_invoice_atomic RPC
-- ============================================================================

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

  v_shift_id := (p_invoice_data->>'shift_id')::UUID;
  IF v_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special invoice';
  END IF;
  PERFORM 1 FROM shifts WHERE id = v_shift_id AND tenant_id = v_tenant_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', v_shift_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_tenant_id::text || ':' || v_invoice_no));

  IF v_invoice_type <> 'sales' THEN
    RAISE EXCEPTION 'create_special_invoice_atomic only accepts sales invoices. Return invoices must use create_special_return_atomic.';
  END IF;

  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec FROM app_users WHERE id = p_user_id;

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

  SELECT * INTO v_existing_inv
    FROM invoices WHERE tenant_id = v_tenant_id AND invoice_no = v_invoice_no;

  IF FOUND THEN
    IF v_existing_inv.printed_as <> 'special' THEN
      RAISE EXCEPTION 'Invoice number % already exists as a non-special invoice', v_invoice_no;
    END IF;
    SELECT * INTO v_existing_log
      FROM special_print_log
     WHERE invoice_id = v_existing_inv.id AND event_type = 'sale' LIMIT 1;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice number % exists as special but missing sales audit log', v_invoice_no;
    END IF;
    IF v_existing_log.user_id <> p_user_id THEN
      RAISE EXCEPTION 'Invoice number % was created by another user (%)', v_invoice_no, v_existing_log.printed_by;
    END IF;
    RETURN jsonb_build_object(
      'success', true, 'is_duplicate', true,
      'invoice_id', v_existing_inv.id, 'invoice_no', v_invoice_no,
      'master_total', v_existing_log.master_total,
      'printed_total', v_existing_log.printed_total,
      'charged_total', v_existing_log.charged_total,
      'invoice', row_to_json(v_existing_inv)::jsonb,
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

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

    v_master_total  := v_master_total  + (v_master_price * v_item_qty);
    v_printed_total := v_printed_total + (v_item_price * v_item_qty);
    v_subtotal_calc := v_subtotal_calc + v_item_total_price;

    v_clean_items := v_clean_items || jsonb_build_array(
      (v_item - 'receipt_name' - 'receipt_shade' - 'receipt_pack_size' - 'receipt_notes')
      || jsonb_build_object(
        'item_id', v_item_id, 'item_name', v_catalog_name,
        'unit_price', v_item_price, 'discount', v_item_discount,
        'total_price', v_item_total_price
      )
    );

    v_enriched_items := v_enriched_items || jsonb_build_array(
      jsonb_build_object(
        'item_id', v_item_id, 'item_code', v_item_code,
        'item_name', v_catalog_name,
        'receipt_name', LEFT(COALESCE(v_item->>'receipt_name', v_catalog_name), 200),
        'receipt_shade', LEFT(COALESCE(v_item->>'receipt_shade', ''), 100),
        'receipt_pack_size', LEFT(COALESCE(v_item->>'receipt_pack_size', ''), 100),
        'receipt_notes', LEFT(COALESCE(v_item->>'receipt_notes', ''), 200),
        'qty', v_item_qty, 'unit_price', v_item_price,
        'pre_discount_rate', v_item_price, 'discount', v_item_discount,
        'total_price', v_item_total_price, 'catalog_name', v_catalog_name,
        'list_price', v_master_price,
        'charged_rate', (v_item_total_price / v_item_qty),
        'line_discount', v_item_discount,
        'line_variance', (v_item_total_price - (v_master_price * v_item_qty))
      )
    );
  END LOOP;

  v_printed_total := v_printed_total + v_delivery_calc;
  v_charged_total := v_subtotal_calc + v_delivery_calc - v_discount_calc;

  v_paid_amount := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount  := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_cash_paid   := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid   := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid   := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);

  IF ABS(ROUND((v_cash_paid + v_card_paid + v_bank_paid + v_others_paid) - v_paid_amount, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Tender breakdown does not equal paid_amount within 0.02 tolerance';
  END IF;
  IF ABS(ROUND((v_paid_amount + v_due_amount) - v_charged_total, 2)) > 0.02 THEN
    RAISE EXCEPTION 'Paid amount (%) + due amount (%) does not equal charged total (%) within 0.02 tolerance',
      v_paid_amount, v_due_amount, v_charged_total;
  END IF;
  IF v_due_amount > 0 AND v_client_id IS NULL THEN
    RAISE EXCEPTION 'Credit sales with balance due require a registered customer account';
  END IF;

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

  UPDATE invoices SET printed_as = 'special' WHERE id = v_invoice_id;

  SELECT template_json INTO v_stored_template
    FROM special_receipt_templates WHERE tenant_id = v_tenant_id;

  IF NOT FOUND OR v_stored_template IS NULL THEN
    v_stored_template := '{"paper_size":"thermal_80","header":{"showShopName":false,"customShopName":"","showAddress":false,"customAddress":"","showPhone":false,"customPhone":"","showLogo":false,"logoUrl":""},"invoiceInfo":{"showCashier":false},"footer":{"showPoweredBy":false,"poweredByText":""},"tokenClaimSlip":{"enabled":false}}'::jsonb;
  END IF;

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

  BEGIN
    INSERT INTO special_print_log (
      tenant_id, invoice_id, invoice_no, printed_by, user_id,
      event_type, printed_at, master_total, printed_total, charged_total,
      delivery_charge, receipt_snapshot, template_snapshot
    ) VALUES (
      v_tenant_id, v_invoice_id, v_invoice_no, p_printed_by, p_user_id,
      'sale', NOW(), v_master_total, v_printed_total, v_charged_total,
      v_delivery_calc, v_enriched_snap, v_stored_template
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_existing_log
      FROM special_print_log WHERE invoice_id = v_invoice_id AND event_type = 'sale' LIMIT 1;
    RETURN jsonb_build_object(
      'success', true, 'is_duplicate', true,
      'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no,
      'master_total', v_existing_log.master_total,
      'printed_total', v_existing_log.printed_total,
      'charged_total', v_existing_log.charged_total,
      'delivery_charge', v_existing_log.delivery_charge,
      'invoice', v_inv_res->'invoice',
      'snapshot', v_existing_log.receipt_snapshot,
      'template', v_existing_log.template_snapshot
    );
  END;

  RETURN jsonb_build_object(
    'success', true, 'is_duplicate', false,
    'invoice_id', v_invoice_id, 'invoice_no', v_invoice_no,
    'master_total', v_master_total, 'printed_total', v_printed_total,
    'charged_total', v_charged_total, 'delivery_charge', v_delivery_calc,
    'invoice', v_inv_res->'invoice',
    'snapshot', v_enriched_snap, 'template', v_stored_template
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_special_invoice_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_special_invoice_atomic TO service_role;

-- ============================================================================
-- SECTION 5: log_special_reprint_atomic RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_special_reprint_atomic(
  p_invoice_id  uuid,
  p_user_id     uuid,
  p_printed_by  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_orig_log       RECORD;
  v_user_rec       RECORD;
  v_inv_tenant     UUID;
  v_inv_status     TEXT;
  v_inv_printed_as TEXT;
BEGIN
  SELECT id, is_active, can_use_special_receipt, role, tenant_id
    INTO v_user_rec FROM app_users WHERE id = p_user_id;

  IF NOT FOUND OR NOT v_user_rec.is_active THEN
    RAISE EXCEPTION 'User not found or inactive';
  END IF;
  IF v_user_rec.role <> 'staff' THEN
    RAISE EXCEPTION 'Reprint restricted to authorized counter staff. CEO reprint is not permitted.';
  END IF;
  IF NOT v_user_rec.can_use_special_receipt THEN
    RAISE EXCEPTION 'Special receipt permission denied or revoked';
  END IF;

  SELECT tenant_id, status, printed_as
    INTO v_inv_tenant, v_inv_status, v_inv_printed_as
    FROM invoices WHERE id = p_invoice_id;

  IF NOT FOUND OR v_inv_tenant <> v_user_rec.tenant_id THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;
  IF v_inv_printed_as <> 'special' THEN
    RAISE EXCEPTION 'Invoice % is not a special receipt invoice', p_invoice_id;
  END IF;
  IF v_inv_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot reprint cancelled invoice %', p_invoice_id;
  END IF;

  SELECT * INTO v_orig_log
    FROM special_print_log
   WHERE invoice_id = p_invoice_id AND event_type = 'sale' LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Original special print record not found for invoice %', p_invoice_id;
  END IF;

  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, printed_at, master_total, printed_total, charged_total,
    receipt_snapshot, template_snapshot
  ) VALUES (
    v_orig_log.tenant_id, v_orig_log.invoice_id, v_orig_log.invoice_no,
    p_printed_by, p_user_id, 'reprint', NOW(),
    v_orig_log.master_total, v_orig_log.printed_total, v_orig_log.charged_total,
    v_orig_log.receipt_snapshot, v_orig_log.template_snapshot
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

-- ============================================================================
-- SECTION 6: create_special_return_atomic RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_special_return_atomic(
  p_original_invoice_id  uuid,
  p_items                jsonb,
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

  IF p_shift_id IS NULL THEN
    RAISE EXCEPTION 'Shift ID is required for special return';
  END IF;
  SELECT id INTO v_shift_id FROM shifts
   WHERE id = p_shift_id AND tenant_id = v_user_rec.tenant_id AND status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shift % does not exist, is closed, or belongs to another tenant', p_shift_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_user_rec.tenant_id::text || ':return:' || p_original_invoice_id::text));

  SELECT * INTO v_orig_invoice FROM invoices
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

  IF COALESCE(v_orig_invoice.discount, 0) > 0 THEN
    RAISE EXCEPTION 'Original invoice % has an invoice-level discount (%) which makes per-line refund calculation ambiguous. Manual review required.',
      v_orig_invoice.invoice_no, v_orig_invoice.discount;
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one return line item is required';
  END IF;

  v_cash_paid := COALESCE(p_cash_refunded, 0);
  v_card_paid := COALESCE(p_card_refunded, 0);
  IF v_cash_paid < 0 OR v_card_paid < 0 THEN
    RAISE EXCEPTION 'Refund amounts cannot be negative (cash: %, card: %)', v_cash_paid, v_card_paid;
  END IF;

  -- PASS 1: Aggregate, validate, cents rule
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    IF v_item.orig_id IS NULL OR v_item.total_req_qty <= 0 THEN
      RAISE EXCEPTION 'Each return item must have a valid original_item_id and positive qty';
    END IF;
    SELECT * INTO v_orig_item FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Original line item % not found in invoice %', v_item.orig_id, v_orig_invoice.invoice_no;
    END IF;

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

    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;

    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);
    v_return_subtotal := v_return_subtotal + v_line_net;
    v_return_net      := v_return_net      + v_line_net;

    v_snap_items := v_snap_items || jsonb_build_array(jsonb_build_object(
      'original_item_id', v_item.orig_id,
      'item_id',          v_orig_item.item_id,
      'item_name',        v_orig_item.item_name,
      'shade_code',       v_orig_item.shade_code,
      'qty',              v_item.total_req_qty,
      'unit_price',       v_line_unit_price,
      'line_total',       v_line_net
    ));
  END LOOP;

  -- Khata offset
  IF v_orig_invoice.client_id IS NOT NULL THEN
    SELECT COALESCE(SUM(net_total - paid_amount), 0) INTO v_prior_offsets
      FROM invoices
     WHERE original_invoice_id = p_original_invoice_id
       AND invoice_type = 'return' AND status <> 'cancelled';
    v_orig_due_remaining := GREATEST(0, COALESCE(v_orig_invoice.due_amount, 0) - v_prior_offsets);
    SELECT current_balance INTO v_client_bal FROM clients
     WHERE id = v_orig_invoice.client_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Client % not found for invoice %', v_orig_invoice.client_id, v_orig_invoice.invoice_no;
    END IF;
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
  IF v_cash_paid > 0 AND v_card_paid > 0 THEN
    v_payment_type := 'mixed';
  ELSIF v_card_paid > 0 THEN
    v_payment_type := 'card';
  ELSE
    v_payment_type := 'cash';
  END IF;

  v_new_invoice_no := 'RET-' || v_orig_invoice.invoice_no || '-'
    || TO_CHAR(NOW(), 'YYMMDDHH24MISS') || '-'
    || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');

  INSERT INTO invoices (
    id, tenant_id, invoice_no, invoice_type, status, printed_as,
    original_invoice_id, client_id, client_name,
    date, shift_id, created_by,
    subtotal, discount, delivery_charge, net_total,
    paid_amount, due_amount, cash_paid, card_paid, bank_paid, others_paid,
    payment_type, remarks
  ) VALUES (
    v_return_inv_id, v_user_rec.tenant_id, v_new_invoice_no,
    'return', 'completed', 'special',
    p_original_invoice_id, v_orig_invoice.client_id, v_orig_invoice.client_name,
    CURRENT_DATE, v_shift_id, p_printed_by,
    ROUND(v_return_subtotal, 2), 0, 0, ROUND(v_return_net, 2),
    ROUND(v_paid_amount, 2), 0,
    v_cash_paid, v_card_paid, 0, 0,
    v_payment_type,
    'Special Return for Invoice #' || v_orig_invoice.invoice_no
  );

  -- PASS 2: insert items & replenish stock
  FOR v_item IN
    SELECT (elem->>'original_item_id')::UUID AS orig_id,
           SUM((elem->>'qty')::NUMERIC) AS total_req_qty
      FROM jsonb_array_elements(p_items) elem
     GROUP BY (elem->>'original_item_id')::UUID
  LOOP
    SELECT * INTO v_orig_item FROM invoice_items
     WHERE id = v_item.orig_id AND invoice_id = p_original_invoice_id;

    SELECT COALESCE(SUM(ii.qty), 0), COALESCE(SUM(ii.total_price), 0)
      INTO v_prior_returned_qty, v_prior_refunded_amount
      FROM invoices i
      JOIN invoice_items ii ON ii.invoice_id = i.id
     WHERE i.original_invoice_id = p_original_invoice_id
       AND i.invoice_type = 'return' AND i.status <> 'cancelled'
       AND ii.original_invoice_item_id = v_item.orig_id;

    v_remaining_qty := v_orig_item.qty - v_prior_returned_qty;
    IF v_item.total_req_qty = v_remaining_qty THEN
      v_line_net := v_orig_item.total_price - v_prior_refunded_amount;
    ELSE
      v_line_net := ROUND(v_item.total_req_qty * (v_orig_item.total_price / v_orig_item.qty), 2);
    END IF;
    v_line_unit_price := ROUND(v_line_net / v_item.total_req_qty, 2);

    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, unit, shade_code, pack_size,
      qty, unit_price, discount, discount_percent, total_price, original_invoice_item_id
    ) VALUES (
      v_return_inv_id, v_orig_item.item_id, v_orig_item.item_code, v_orig_item.item_name,
      v_orig_item.unit, v_orig_item.shade_code, v_orig_item.pack_size,
      v_item.total_req_qty, ROUND(v_line_unit_price, 2), 0, 0, ROUND(v_line_net, 2),
      v_item.orig_id
    );

    IF v_orig_item.item_id IS NULL THEN
      RAISE EXCEPTION 'Cannot replenish stock: item_id is NULL for line item "%"', v_orig_item.item_name;
    END IF;
    SELECT stock_qty INTO v_curr_stock FROM items
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Item % not found for tenant % during stock replenishment', v_orig_item.item_id, v_user_rec.tenant_id;
    END IF;
    UPDATE items SET stock_qty = v_curr_stock + v_item.total_req_qty
     WHERE id = v_orig_item.item_id AND tenant_id = v_user_rec.tenant_id;
  END LOOP;

  IF v_khata_offset > 0 AND v_orig_invoice.client_id IS NOT NULL THEN
    UPDATE clients SET current_balance = current_balance - ROUND(v_khata_offset, 2)
     WHERE id = v_orig_invoice.client_id;
  END IF;

  INSERT INTO special_print_log (
    tenant_id, invoice_id, invoice_no, printed_by, user_id,
    event_type, printed_at, master_total, printed_total, charged_total,
    delivery_charge, receipt_snapshot, template_snapshot, original_invoice_id
  ) VALUES (
    v_user_rec.tenant_id, v_return_inv_id, v_new_invoice_no, p_printed_by, p_user_id,
    'return', NOW(), 0, 0, ROUND(v_return_net, 2), 0,
    jsonb_build_object(
      'items', v_snap_items,
      'original_invoice_id', p_original_invoice_id,
      'original_invoice_no', v_orig_invoice.invoice_no,
      'refund_total', ROUND(v_return_net, 2),
      'khata_offset', ROUND(v_khata_offset, 2),
      'cash_paid', ROUND(v_cash_paid, 2),
      'card_paid', ROUND(v_card_paid, 2),
      'payment_type', v_payment_type
    ),
    '{}'::jsonb,
    p_original_invoice_id
  );

  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (
    v_user_rec.tenant_id,
    COALESCE(v_orig_invoice.client_name, 'Walk-in Customer'),
    'Credit Note Return', 'return', 'invoice', v_return_inv_id,
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

  RETURN jsonb_build_object(
    'success', true,
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

-- ============================================================================
-- SECTION 7: update_invoice_atomic WITH D1 GUARD
-- Production baseline: live_function_definitions.md
-- Staging had NO update_invoice_atomic, so full CREATE here.
-- D1 guard added after the "Lock old invoice" SELECT.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_invoice_atomic(
  p_invoice_id   uuid,
  p_tenant_id    uuid,
  p_invoice_data jsonb,
  p_items        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_id        UUID;
  v_client_name      TEXT;
  v_subtotal         NUMERIC;
  v_discount         NUMERIC;
  v_delivery_charge  NUMERIC;
  v_remarks          TEXT;
  v_net_total        NUMERIC;
  v_paid_amount      NUMERIC;
  v_due_amount       NUMERIC;
  v_payment_type     TEXT;
  v_cash_paid        NUMERIC;
  v_card_paid        NUMERIC;
  v_bank_paid        NUMERIC;
  v_others_paid      NUMERIC;
  v_status           TEXT;
  v_invoice_type     TEXT;
  v_old_invoice      RECORD;
  v_old_item         RECORD;
  v_is_old_return    BOOLEAN;
  v_is_new_return    BOOLEAN;
  v_revert_delta     NUMERIC;
  v_new_item         JSONB;
  v_item_id          UUID;
  v_item_code        TEXT;
  v_item_qty         NUMERIC;
  v_apply_delta      NUMERIC;
  v_code_item_id     UUID;
  v_old_due          NUMERIC;
  v_new_due          NUMERIC;
  v_due_diff         NUMERIC;
  v_client_bal       NUMERIC;
  v_updated_invoice  JSONB;
BEGIN
  IF p_invoice_id IS NULL THEN RAISE EXCEPTION 'invoice_id is required'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id is required'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one line item is required'; END IF;

  v_client_id       := NULLIF(p_invoice_data->>'client_id', '')::UUID;
  v_client_name     := COALESCE(p_invoice_data->>'client_name', 'Walk-in Customer');
  v_subtotal        := COALESCE((p_invoice_data->>'subtotal')::NUMERIC, 0);
  v_discount        := COALESCE((p_invoice_data->>'discount')::NUMERIC, 0);
  v_delivery_charge := COALESCE((p_invoice_data->>'delivery_charge')::NUMERIC, 0);
  v_remarks         := p_invoice_data->>'remarks';
  v_net_total       := COALESCE((p_invoice_data->>'net_total')::NUMERIC, 0);
  v_paid_amount     := COALESCE((p_invoice_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount      := COALESCE((p_invoice_data->>'due_amount')::NUMERIC, 0);
  v_payment_type    := COALESCE(p_invoice_data->>'payment_type', 'cash');
  v_cash_paid       := COALESCE((p_invoice_data->>'cash_paid')::NUMERIC, 0);
  v_card_paid       := COALESCE((p_invoice_data->>'card_paid')::NUMERIC, 0);
  v_bank_paid       := COALESCE((p_invoice_data->>'bank_paid')::NUMERIC, 0);
  v_others_paid     := COALESCE((p_invoice_data->>'others_paid')::NUMERIC, 0);
  v_status          := COALESCE(p_invoice_data->>'status', 'completed');
  v_invoice_type    := COALESCE(p_invoice_data->>'invoice_type', 'sales');
  v_is_new_return   := (v_invoice_type = 'return');

  SELECT * INTO v_old_invoice FROM invoices
   WHERE id = p_invoice_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;

  -- D1 Enforcement: Reject edits to special invoices
  IF v_old_invoice.printed_as = 'special' THEN
    RAISE EXCEPTION 'Special invoices cannot be edited. Please cancel this invoice and create a new special sale.';
  END IF;

  v_is_old_return := (v_old_invoice.invoice_type = 'return');
  v_old_due       := COALESCE(v_old_invoice.due_amount, 0);

  FOR v_old_item IN SELECT item_id, item_code, qty FROM invoice_items WHERE invoice_id = p_invoice_id
  LOOP
    v_revert_delta := CASE WHEN v_is_old_return THEN -COALESCE(v_old_item.qty,0) ELSE COALESCE(v_old_item.qty,0) END;
    IF v_old_item.item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty,0) + v_revert_delta)
       WHERE id = v_old_item.item_id AND tenant_id = p_tenant_id;
    ELSIF v_old_item.item_code IS NOT NULL AND trim(v_old_item.item_code) <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_old_item.item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty,0) + v_revert_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;

  FOR v_new_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_new_item->>'item_id', '')::UUID;
    v_item_code := TRIM(COALESCE(v_new_item->>'item_code', ''));
    v_item_qty  := COALESCE((v_new_item->>'qty')::NUMERIC, 1);
    INSERT INTO invoice_items (
      invoice_id, item_id, item_code, item_name, shade_code,
      pack_size, unit, qty, unit_price, discount, discount_percent, total_price
    ) VALUES (
      p_invoice_id, v_item_id, v_item_code,
      COALESCE(v_new_item->>'item_name', ''),
      COALESCE(v_new_item->>'shade_code', ''),
      COALESCE(v_new_item->>'pack_size', 'Can'),
      COALESCE(v_new_item->>'unit', 'PCS'),
      v_item_qty,
      COALESCE((v_new_item->>'unit_price')::NUMERIC, 0),
      COALESCE((v_new_item->>'discount')::NUMERIC, 0),
      COALESCE((v_new_item->>'discount_percent')::NUMERIC, 0),
      COALESCE((v_new_item->>'total_price')::NUMERIC, 0)
    );
    v_apply_delta := CASE WHEN v_is_new_return THEN v_item_qty ELSE -v_item_qty END;
    IF v_item_id IS NOT NULL THEN
      UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty,0) + v_apply_delta)
       WHERE id = v_item_id AND tenant_id = p_tenant_id;
    ELSIF v_item_code <> '' THEN
      SELECT id INTO v_code_item_id FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code LIMIT 1;
      IF v_code_item_id IS NOT NULL THEN
        UPDATE items SET stock_qty = GREATEST(0, COALESCE(stock_qty,0) + v_apply_delta)
         WHERE id = v_code_item_id;
      END IF;
    END IF;
  END LOOP;

  v_new_due  := v_due_amount;
  v_due_diff := v_new_due - v_old_due;
  IF v_client_id IS NOT NULL AND v_due_diff <> 0 THEN
    SELECT current_balance INTO v_client_bal FROM clients
     WHERE id = v_client_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF FOUND THEN
      UPDATE clients SET current_balance = COALESCE(v_client_bal,0) + v_due_diff
       WHERE id = v_client_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  UPDATE invoices SET
    client_id = v_client_id, client_name = v_client_name,
    subtotal = v_subtotal, discount = v_discount, delivery_charge = v_delivery_charge,
    remarks = v_remarks, net_total = v_net_total, paid_amount = v_paid_amount,
    due_amount = v_due_amount, payment_type = v_payment_type,
    cash_paid = v_cash_paid, card_paid = v_card_paid,
    bank_paid = v_bank_paid, others_paid = v_others_paid, status = v_status
  WHERE id = p_invoice_id AND tenant_id = p_tenant_id;

  SELECT row_to_json(i)::JSONB INTO v_updated_invoice FROM invoices i WHERE i.id = p_invoice_id;

  INSERT INTO audit_logs (tenant_id, user_name, action, action_type, entity_type, entity_id, details)
  VALUES (
    p_tenant_id, v_client_name, 'Sales Invoice Updated (Atomic)', 'update', 'invoice', p_invoice_id,
    jsonb_build_object(
      'invoice_no', v_old_invoice.invoice_no, 'previous_net', v_old_invoice.net_total,
      'new_net', v_net_total, 'items_count', jsonb_array_length(p_items), 'due_diff', v_due_diff
    )
  );

  RETURN jsonb_build_object('success', true, 'invoice', v_updated_invoice);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_invoice_atomic FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_invoice_atomic TO service_role;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
