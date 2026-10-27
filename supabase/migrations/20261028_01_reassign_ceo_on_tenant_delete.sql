CREATE OR REPLACE FUNCTION public.reassign_ceo_before_tenant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sister_tenant_id UUID;
  v_ceo RECORD;
BEGIN
  FOR v_ceo IN
    SELECT id, owner_id
    FROM public.app_users
    WHERE tenant_id = OLD.id
      AND role = 'ceo'
      AND owner_id IS NOT NULL
  LOOP
    v_sister_tenant_id := NULL;

    SELECT id INTO v_sister_tenant_id
    FROM public.tenants
    WHERE owner_id = v_ceo.owner_id
      AND id <> OLD.id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_sister_tenant_id IS NOT NULL THEN
      UPDATE public.app_users
      SET tenant_id = v_sister_tenant_id
      WHERE id = v_ceo.id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reassign_ceo_before_tenant_delete ON public.tenants;

CREATE TRIGGER trg_reassign_ceo_before_tenant_delete
BEFORE DELETE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.reassign_ceo_before_tenant_delete();
