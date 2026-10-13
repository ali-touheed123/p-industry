-- Migration: 20261013_01_fix_create_purchase_atomic_audit_log.sql
-- Purpose:   Forward-only remediation of Task 2 — Canonical Audit Contract in create_purchase_atomic
-- Phase:     Patch (Post Phase 9)
-- Gate:      Gate B — Authorized by business owner (October 13, 2026)
--
-- ROOT CAUSE:
--   Phase 9 migration (20261005_05_purchases_shift_id.sql) introduced a regression at Step 7:
--   Defective audit insert attempted to write to non-existent column "entity":
--   (tenant_id, action, entity, entity_id, details, user_name).
--   Column "entity" does not exist in public.audit_logs (correct column is "entity_type").
--   PL/pgSQL deferred plan caching allowed this to deploy silently; it only fails at runtime,
--   aborting every purchase invoice and purchase return with PostgreSQL error 42703.
--
-- CHANGES vs CURRENT LIVE FUNCTION (20261005_05 baseline):
--   Step 5 / item_code path (C-01): Silent skip replaced with RAISE EXCEPTION (strict validation).
--   Step 6 / supplier UPDATE (C-02): Adds last_payment_amount + last_payment_date when paid_amount > 0.
--   Step 7 / audit INSERT: Fixes column list — replaces "entity" with "entity_type", adds "action_type",
--     corrects entity_id to v_purchase_id::text (C-05), corrects user_name to COALESCE(v_created_by,'System'),
--     corrects entity_type value to 'purchase' (singular), corrects action to human-readable strings.
--   Security: REVOKE from PUBLIC/anon/authenticated; GRANT strictly to service_role (C-06).
--
-- PRESERVED FROM PHASE 9 (20261005_05):
--   v_shift_id UUID DECLARE, extraction, purchases.shift_id INSERT, audit details payload.
--   Token validation, FOR UPDATE row locking, item_id path, supplier balance logic.
--   SECURITY DEFINER, SET search_path = public, pg_temp.
--
-- CONFIRMED BUSINESS DECISIONS:
--   C-01: item_code NOT FOUND => RAISE EXCEPTION (strict rollback — no ghost records).
--   C-02: paid_amount > 0 => also update last_payment_amount + last_payment_date on suppliers.
--   C-05: entity_id must be v_purchase_id::text (explicit cast — not raw UUID).
--   C-06: REVOKE from PUBLIC, anon, authenticated; GRANT to service_role only.
--
-- AUTHORITATIVE SECURITY POSTURE SOURCE:
--   supabase/migrations/20261009_01_supabase_advisor_reconciliation.sql#L50-L51
--
-- NOTE ON OFFLINE TESTS:
--   Static pattern checks in scripts/test-purchase-audit-offline.mjs verify lexical conformance only.
--   They do NOT compile PL/pgSQL, build SQL ASTs, or prove runtime column validity (deferred plan caching).
--   Live schema cross-check is performed separately in Task T7 (Gate C preflight).

-- ============================================================
-- FORWARD MIGRATION: CREATE OR REPLACE FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_purchase_atomic(
  p_tenant_id     UUID,
  p_purchase_data JSONB,
  p_items         JSONB,
  p_token_ids     UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
DECLARE
  v_purchase_no        TEXT;
  v_purchase_type      TEXT;
  v_supplier_id        UUID;
  v_supplier_name      TEXT;
  v_date               DATE;
  v_subtotal           NUMERIC;
  v_discount           NUMERIC;
  v_net_total          NUMERIC;
  v_paid_amount        NUMERIC;
  v_due_amount         NUMERIC;
  v_payment_type       TEXT;
  v_created_by         TEXT;
  v_shift_id           UUID;           -- Phase 9: shift linkage

  v_is_return          BOOLEAN;
  v_tokens_amount      NUMERIC := 0;
  v_purchase_id        UUID;
  v_token              RECORD;
  v_db_item            RECORD;
  v_qty_delta          NUMERIC;
  v_supplier           RECORD;
  v_current_bal        NUMERIC;
  v_new_balance        NUMERIC;
  v_cash_received      NUMERIC;
  v_return_credit      NUMERIC;
  v_line               JSONB;
  v_item_id            UUID;
  v_item_code          TEXT;
  v_token_count        INT;
BEGIN

  -- ── 0. Extract header fields from JSONB parameter ───────────────────────────
  v_purchase_no   := p_purchase_data->>'purchase_no';
  v_purchase_type := COALESCE(p_purchase_data->>'purchase_type', 'purchase');
  v_supplier_id   := NULLIF(p_purchase_data->>'supplier_id', '')::UUID;
  v_supplier_name := COALESCE(p_purchase_data->>'supplier_name', 'Supplier');
  v_date          := COALESCE((p_purchase_data->>'date')::DATE, CURRENT_DATE);
  v_subtotal      := COALESCE((p_purchase_data->>'subtotal')::NUMERIC, 0);
  v_discount      := COALESCE((p_purchase_data->>'discount')::NUMERIC, 0);
  v_net_total     := COALESCE((p_purchase_data->>'net_total')::NUMERIC, 0);
  v_paid_amount   := COALESCE((p_purchase_data->>'paid_amount')::NUMERIC, 0);
  v_due_amount    := COALESCE((p_purchase_data->>'due_amount')::NUMERIC, 0);
  v_payment_type  := COALESCE(p_purchase_data->>'payment_type', 'credit');
  v_created_by    := p_purchase_data->>'created_by';
  v_shift_id      := NULLIF(p_purchase_data->>'shift_id', '')::UUID;  -- Phase 9
  v_is_return     := (v_purchase_type = 'return');

  -- ── 1. Validate required fields ────────────────────────────────────────────
  IF v_purchase_no IS NULL OR trim(v_purchase_no) = '' THEN
    RAISE EXCEPTION 'purchase_no is required';
  END IF;
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id is required';
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one line item is required';
  END IF;

  -- ── 2. Validate & sum applied tokens; lock rows (prevent concurrent double-apply) ──
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_token_count
      FROM token_transactions
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;

    IF v_token_count <> array_length(p_token_ids, 1) THEN
      RAISE EXCEPTION 'One or more tokens do not belong to this tenant or do not exist';
    END IF;

    FOR v_token IN
      SELECT id, token_value, usage_status, used_against_purchase_id
        FROM token_transactions
       WHERE id = ANY(p_token_ids)
         AND tenant_id = p_tenant_id
         FOR UPDATE
    LOOP
      IF v_token.usage_status = 'used' OR v_token.used_against_purchase_id IS NOT NULL THEN
        RAISE EXCEPTION 'Token % has already been applied to another purchase', v_token.id;
      END IF;
      v_tokens_amount := v_tokens_amount + COALESCE(v_token.token_value, 0);
    END LOOP;
  END IF;

  -- ── 3. Insert purchase header (includes Phase 9 shift_id) ──────────────────
  INSERT INTO purchases (
    tenant_id, purchase_no, purchase_type, supplier_id, supplier_name,
    date, subtotal, discount, tokens_applied_amount, net_total,
    paid_amount, due_amount, payment_type, created_by, shift_id
  ) VALUES (
    p_tenant_id, v_purchase_no, v_purchase_type, v_supplier_id, v_supplier_name,
    v_date, v_subtotal, v_discount, v_tokens_amount, v_net_total,
    v_paid_amount, v_due_amount, v_payment_type, v_created_by, v_shift_id
  )
  RETURNING id INTO v_purchase_id;

  -- ── 4. Mark applied tokens as used ─────────────────────────────────────────
  IF p_token_ids IS NOT NULL AND array_length(p_token_ids, 1) > 0 THEN
    UPDATE token_transactions
       SET usage_status             = 'used',
           used_against_purchase_id = v_purchase_id
     WHERE id = ANY(p_token_ids)
       AND tenant_id = p_tenant_id;
  END IF;

  -- ── 5. Insert line items & adjust stock atomically (row-level lock per item) ──
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_id   := NULLIF(v_line->>'item_id', '')::UUID;
    v_item_code := v_line->>'item_code';

    INSERT INTO purchase_items (
      purchase_id, item_id, item_code, item_name,
      unit, qty, unit_price, total_price
    ) VALUES (
      v_purchase_id,
      v_item_id,
      v_item_code,
      COALESCE(v_line->>'item_name', ''),
      COALESCE(v_line->>'unit', 'Can'),
      COALESCE((v_line->>'qty')::NUMERIC, 0),
      COALESCE((v_line->>'unit_price')::NUMERIC, 0),
      COALESCE((v_line->>'total_price')::NUMERIC, 0)
    );

    -- Purchase increases stock; return decreases it
    v_qty_delta := CASE WHEN v_is_return
                        THEN -COALESCE((v_line->>'qty')::NUMERIC, 0)
                        ELSE  COALESCE((v_line->>'qty')::NUMERIC, 0)
                   END;

    IF v_item_id IS NOT NULL THEN
      -- Primary path: lookup by item_id (UUID)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE id = v_item_id AND tenant_id = p_tenant_id
         FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Item with ID % not found for this tenant', v_item_id;
      END IF;
      UPDATE items
         SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;

    ELSIF v_item_code IS NOT NULL AND trim(v_item_code) <> '' THEN
      -- Fallback path: lookup by item code (C-01 — strict validation, no silent skip)
      SELECT id, stock_qty INTO v_db_item
        FROM items
       WHERE tenant_id = p_tenant_id AND code = v_item_code
         FOR UPDATE;
      IF NOT FOUND THEN
        -- C-01: Strict exception — rolls back entire transaction immediately.
        -- Prevents ghost purchase records with unadjusted stock.
        RAISE EXCEPTION 'Item with code "%" not found for this tenant', v_item_code;
      END IF;
      UPDATE items
         SET stock_qty = GREATEST(0, COALESCE(v_db_item.stock_qty, 0) + v_qty_delta)
       WHERE id = v_db_item.id AND tenant_id = p_tenant_id;
    END IF;
  END LOOP;

  -- ── 6. Update supplier balance & payment metadata atomically ───────────────
  IF v_supplier_id IS NOT NULL THEN
    SELECT * INTO v_supplier
      FROM suppliers
     WHERE id = v_supplier_id AND tenant_id = p_tenant_id
       FOR UPDATE;

    IF FOUND THEN
      v_current_bal := COALESCE(v_supplier.current_balance, 0);

      IF NOT v_is_return THEN
        -- Purchase: unpaid amount increases supplier payable balance
        v_new_balance := v_current_bal + v_due_amount;
      ELSE
        -- Return: cash refund vs store credit against unpaid debt
        v_cash_received := v_paid_amount;
        v_return_credit := GREATEST(0, v_net_total - v_cash_received);
        v_new_balance   := v_current_bal - v_return_credit;
      END IF;

      -- C-02: Update current_balance always; update payment metadata only when payment was made.
      -- Supplier balance is adjusted exactly once — no separate voucher generated at purchase time.
      UPDATE suppliers
         SET current_balance     = v_new_balance,
             last_payment_amount = CASE WHEN v_paid_amount > 0 THEN v_paid_amount
                                        ELSE last_payment_amount END,
             last_payment_date   = CASE WHEN v_paid_amount > 0 THEN v_date
                                        ELSE last_payment_date END
       WHERE id = v_supplier_id AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  -- ── 7. Write audit log entry (canonical contract — F-06 / C-05) ────────────
  -- CORRECTED: "entity" column does not exist in audit_logs.
  --            Canonical columns: entity_type (NOT NULL), action_type (nullable).
  --            entity_id cast to ::text (C-05). user_name from operator identity (v_created_by).
  INSERT INTO audit_logs (
    tenant_id,
    user_name,
    action,
    action_type,
    entity_type,
    entity_id,
    details
  ) VALUES (
    p_tenant_id,
    COALESCE(v_created_by, 'System'),
    CASE WHEN v_is_return THEN 'Purchase Return' ELSE 'Purchase Invoice Complete' END,
    CASE WHEN v_is_return THEN 'purchase_return' ELSE 'purchase' END,
    'purchase',
    v_purchase_id::text,   -- C-05: explicit ::text cast required
    jsonb_build_object(
      'purchase_no',            v_purchase_no,
      'supplier_id',            v_supplier_id,
      'supplier_name',          v_supplier_name,
      'net_total',              v_net_total,
      'paid_amount',            v_paid_amount,
      'due_amount',             v_due_amount,
      'payment_type',           v_payment_type,
      'shift_id',               v_shift_id,
      'tokens_applied_amount',  v_tokens_amount
    )
  );

  -- ── 8. Return result ────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'purchase_id',            v_purchase_id,
    'purchase_no',            v_purchase_no,
    'tokens_applied_amount',  v_tokens_amount
  );

END;
$func$;

-- ============================================================
-- SECURITY POSTURE (C-06)
-- Authoritative source: 20261009_01_supabase_advisor_reconciliation.sql#L50-L51
-- Revoke execute from PUBLIC, anon, and authenticated roles.
-- Grant execute strictly to service_role only.
-- The Next.js API route (/api/purchases) calls this via supabaseAdmin (service_role key).
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_purchase_atomic(uuid, jsonb, jsonb, uuid[]) TO service_role;
