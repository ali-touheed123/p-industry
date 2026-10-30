-- ============================================================================
-- SQL Test: test_20261030_07_shifts_local_shift.sql
-- Phase: Test suite for Migration 07 (Shifts Local Shift & Offline Sync)
-- Transaction: Strictly transactional (BEGIN ... ROLLBACK). Leaves NO data behind.
-- Status: NOT APPLIED (Run manually or via test harness; rolls back completely)
-- ============================================================================

BEGIN;

-- Apply migration 07 inside this sandbox transaction
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS local_shift_id UUID NULL,
  ADD COLUMN IF NOT EXISTS is_offline BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_local_shift_dedup
  ON public.shifts(tenant_id, local_shift_id)
  WHERE local_shift_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_shifts_offline_status
  ON public.shifts(tenant_id, status, is_offline)
  WHERE is_offline = true;

DO $$
DECLARE
  v_tenant_id        UUID;
  v_local_shift_id   UUID := gen_random_uuid();
  v_server_shift_id  UUID;
  v_duplicate_caught BOOLEAN := false;
BEGIN
  -- Create isolated sandbox tenant to avoid interfering with live tenant shifts
  INSERT INTO public.tenants (name, slug)
  VALUES ('Offline Shift Test Sandbox', 'offline-shift-test-sandbox-' || substr(md5(random()::text), 1, 8))
  RETURNING id INTO v_tenant_id;

  -- 1. Insert offline shift with local_shift_id (SERVER generates primary key id)
  -- Note: Notice we DO NOT provide `id` in the INSERT list; Postgres generates default UUID.
  INSERT INTO public.shifts (
    tenant_id, local_shift_id, is_offline, device_id,
    opening_cash, start_time, status, notes
  ) VALUES (
    v_tenant_id,
    v_local_shift_id,
    true,
    'DEV-TEST-01',
    1000.00,
    NOW() - INTERVAL '2 hours',
    'open',
    'Offline shift opened during power outage'
  )
  RETURNING id INTO v_server_shift_id;

  -- Verify server id is distinct from client-supplied local_shift_id
  IF v_server_shift_id IS NULL THEN
    RAISE EXCEPTION 'Test failed: Server did not generate shift ID';
  END IF;

  IF v_server_shift_id = v_local_shift_id THEN
    RAISE EXCEPTION 'Test failed: Server generated id matches client local_shift_id unexpectedly';
  END IF;

  RAISE NOTICE 'T1 PASS: Offline shift inserted with server-generated id (%), client local_shift_id retained (%)',
    v_server_shift_id, v_local_shift_id;

  -- 2. Duplicate insertion with same local_shift_id must trigger unique violation
  BEGIN
    INSERT INTO public.shifts (
      tenant_id, local_shift_id, is_offline, device_id,
      opening_cash, start_time, status, notes
    ) VALUES (
      v_tenant_id,
      v_local_shift_id,
      true,
      'DEV-TEST-01',
      1000.00,
      NOW(),
      'closed',
      'Duplicate sync attempt'
    );
  EXCEPTION
    WHEN unique_violation THEN
      v_duplicate_caught := true;
  END;

  IF NOT v_duplicate_caught THEN
    RAISE EXCEPTION 'Test failed: idx_shifts_local_shift_dedup failed to prevent duplicate local_shift_id';
  END IF;

  RAISE NOTICE 'T2 PASS: Unique partial index prevented duplicate shift insert for same local_shift_id';

  -- 3. Standard online shift insertion (without local_shift_id) still succeeds
  INSERT INTO public.shifts (
    tenant_id, opening_cash, start_time, status, notes
  ) VALUES (
    v_tenant_id, 2500.00, NOW(), 'closed', 'Standard online shift'
  );

  RAISE NOTICE 'T3 PASS: Standard online shift insert without local_shift_id works unaffected';

  RAISE NOTICE 'ALL MIGRATION 07 TESTS PASSED SUCCESSFULLY ✅';
END;
$$;

ROLLBACK;
