-- Migration 20261008_02_revoked_sessions.sql
-- Server-Side Session Revocation Mechanism (Task 13.3.3 - MF-AUTH-004)

CREATE TABLE IF NOT EXISTS revoked_sessions (
  jti TEXT PRIMARY KEY,
  user_id TEXT,
  revoked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for expiration cleanup queries
CREATE INDEX IF NOT EXISTS idx_revoked_sessions_expires_at ON revoked_sessions(expires_at);

-- Enable RLS
ALTER TABLE revoked_sessions ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'revoked_sessions' AND policyname = 'revoked_sessions_service_role_all'
  ) THEN
    CREATE POLICY revoked_sessions_service_role_all ON revoked_sessions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
