-- ============================================================================
-- Migration: 20261006_01_performance_kpi_and_templates_rpc.sql
-- Description: Phase 11 Performance & Reliability RPCs:
--   1. get_ceo_branches_kpi_summary: Server-side branch KPI aggregation
--      eliminating client N+1 fan-out queries.
--   2. set_default_receipt_template: Atomic default receipt template switching
--      preventing zero-default template state on failure.
--   3. Performance indexes on clients and invoices for fast aggregation.
-- ============================================================================

-- Performance partial index for client receivables calculation
CREATE INDEX IF NOT EXISTS idx_clients_tenant_balance 
  ON clients (tenant_id, current_balance) 
  WHERE current_balance > 0;

-- Performance index for active non-return invoices KPI aggregation
CREATE INDEX IF NOT EXISTS idx_invoices_kpi 
  ON invoices (tenant_id, date) 
  WHERE (status IS NULL OR status <> 'cancelled') 
    AND (invoice_type IS NULL OR invoice_type <> 'return');

-- 1. Server-side Branch KPI Aggregation Function (TASK-P11-02 / PERF-002)
CREATE OR REPLACE FUNCTION get_ceo_branches_kpi_summary(
  p_tenant_ids UUID[],
  p_today DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  tenant_id UUID,
  today_sales NUMERIC,
  monthly_sales NUMERIC,
  total_receivables NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH tenant_list AS (
    SELECT unnest(p_tenant_ids) AS tid
  ),
  inv_summary AS (
    SELECT 
      i.tenant_id AS tid,
      COALESCE(SUM(CASE WHEN i.date = p_today THEN i.net_total ELSE 0 END), 0) AS today_sum,
      COALESCE(SUM(CASE WHEN i.date >= DATE_TRUNC('month', p_today)::DATE 
                         AND i.date < (DATE_TRUNC('month', p_today) + INTERVAL '1 month')::DATE 
                        THEN i.net_total ELSE 0 END), 0) AS month_sum
    FROM invoices i
    WHERE i.tenant_id = ANY(p_tenant_ids)
      AND COALESCE(i.status, '') <> 'cancelled'
      AND COALESCE(i.invoice_type, '') <> 'return'
    GROUP BY i.tenant_id
  ),
  client_summary AS (
    SELECT 
      c.tenant_id AS tid,
      COALESCE(SUM(CASE WHEN c.current_balance > 0 THEN c.current_balance ELSE 0 END), 0) AS rec_sum
    FROM clients c
    WHERE c.tenant_id = ANY(p_tenant_ids)
    GROUP BY c.tenant_id
  )
  SELECT 
    tl.tid AS tenant_id,
    COALESCE(inv.today_sum, 0)::NUMERIC AS today_sales,
    COALESCE(inv.month_sum, 0)::NUMERIC AS monthly_sales,
    COALESCE(cs.rec_sum, 0)::NUMERIC AS total_receivables
  FROM tenant_list tl
  LEFT JOIN inv_summary inv ON tl.tid = inv.tid
  LEFT JOIN client_summary cs ON tl.tid = cs.tid;
END;
$$;

-- 2. Atomic Default Receipt Template Switching (TASK-P11-11 / LEG-002)
CREATE OR REPLACE FUNCTION set_default_receipt_template(p_template_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template receipt_templates%ROWTYPE;
BEGIN
  -- Verify the template exists and is not soft-deleted
  SELECT * INTO v_template
  FROM receipt_templates
  WHERE id = p_template_id AND is_deleted = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receipt template not found or is deleted';
  END IF;

  -- Reset all other templates to not default
  UPDATE receipt_templates
  SET is_default = false
  WHERE id <> p_template_id AND is_default = true;

  -- Set target template as default
  UPDATE receipt_templates
  SET is_default = true
  WHERE id = p_template_id
  RETURNING * INTO v_template;

  RETURN jsonb_build_object(
    'success', true,
    'template', to_jsonb(v_template)
  );
END;
$$;
