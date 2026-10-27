-- Migration: 20261027_04_create_owners_and_multi_branch_ceo.sql
-- Description: Creates public.owners, adds owner_id to tenants and app_users,
-- and deterministically backfills existing owners and CEO users.

-- 1. Create table public.owners
CREATE TABLE IF NOT EXISTS public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS and establish service-role-only access
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'owners' AND policyname = 'service_role_all_owners'
  ) THEN
    CREATE POLICY "service_role_all_owners"
      ON public.owners
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Add owner_id to tenants and app_users (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.tenants
      ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.app_users
      ADD COLUMN owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_tenants_owner_id ON public.tenants(owner_id);
CREATE INDEX IF NOT EXISTS idx_app_users_owner_id ON public.app_users(owner_id);

-- 3. Backfill owners from existing tenants
-- Deduplication rule: Group by LOWER(TRIM(email)) first; use LOWER(TRIM(owner_name)) only when email is NULL or empty.
-- Strict deterministic grouping, no loose OR matches.

DO $$
DECLARE
  rec RECORD;
  v_owner_id UUID;
BEGIN
  -- Pass 1: Tenants with non-empty email
  FOR rec IN
    SELECT
      LOWER(TRIM(email)) AS norm_email,
      MIN(TRIM(COALESCE(owner_name, name, 'Business Owner'))) AS sample_name,
      MIN(TRIM(phone)) AS sample_phone
    FROM public.tenants
    WHERE email IS NOT NULL AND TRIM(email) <> ''
    GROUP BY LOWER(TRIM(email))
  LOOP
    -- Check if owner with this email already exists
    SELECT id INTO v_owner_id
    FROM public.owners
    WHERE LOWER(TRIM(email)) = rec.norm_email
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      INSERT INTO public.owners (name, email, phone)
      VALUES (rec.sample_name, rec.norm_email, rec.sample_phone)
      RETURNING id INTO v_owner_id;
    END IF;

    -- Update tenants having this normalized email
    UPDATE public.tenants
    SET owner_id = v_owner_id
    WHERE LOWER(TRIM(email)) = rec.norm_email
      AND (owner_id IS NULL OR owner_id <> v_owner_id);
  END LOOP;

  -- Pass 2: Tenants with NULL or empty email (group by normalized owner_name)
  FOR rec IN
    SELECT
      LOWER(TRIM(owner_name)) AS norm_name,
      MIN(TRIM(COALESCE(owner_name, name, 'Business Owner'))) AS sample_name,
      MIN(TRIM(phone)) AS sample_phone
    FROM public.tenants
    WHERE (email IS NULL OR TRIM(email) = '')
      AND owner_name IS NOT NULL AND TRIM(owner_name) <> ''
    GROUP BY LOWER(TRIM(owner_name))
  LOOP
    SELECT id INTO v_owner_id
    FROM public.owners
    WHERE email IS NULL AND LOWER(TRIM(name)) = rec.norm_name
    LIMIT 1;

    IF v_owner_id IS NULL THEN
      INSERT INTO public.owners (name, email, phone)
      VALUES (rec.sample_name, NULL, rec.sample_phone)
      RETURNING id INTO v_owner_id;
    END IF;

    UPDATE public.tenants
    SET owner_id = v_owner_id
    WHERE (email IS NULL OR TRIM(email) = '')
      AND LOWER(TRIM(owner_name)) = rec.norm_name
      AND (owner_id IS NULL OR owner_id <> v_owner_id);
  END LOOP;

  -- Pass 3: Fallback for any remaining tenants without owner_id
  FOR rec IN
    SELECT id, name, phone
    FROM public.tenants
    WHERE owner_id IS NULL
  LOOP
    INSERT INTO public.owners (name, email, phone)
    VALUES (COALESCE(rec.name, 'Shop Owner'), NULL, rec.phone)
    RETURNING id INTO v_owner_id;

    UPDATE public.tenants
    SET owner_id = v_owner_id
    WHERE id = rec.id;
  END LOOP;

  -- 4. Update app_users for role = 'ceo'
  -- Link each CEO user to the owner_id of their assigned tenant
  UPDATE public.app_users u
  SET owner_id = t.owner_id
  FROM public.tenants t
  WHERE u.tenant_id = t.id
    AND u.role = 'ceo'
    AND t.owner_id IS NOT NULL
    AND (u.owner_id IS NULL OR u.owner_id <> t.owner_id);

END $$;
