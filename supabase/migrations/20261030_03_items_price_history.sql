-- Migration: 20261030_03_items_price_history.sql
-- Description: Track item retail_price changes over time for authoritative offline rate-lock validation.
-- Security: RLS enabled, direct write access restricted to triggers & service_role.

CREATE TABLE IF NOT EXISTS public.items_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  retail_price NUMERIC(15, 2) NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Enable row-level security and revoke direct public/authenticated access
ALTER TABLE public.items_price_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.items_price_history FROM anon, authenticated;

-- Index for temporal history queries by tenant and item
CREATE INDEX IF NOT EXISTS idx_items_price_history_lookup
  ON public.items_price_history(tenant_id, item_id, effective_from DESC);

-- Trigger function: guarded so NULL retail_price never blocks insert/update
CREATE OR REPLACE FUNCTION public.trg_track_item_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.retail_price IS NOT NULL THEN
    IF (TG_OP = 'UPDATE' AND OLD.retail_price IS DISTINCT FROM NEW.retail_price) THEN
      INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
      VALUES (NEW.tenant_id, NEW.id, NEW.retail_price, now());
    ELSIF (TG_OP = 'INSERT') THEN
      INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
      VALUES (NEW.tenant_id, NEW.id, NEW.retail_price, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_items_price_change ON public.items;
CREATE TRIGGER trg_items_price_change
  AFTER INSERT OR UPDATE OF retail_price ON public.items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_track_item_price_change();

-- Seed existing items with their created_at timestamp (WHERE NOT EXISTS ensures idempotency)
-- Past price modifications prior to table creation are unknown.
INSERT INTO public.items_price_history (tenant_id, item_id, retail_price, effective_from)
SELECT 
  i.tenant_id, 
  i.id, 
  i.retail_price, 
  COALESCE(i.created_at, '2020-01-01 00:00:00+00'::timestamptz)
FROM public.items i
WHERE i.retail_price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.items_price_history h WHERE h.item_id = i.id
  );

