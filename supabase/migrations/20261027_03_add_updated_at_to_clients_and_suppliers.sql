-- Migration: 20261027_03_add_updated_at_to_clients_and_suppliers.sql
-- Description: Add missing updated_at columns to clients and suppliers tables to satisfy create_voucher_atomic

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'clients' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'suppliers' 
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.suppliers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
