-- Migration 20261008_01_rate_limit_system.sql
-- Persistent cold-start resistant rate limiting via PostgreSQL (Task 13.1.3 - MF-SEC-001)

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE rate_limit_entries ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rate_limit_entries' AND policyname = 'rate_limit_service_role_all'
  ) THEN
    CREATE POLICY rate_limit_service_role_all ON rate_limit_entries
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Atomic Rate Limit RPC
CREATE OR REPLACE FUNCTION check_rate_limit_atomic(
  p_key TEXT,
  p_max_attempts INT DEFAULT 5,
  p_window_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_new_reset TIMESTAMPTZ := v_now + (p_window_seconds || ' seconds')::INTERVAL;
  v_record RECORD;
  v_allowed BOOLEAN;
  v_remaining INT;
  v_retry_after INT;
BEGIN
  -- Insert or update existing record
  INSERT INTO rate_limit_entries (key, count, reset_at, updated_at)
  VALUES (p_key, 1, v_new_reset, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN rate_limit_entries.reset_at <= v_now THEN 1
      ELSE rate_limit_entries.count + 1
    END,
    reset_at = CASE
      WHEN rate_limit_entries.reset_at <= v_now THEN v_new_reset
      ELSE rate_limit_entries.reset_at
    END,
    updated_at = v_now
  RETURNING count, reset_at INTO v_record;

  IF v_record.count > p_max_attempts THEN
    v_allowed := FALSE;
    v_remaining := 0;
    v_retry_after := CEIL(EXTRACT(EPOCH FROM (v_record.reset_at - v_now)))::INT;
  ELSE
    v_allowed := TRUE;
    v_remaining := p_max_attempts - v_record.count;
    v_retry_after := 0;
  END IF;

  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'remaining', v_remaining,
    'retry_after_sec', v_retry_after
  );
END;
$$;

-- Reset Rate Limit RPC
CREATE OR REPLACE FUNCTION reset_rate_limit_atomic(p_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM rate_limit_entries WHERE key = p_key;
END;
$$;
