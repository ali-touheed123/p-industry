-- Rollback: 20261030_03_items_price_history.sql
-- Drops the trigger, trigger function, and the table.
-- Safe to run even if partially applied.

DROP TRIGGER IF EXISTS trg_items_price_change ON public.items;
DROP FUNCTION IF EXISTS public.trg_track_item_price_change();
DROP TABLE IF EXISTS public.items_price_history;

