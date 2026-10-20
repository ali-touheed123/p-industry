-- Migration: 20261020_01_seed_tph_inventory_from_stock_report.sql
-- Direct SQL Seed Migration for Store: TPH (Tawakkal Paint House)
-- Tenant ID: 36da36b6-c1d2-448c-b685-3d7f354fdfca
-- Source: STOCK REPORT.pdf
-- Scope: Option B (PDF catalog only, excluding Sunrise & Diamond)
-- Quantities, opening, balance = 0 | Prices & taxes = 0.00
-- Token tables untouched (has_token = false, token_value = 0.00)

DO $$
DECLARE
  v_tenant_id UUID := '36da36b6-c1d2-448c-b685-3d7f354fdfca'::UUID;
BEGIN
  -- 1. Ensure Tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Target tenant % does not exist in public.tenants', v_tenant_id;
  END IF;

  -- 2. Seed Brands
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'BERGER', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('BERGER')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'BLACKHORSE', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('BLACKHORSE')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'BLUE BIRD', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('BLUE BIRD')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'BRIGHTO', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('BRIGHTO')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'CHOICE', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('CHOICE')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'GENERAL HARDWARE', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('GENERAL HARDWARE')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'GOBI''S', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('GOBI''S')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'KAIZEN', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('KAIZEN')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'NIPPON', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('NIPPON')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'RELIABLE', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('RELIABLE')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'RELIANCE', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('RELIANCE')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'ROZZI', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('ROZZI')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'SILK GOLDEN', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('SILK GOLDEN')
  );
  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, 'UJALA', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('UJALA')
  );

  -- 3. Seed Brand Series
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Tools & Adhesives', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GENERAL HARDWARE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Tools & Adhesives')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Boom Gloss Enamel', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BRIGHTO')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Boom Gloss Enamel')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Boom Super Mastic', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BRIGHTO')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Boom Super Mastic')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Boom Super Silk', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BRIGHTO')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Boom Super Silk')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Q Enamel', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('NIPPON')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Q Enamel')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Gloss Finish Enamel', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BLACKHORSE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Gloss Finish Enamel')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Synthetic Enamel', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('UJALA')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Synthetic Enamel')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Water Base Primer', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BERGER')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Water Base Primer')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Silk Matt', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('SILK GOLDEN')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Silk Matt')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Easy Coat', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('RELIANCE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Easy Coat')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Plastic Emulsion', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('RELIANCE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Plastic Emulsion')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Synthetic Enamel', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('RELIANCE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Synthetic Enamel')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Weather Guard', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('RELIANCE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Weather Guard')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Lac Undercoat', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('ROZZI')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Lac Undercoat')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Reliable Series', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('RELIABLE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Reliable Series')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Aqueous Matt (Premium)', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Aqueous Matt (Premium)')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Armor Series', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Armor Series')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Car Man Synthetic', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Car Man Synthetic')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Eggshell Special Shades', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Eggshell Special Shades')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'General Series', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('General Series')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Gold Series', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Gold Series')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Heat Flex Speciality', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Heat Flex Speciality')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Putty & Surface Prep', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Putty & Surface Prep')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Silk Sheen (Premium)', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Silk Sheen (Premium)')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Thinners & Solvents', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Thinners & Solvents')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Valmate / Summer / Kontra', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('GOBI''S')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Valmate / Summer / Kontra')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Industrial Coatings', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('KAIZEN')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Industrial Coatings')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Premier Series', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('CHOICE')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Premier Series')
    );
  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, 'Wood Care & Varnish', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('BLUE BIRD')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('Wood Care & Varnish')
    );

  -- 4. Seed Inventory Items (Opening = 0, Balance = 0, Price = 0)
  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('MS6', 'FIRE ROSE WOOD GRAINING RUBBER - RED', 'Accessories', 'GENERAL HARDWARE', 'Tools & Adhesives', 'PCS', 'PCS', 'RED'),
    ('BSMG1', 'BRIGHTO BOOM SUPER MASTIC - BASE 1', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Gallon', 'Gallon', 'BASE 1'),
    ('BSMG2', 'BRIGHTO BOOM SUPER MASTIC - BASE 2', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Gallon', 'Gallon', 'BASE 2'),
    ('BSMG3', 'BRIGHTO BOOM SUPER MASTIC - BASE 3', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Gallon', 'Gallon', 'BASE 3'),
    ('BSMG4', 'BRIGHTO BOOM SUPER MASTIC - BASE 4', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Gallon', 'Gallon', 'BASE 4'),
    ('BSMQ1', 'BRIGHTO BOOM SUPER MASTIC - BASE 1', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Quarter', 'Quarter', 'BASE 1'),
    ('BSMQ2', 'BRIGHTO BOOM SUPER MASTIC - BASE 2', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Quarter', 'Quarter', 'BASE 2'),
    ('BSMQ3', 'BRIGHTO BOOM SUPER MASTIC - BASE 3', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Quarter', 'Quarter', 'BASE 3'),
    ('BSMQ4', 'BRIGHTO BOOM SUPER MASTIC - BASE 4', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Mastic', 'Quarter', 'Quarter', 'BASE 4'),
    ('BGFG1', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 1', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Gallon', 'Gallon', 'BASE 1'),
    ('BGFG2', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 2', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Gallon', 'Gallon', 'BASE 2'),
    ('BGFG3', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 3', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Gallon', 'Gallon', 'BASE 3'),
    ('BGFG4', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 4', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Gallon', 'Gallon', 'BASE 4'),
    ('BGFQ1', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 1', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Quarter', 'Quarter', 'BASE 1'),
    ('BGFQ2', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 2', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Quarter', 'Quarter', 'BASE 2'),
    ('BGFQ3', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 3', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Quarter', 'Quarter', 'BASE 3'),
    ('BGFQ4', 'BRIGHTO BOOM GLOSS ENAMEL - BASE 4', 'Synthetic Enamel', 'BRIGHTO', 'Boom Gloss Enamel', 'Quarter', 'Quarter', 'BASE 4'),
    ('BSSEQ1', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 1', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Quarter', 'Quarter', 'BASE 1'),
    ('BSSEQ2', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 2', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Quarter', 'Quarter', 'BASE 2'),
    ('BSSEQ3', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 3', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Quarter', 'Quarter', 'BASE 3'),
    ('BSSEQ4', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 4', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Quarter', 'Quarter', 'BASE 4'),
    ('BSSED1', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 1', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Drum', 'Drum', 'BASE 1'),
    ('BSSED4', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 4', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Drum', 'Drum', 'BASE 4'),
    ('BSSED2', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 2', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Drum', 'Drum', 'BASE 2'),
    ('BSSED3', 'BRIGHTO BOOM SUPER SILK EMULSION - BASE 3', 'Emulsion Interior', 'BRIGHTO', 'Boom Super Silk', 'Drum', 'Drum', 'BASE 3'),
    ('NG90006', 'NIPPON Q ENAMEL', 'Synthetic Enamel', 'NIPPON', 'Q Enamel', 'Gallon', 'Gallon', NULL),
    ('NQ90006', 'NIPPON Q ENAMEL', 'Synthetic Enamel', 'NIPPON', 'Q Enamel', 'Quarter', 'Quarter', NULL),
    ('BG200', 'BLACKHORSE GLOSS FINISH ENAMEL', 'Synthetic Enamel', 'BLACKHORSE', 'Gloss Finish Enamel', 'Gallon', 'Gallon', NULL),
    ('GLUE', 'HIGH QUALITY WUDHESIVE GLUE - WHITE', 'Accessories', 'GENERAL HARDWARE', 'Tools & Adhesives', 'KG', 'KG', 'WHITE'),
    ('RREGMAR', 'DEERFOS ROLL REGMAR', 'Accessories', 'GENERAL HARDWARE', 'Tools & Adhesives', 'Foot', 'Foot', NULL),
    ('UG200', 'UJALA SYNTHETIC ENAMEL', 'Synthetic Enamel', 'UJALA', 'Synthetic Enamel', 'Gallon', 'Gallon', NULL),
    ('BWPG', 'BERGER WATER BASE PRIMER', 'Primers & Putty', 'BERGER', 'Water Base Primer', 'Gallon', 'Gallon', NULL),
    ('BWPD', 'BERGER WATER BASE PRIMER', 'Primers & Putty', 'BERGER', 'Water Base Primer', 'Drum', 'Drum', NULL),
    ('SG901', 'SILK GOLDEN SILK MATT - OFF WHITE 901', 'Synthetic Enamel', 'SILK GOLDEN', 'Silk Matt', 'Gallon', 'Gallon', 'OFF WHITE 901'),
    ('SG904', 'SILK GOLDEN SILK MATT - FAWN 904', 'Synthetic Enamel', 'SILK GOLDEN', 'Silk Matt', 'Gallon', 'Gallon', 'FAWN 904'),
    ('SG907', 'SILK GOLDEN SILK MATT - CORAL COVE 907', 'Synthetic Enamel', 'SILK GOLDEN', 'Silk Matt', 'Gallon', 'Gallon', 'CORAL COVE 907'),
    ('RG101', 'RELIANCE SYNTHETIC ENAMEL - WHITE 101', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'WHITE 101'),
    ('RG116', 'RELIANCE SYNTHETIC ENAMEL - SOFT TERRACOTTA 126', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'SOFT TERRACOTTA 126'),
    ('RG141', 'RELIANCE SYNTHETIC ENAMEL - POLISH BROWN 141', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'POLISH BROWN 141'),
    ('RG145', 'RELIANCE SYNTHETIC ENAMEL - ROSE CANDY 145', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'ROSE CANDY 145'),
    ('RG124', 'RELIANCE SYNTHETIC ENAMEL - DARK GREY 124', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'DARK GREY 124'),
    ('RG106', 'RELIANCE SYNTHETIC ENAMEL - MID BLUE 106', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'MID BLUE 106'),
    ('RG108', 'RELIANCE SYNTHETIC ENAMEL - SEA GREEN 108', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'SEA GREEN 108'),
    ('RG112', 'RELIANCE SYNTHETIC ENAMEL - ROYAL GREEN 112', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'ROYAL GREEN 112'),
    ('RG018', 'RELIANCE PLASTIC EMULSION - POPPY018', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'POPPY018'),
    ('RG040', 'RELIANCE PLASTIC EMULSION - JADE 040', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'JADE 040'),
    ('RG047', 'RELIANCE PLASTIC EMULSION - CITRUS YELLOW 047', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'CITRUS YELLOW 047'),
    ('RG048', 'RELIANCE PLASTIC EMULSION - ORANGE 048', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ORANGE 048'),
    ('RG049', 'RELIANCE PLASTIC EMULSION - TILE RED 049', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'TILE RED 049'),
    ('RG050', 'RELIANCE PLASTIC EMULSION - SWEET BLUE NEW 050', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SWEET BLUE NEW 050')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('RG051', 'RELIANCE PLASTIC EMULSION - MAUVE 051', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'MAUVE 051'),
    ('RG055', 'RELIANCE PLASTIC EMULSION - CARNIVAL PINK 055', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'CARNIVAL PINK 055'),
    ('RG058', 'RELIANCE PLASTIC EMULSION - RED OXIDE 058', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'RED OXIDE 058'),
    ('RG074', 'RELIANCE PLASTIC EMULSION - SAPPHIRE 074', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SAPPHIRE 074'),
    ('RG001', 'RELIANCE PLASTIC EMULSION - WHITE 001', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'WHITE 001'),
    ('RG052', 'RELIANCE PLASTIC EMULSION - BLACK 052', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'BLACK 052'),
    ('RG068', 'RELIANCE PLASTIC EMULSION - BADAMI 068', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'BADAMI 068'),
    ('RG037', 'RELIANCE PLASTIC EMULSION - HOPSACK 037', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'HOPSACK 037'),
    ('RG016', 'RELIANCE PLASTIC EMULSION - GREENISH WHITE 016', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'GREENISH WHITE 016'),
    ('RG073', 'RELIANCE PLASTIC EMULSION - VELVET TOUCH 073', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'VELVET TOUCH 073'),
    ('RG036', 'RELIANCE PLASTIC EMULSION - NEW OFF WHITE 036', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'NEW OFF WHITE 036'),
    ('RG054', 'RELIANCE PLASTIC EMULSION - SOPHISTICATION 054', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SOPHISTICATION 054'),
    ('RG033', 'RELIANCE PLASTIC EMULSION - COCKLESHELL 033', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'COCKLESHELL 033'),
    ('RG071', 'RELIANCE PLASTIC EMULSION - SWISS WHITE 071', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SWISS WHITE 071'),
    ('RG043', 'RELIANCE PLASTIC EMULSION - GREEN SMOKE 043', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'GREEN SMOKE 043'),
    ('RG067', 'RELIANCE PLASTIC EMULSION - NEW ASH WHITE 067', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'NEW ASH WHITE 067'),
    ('RG022', 'RELIANCE PLASTIC EMULSION - OLD OFF WHITE 022', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'OLD OFF WHITE 022'),
    ('RG044', 'RELIANCE PLASTIC EMULSION - APRICOT WHITE 044', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'APRICOT WHITE 044'),
    ('RG028', 'RELIANCE PLASTIC EMULSION - SAND STONE 028', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SAND STONE 028'),
    ('RG029', 'RELIANCE PLASTIC EMULSION - ROSE PINK 029', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ROSE PINK 029'),
    ('RG063', 'RELIANCE PLASTIC EMULSION - GREEN TEA 063', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'GREEN TEA 063'),
    ('RG010', 'RELIANCE PLASTIC EMULSION - TORRES BLUE 010', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'TORRES BLUE 010'),
    ('RG061', 'RELIANCE PLASTIC EMULSION - KITTEN WHITE 061', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'KITTEN WHITE 061'),
    ('RG008', 'RELIANCE PLASTIC EMULSION - APRICOT 008', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'APRICOT 008'),
    ('RG046', 'RELIANCE PLASTIC EMULSION - BEIGE WHITE 046', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'BEIGE WHITE 046'),
    ('RG026', 'RELIANCE PLASTIC EMULSION - PRINCESS BRIDE 026', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'PRINCESS BRIDE 026'),
    ('RG003', 'RELIANCE PLASTIC EMULSION - LIME FROST 003', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'LIME FROST 003'),
    ('RG011', 'RELIANCE PLASTIC EMULSION - SOFT BLUE 011', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SOFT BLUE 011'),
    ('RG065', 'RELIANCE PLASTIC EMULSION - COZY 065', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'COZY 065'),
    ('RG041', 'RELIANCE PLASTIC EMULSION - ZENTA 041', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ZENTA 041'),
    ('RG005', 'RELIANCE PLASTIC EMULSION - TEA ROSE 005', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'TEA ROSE 005'),
    ('RG045', 'RELIANCE PLASTIC EMULSION - MOON FLOWER 045', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'MOON FLOWER 045'),
    ('RG056', 'RELIANCE PLASTIC EMULSION - SPRING BLOSSOM 056', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SPRING BLOSSOM 056'),
    ('RG007', 'RELIANCE PLASTIC EMULSION - SEA BLUE 007', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SEA BLUE 007'),
    ('RG021', 'RELIANCE PLASTIC EMULSION - ROSE WHITE 021', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ROSE WHITE 021'),
    ('RG038', 'RELIANCE PLASTIC EMULSION - CAMEO 038', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'CAMEO 038'),
    ('RG039', 'RELIANCE PLASTIC EMULSION - TERRACOTTA 039', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'TERRACOTTA 039'),
    ('RG072', 'RELIANCE PLASTIC EMULSION - PINK NEW 072', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'PINK NEW 072'),
    ('RG062', 'RELIANCE PLASTIC EMULSION - WOVEN GREEN 062', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'WOVEN GREEN 062'),
    ('RG012', 'RELIANCE PLASTIC EMULSION - FIRST DAWN 012', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'FIRST DAWN 012'),
    ('RG069', 'RELIANCE PLASTIC EMULSION - WHITE ICE 069', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'WHITE ICE 069'),
    ('RG014', 'RELIANCE PLASTIC EMULSION - GOOSE WING 014', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'GOOSE WING 014'),
    ('RG064', 'RELIANCE PLASTIC EMULSION - BLOSSOM 064', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'BLOSSOM 064'),
    ('RG024', 'RELIANCE PLASTIC EMULSION - HOT SUNSET 024', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'HOT SUNSET 024'),
    ('RG032', 'RELIANCE PLASTIC EMULSION - PATINA 032', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'PATINA 032'),
    ('RG053', 'RELIANCE PLASTIC EMULSION - BLISS 053', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'BLISS 053'),
    ('RG002', 'RELIANCE PLASTIC EMULSION - CRYSTAL GREEN 002', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'CRYSTAL GREEN 002'),
    ('RG004', 'RELIANCE PLASTIC EMULSION - ASH WHITE 004', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ASH WHITE 004'),
    ('RG042', 'RELIANCE PLASTIC EMULSION - GREY WHITE 042', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'GREY WHITE 042'),
    ('RG034', 'RELIANCE PLASTIC EMULSION - LILAC 034', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'LILAC 034')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('RG060', 'RELIANCE PLASTIC EMULSION - ANTIQUE WHITE 060', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'ANTIQUE WHITE 060'),
    ('RG057', 'RELIANCE PLASTIC EMULSION - DESERT DAWN 057', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'DESERT DAWN 057'),
    ('RG070', 'RELIANCE PLASTIC EMULSION - CHANDNI 070', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'CHANDNI 070'),
    ('RG027', 'RELIANCE PLASTIC EMULSION - SWISS MISS 027', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'SWISS MISS 027'),
    ('RG006', 'RELIANCE PLASTIC EMULSION - LEAF GREEN 006', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'LEAF GREEN 006'),
    ('RG030', 'RELIANCE PLASTIC EMULSION - LAVENDER WHITE 030', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'LAVENDER WHITE 030'),
    ('RG015', 'RELIANCE PLASTIC EMULSION - WHISPER 015', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'WHISPER 015'),
    ('RG013', 'RELIANCE PLASTIC EMULSION - DREAM BOAT 013', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Gallon', 'Gallon', 'DREAM BOAT 013'),
    ('RQ013', 'RELIANCE PLASTIC EMULSION - DREAM BOAT 013', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'DREAM BOAT 013'),
    ('RQ068', 'RELIANCE PLASTIC EMULSION - BADAMI 068', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'BADAMI 068'),
    ('RQ037', 'RELIANCE PLASTIC EMULSION - HOPSACK 037', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'HOPSACK 037'),
    ('RQ016', 'RELIANCE PLASTIC EMULSION - GREENISH WHITE 016', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'GREENISH WHITE 016'),
    ('RQ073', 'RELIANCE PLASTIC EMULSION - VELVET TOUCH 073', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'VELVET TOUCH 073'),
    ('RQ036', 'RELIANCE PLASTIC EMULSION - NEW OFF WHITE 036', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'NEW OFF WHITE 036'),
    ('RQ054', 'RELIANCE PLASTIC EMULSION - SOPHISTICATION 054', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SOPHISTICATION 054'),
    ('RQ033', 'RELIANCE PLASTIC EMULSION - COCKLESHELL 033', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'COCKLESHELL 033'),
    ('RQ071', 'RELIANCE PLASTIC EMULSION - SWISS WHITE 071', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SWISS WHITE 071'),
    ('RQ043', 'RELIANCE PLASTIC EMULSION - GREEN SMOKE 043', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'GREEN SMOKE 043'),
    ('RQ067', 'RELIANCE PLASTIC EMULSION - NEW ASH WHITE 067', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'NEW ASH WHITE 067'),
    ('RQ022', 'RELIANCE PLASTIC EMULSION - OLD OFF WHITE 022', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'OLD OFF WHITE 022'),
    ('RQ044', 'RELIANCE PLASTIC EMULSION - APRICOT WHITE 044', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'APRICOT WHITE 044'),
    ('RQ028', 'RELIANCE PLASTIC EMULSION - SAND STONE 028', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SAND STONE 028'),
    ('RQ029', 'RELIANCE PLASTIC EMULSION - ROSE PINK 029', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ROSE PINK 029'),
    ('RQ063', 'RELIANCE PLASTIC EMULSION - GREEN TEA 063', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'GREEN TEA 063'),
    ('RQ010', 'RELIANCE PLASTIC EMULSION - TORRES BLUE 010', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'TORRES BLUE 010'),
    ('RQ061', 'RELIANCE PLASTIC EMULSION - KITTEN WHITE 061', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'KITTEN WHITE 061'),
    ('RQ008', 'RELIANCE PLASTIC EMULSION - APRICOT 008', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'APRICOT 008'),
    ('RQ046', 'RELIANCE PLASTIC EMULSION - BEIGE WHITE 046', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'BEIGE WHITE 046'),
    ('RQ026', 'RELIANCE PLASTIC EMULSION - PRINCESS BRIDE 026', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'PRINCESS BRIDE 026'),
    ('RQ003', 'RELIANCE PLASTIC EMULSION - LIME FROST 003', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'LIME FROST 003'),
    ('RQ011', 'RELIANCE PLASTIC EMULSION - SOFT BLUE 011', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SOFT BLUE 011'),
    ('RQ065', 'RELIANCE PLASTIC EMULSION - COZY 065', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'COZY 065'),
    ('RQ041', 'RELIANCE PLASTIC EMULSION - ZENTA 041', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ZENTA 041'),
    ('RQ005', 'RELIANCE PLASTIC EMULSION - TEA ROSE 005', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'TEA ROSE 005'),
    ('RQ045', 'RELIANCE PLASTIC EMULSION - MOON FLOWER 045', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'MOON FLOWER 045'),
    ('RQ056', 'RELIANCE PLASTIC EMULSION - SPRING BLOSSOM 056', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SPRING BLOSSOM 056'),
    ('RQ007', 'RELIANCE PLASTIC EMULSION - SEA BLUE 007', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SEA BLUE 007'),
    ('RQ021', 'RELIANCE PLASTIC EMULSION - ROSE WHITE 021', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ROSE WHITE 021'),
    ('RQ038', 'RELIANCE PLASTIC EMULSION - CAMEO 038', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'CAMEO 038'),
    ('RQ039', 'RELIANCE PLASTIC EMULSION - TERRACOTTA 039', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'TERRACOTTA 039'),
    ('RQ072', 'RELIANCE PLASTIC EMULSION - PINK 072', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'PINK 072'),
    ('RQ062', 'RELIANCE PLASTIC EMULSION - WOVEN GREEN 062', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'WOVEN GREEN 062'),
    ('RQ012', 'RELIANCE PLASTIC EMULSION - FIRST DAWN 012', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'FIRST DAWN 012'),
    ('RQ069', 'RELIANCE PLASTIC EMULSION - WHITE ICE 069', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'WHITE ICE 069'),
    ('RQ014', 'RELIANCE PLASTIC EMULSION - GOOSE WING 014', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'GOOSE WING 014'),
    ('RQ064', 'RELIANCE PLASTIC EMULSION - BLOSSOM 064', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'BLOSSOM 064'),
    ('RQ024', 'RELIANCE PLASTIC EMULSION - HOT SUNSET 024', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'HOT SUNSET 024'),
    ('RQ032', 'RELIANCE PLASTIC EMULSION - PATINA 032', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'PATINA 032'),
    ('RQ053', 'RELIANCE PLASTIC EMULSION - BLISS 053', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'BLISS 053'),
    ('RQ002', 'RELIANCE PLASTIC EMULSION - CRYSTAL GREEN 002', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'CRYSTAL GREEN 002')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('RQ004', 'RELIANCE PLASTIC EMULSION - ASH WHITE 004', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ASH WHITE 004'),
    ('RQ042', 'RELIANCE PLASTIC EMULSION - GREY WHITE 042', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'GREY WHITE 042'),
    ('RQ034', 'RELIANCE PLASTIC EMULSION - LILAC 034', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'LILAC 034'),
    ('RQ060', 'RELIANCE PLASTIC EMULSION - ANTQUE WHITE 060', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ANTQUE WHITE 060'),
    ('RQ057', 'RELIANCE PLASTIC EMULSION - DESERT DAWN 057', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'DESERT DAWN 057'),
    ('RQ070', 'RELIANCE PLASTIC EMULSION - CHANDNI 070', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'CHANDNI 070'),
    ('RQ001', 'RELIANCE PLASTIC EMULSION - WHITE 001', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'WHITE 001'),
    ('RQ052', 'RELIANCE PLASTIC EMULSION - BLACK 052', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'BLACK 052'),
    ('RQ074', 'RELIANCE PLASTIC EMULSION - SAPPHIRE 074', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SAPPHIRE 074'),
    ('RQ055', 'RELIANCE PLASTIC EMULSION - CARNIVAL PINK 055', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'CARNIVAL PINK 055'),
    ('RQ058', 'RELIANCE PLASTIC EMULSION - RED OXIDE 058', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'RED OXIDE 058'),
    ('RQ050', 'RELIANCE PLASTIC EMULSION - SWEET BLUE NEW 050', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SWEET BLUE NEW 050'),
    ('RQ051', 'RELIANCE PLASTIC EMULSION - MAUVE 051', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'MAUVE 051'),
    ('RQ049', 'RELIANCE PLASTIC EMULSION - TILE RED 049', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'TILE RED 049'),
    ('RQ048', 'RELIANCE PLASTIC EMULSION - ORANGE 048', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'ORANGE 048'),
    ('RQ047', 'RELIANCE PLASTIC EMULSION - CITRUS YELLOW 047', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'CITRUS YELLOW 047'),
    ('RQ040', 'RELIANCE PLASTIC EMULSION - JADE 040', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'JADE 040'),
    ('RQ018', 'RELIANCE PLASTIC EMULSION - POPPY018', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'POPPY018'),
    ('RQ027', 'RELIANCE PLASTIC EMULSION - SWISS MISS027', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'SWISS MISS027'),
    ('RQ006', 'RELIANCE PLASTIC EMULSION - LEAF GREEN 006', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'LEAF GREEN 006'),
    ('RQ030', 'RELIANCE PLASTIC EMULSION - LAVENDER WHITE 030', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'LAVENDER WHITE 030'),
    ('RQ015', 'RELIANCE PLASTIC EMULSION - WHISPER 015', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Quarter', 'Quarter', 'WHISPER 015'),
    ('RD067', 'RELIANCE PLASTIC EMULSION - ASH WHITE 067', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Drum', 'Drum', 'ASH WHITE 067'),
    ('RD001', 'RELIANCE PLASTIC EMULSION - WHITE 001', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Drum', 'Drum', 'WHITE 001'),
    ('RD036', 'RELIANCE PLASTIC EMULSION - OFF WHITE 036', 'Emulsion Interior', 'RELIANCE', 'Plastic Emulsion', 'Drum', 'Drum', 'OFF WHITE 036'),
    ('RG1951', 'RELIANCE WEATHER GUARD - WHITE 1951', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'WHITE 1951'),
    ('RG2010', 'RELIANCE WEATHER GUARD - CHAAR MINAAR 2010', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'CHAAR MINAAR 2010'),
    ('RG1919', 'RELIANCE WEATHER GUARD - ASH WHITE 1919', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'ASH WHITE 1919'),
    ('RG2021', 'RELIANCE WEATHER GUARD - SWEET ALMOND 2021', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SWEET ALMOND 2021'),
    ('RG2029', 'RELIANCE WEATHER GUARD - LILAC TOUCH 2029', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'LILAC TOUCH 2029'),
    ('RG1952', 'RELIANCE WEATHER GUARD - OFF WHITE 1952', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'OFF WHITE 1952'),
    ('RG1948', 'RELIANCE WEATHER GUARD - SUGAR CANE 1948', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SUGAR CANE 1948'),
    ('RG2014', 'RELIANCE WEATHER GUARD - POLISH BROWN 2014', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'POLISH BROWN 2014'),
    ('RG2028', 'RELIANCE WEATHER GUARD - CLOUD GREY 2028', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'CLOUD GREY 2028'),
    ('RG4058', 'RELIANCE WEATHER GUARD - SWEET JEWEL 4058', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SWEET JEWEL 4058'),
    ('RG2016', 'RELIANCE WEATHER GUARD - PEARL 2016', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'PEARL 2016'),
    ('RG2885', 'RELIANCE WEATHER GUARD - AUTUMN STONE 2885', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'AUTUMN STONE 2885'),
    ('RG2009', 'RELIANCE WEATHER GUARD - MULTANI TILE 2009', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'MULTANI TILE 2009'),
    ('RG2015', 'RELIANCE WEATHER GUARD - PORT LAND 2015', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'PORT LAND 2015'),
    ('RG2019', 'RELIANCE WEATHER GUARD - PINK PAVILION 2019', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'PINK PAVILION 2019'),
    ('RG2007', 'RELIANCE WEATHER GUARD - SPRING LEAF 2007', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SPRING LEAF 2007'),
    ('RG2020', 'RELIANCE WEATHER GUARD - ALMOND 2020', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'ALMOND 2020'),
    ('RG2013', 'RELIANCE WEATHER GUARD - LVORY 2013', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'LVORY 2013'),
    ('RG3148', 'RELIANCE WEATHER GUARD - TERRACOTTA 3148', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'TERRACOTTA 3148'),
    ('RG3160', 'RELIANCE WEATHER GUARD - SKY GRAY 3160', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SKY GRAY 3160'),
    ('RG1958', 'RELIANCE WEATHER GUARD - TEA ROSE 1958', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'TEA ROSE 1958'),
    ('RG2001', 'RELIANCE WEATHER GUARD - JADE 2001', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'JADE 2001'),
    ('RG2017', 'RELIANCE WEATHER GUARD - SILK WHITE 2017', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SILK WHITE 2017'),
    ('RG2087', 'RELIANCE WEATHER GUARD - BEIGE 2087', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BEIGE 2087'),
    ('RG2111', 'RELIANCE WEATHER GUARD - ROOF TILE 2111', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'ROOF TILE 2111')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('RG1959', 'RELIANCE WEATHER GUARD - GOOSE WING 1959', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'GOOSE WING 1959'),
    ('RG1949', 'RELIANCE WEATHER GUARD - SAND STONE 1949', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SAND STONE 1949'),
    ('RG2027', 'RELIANCE WEATHER GUARD - WILD CRANBERRY 2027', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'WILD CRANBERRY 2027'),
    ('RG2024', 'RELIANCE WEATHER GUARD - SILVER MIST2024', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SILVER MIST2024'),
    ('RG2685', 'RELIANCE WEATHER GUARD - CAMEO 2685', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'CAMEO 2685'),
    ('RG2876', 'RELIANCE WEATHER GUARD - TILE RED 2876', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'TILE RED 2876'),
    ('RG2018', 'RELIANCE WEATHER GUARD - CHARCOAL 2018', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'CHARCOAL 2018'),
    ('RG2026', 'RELIANCE WEATHER GUARD - DUSTY STONE 2026', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'DUSTY STONE 2026'),
    ('RG2011', 'RELIANCE WEATHER GUARD - RELIANCE YELLOW 2011', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'RELIANCE YELLOW 2011'),
    ('RG3161', 'RELIANCE WEATHER GUARD - SILK STONE 3161', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'SILK STONE 3161'),
    ('RG2004', 'RELIANCE WEATHER GUARD - BRICK STONE 2004', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BRICK STONE 2004'),
    ('RG2025', 'RELIANCE WEATHER GUARD - VOLCANO RED 2025', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'VOLCANO RED 2025'),
    ('RG2005', 'RELIANCE WEATHER GUARD - PHLOX 2005', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'PHLOX 2005'),
    ('RG2022', 'RELIANCE WEATHER GUARD - BRAZIL NUT 2022', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BRAZIL NUT 2022'),
    ('RG2012', 'RELIANCE WEATHER GUARD - FLAME ORANGE 2012', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'FLAME ORANGE 2012'),
    ('RG2687', 'RELIANCE WEATHER GUARD - HOPSACK 2687', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'HOPSACK 2687'),
    ('RG2008', 'RELIANCE WEATHER GUARD - TRADITION 2008', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'TRADITION 2008'),
    ('RG2910', 'RELIANCE WEATHER GUARD - RED OXIDE 2910', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'RED OXIDE 2910'),
    ('RG2000', 'RELIANCE WEATHER GUARD - BLUE MAGIC 2000', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BLUE MAGIC 2000'),
    ('RG2684', 'RELIANCE WEATHER GUARD - BEAVER 2684', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BEAVER 2684'),
    ('RG2002', 'RELIANCE WEATHER GUARD - BLACK 2002', 'Weather Shield Exterior', 'RELIANCE', 'Weather Guard', 'Gallon', 'Gallon', 'BLACK 2002'),
    ('RG1100', 'RELIANCE EASY COAT ENAMEL - BLACK 1100', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'BLACK 1100'),
    ('RG1118', 'RELIANCE EASY COAT ENAMEL - SMOKE GREY 1118', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'SMOKE GREY 1118'),
    ('RG1119', 'RELIANCE EASY COAT ENAMEL - COMET BLUE 1119', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'COMET BLUE 1119'),
    ('RG1120', 'RELIANCE EASY COAT ENAMEL - LIGHT BLUE 1120', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'LIGHT BLUE 1120'),
    ('RG1121', 'RELIANCE EASY COAT ENAMEL - MID BLUE 1121', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'MID BLUE 1121'),
    ('RG1126', 'RELIANCE EASY COAT ENAMEL - YELLOW 1126', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'YELLOW 1126'),
    ('RG1128', 'RELIANCE EASY COAT ENAMEL - DARK BROWN 1128', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'DARK BROWN 1128'),
    ('RG1101', 'RELIANCE EASY COAT ENAMEL - WHITE 1101', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'WHITE 1101'),
    ('RG1102', 'RELIANCE EASY COAT ENAMEL - OFF WHITE 1102', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'OFF WHITE 1102'),
    ('RG1103', 'RELIANCE EASY COAT ENAMEL - DIYAR 1103', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'DIYAR 1103'),
    ('RG1104', 'RELIANCE EASY COAT ENAMEL - CAMEO 1104', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'CAMEO 1104'),
    ('RG1105', 'RELIANCE EASY COAT ENAMEL - ASH WHITE 1105', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'ASH WHITE 1105'),
    ('RG1106', 'RELIANCE EASY COAT ENAMEL - COLOMBIAN COFFEE 1106', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'COLOMBIAN COFFEE 1106'),
    ('RG1107', 'RELIANCE EASY COAT ENAMEL - GOLDEN BROWN 1107', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'GOLDEN BROWN 1107'),
    ('RG1108', 'RELIANCE EASY COAT ENAMEL - SOFT TERRACOTTA 1108', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'SOFT TERRACOTTA 1108'),
    ('RG1109', 'RELIANCE EASY COAT ENAMEL - SANDAL 1109', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'SANDAL 1109'),
    ('RG1110', 'RELIANCE EASY COAT ENAMEL - POLISH BROWN 1110', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'POLISH BROWN 1110'),
    ('RG1113', 'RELIANCE EASY COAT ENAMEL - RED OXIDE 1113', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'RED OXIDE 1113'),
    ('RG1114', 'RELIANCE EASY COAT ENAMEL - ROSE BOUQUET 1114', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'ROSE BOUQUET 1114'),
    ('RG1115', 'RELIANCE EASY COAT ENAMEL - SIGNAL RED 1115', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'SIGNAL RED 1115'),
    ('RG1116', 'RELIANCE EASY COAT ENAMEL - ORANGE 1116', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'ORANGE 1116'),
    ('RQ1116', 'RELIANCE EASY COAT ENAMEL - ORANGE 1116', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'ORANGE 1116'),
    ('RQ1115', 'RELIANCE EASY COAT ENAMEL - SIGNAL RED 1115', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'SIGNAL RED 1115'),
    ('RQ1114', 'RELIANCE EASY COAT ENAMEL - ROSE BOUQUET 1114', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'ROSE BOUQUET 1114'),
    ('RQ1110', 'RELIANCE EASY COAT ENAMEL - POLISH BROWN 1110', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'POLISH BROWN 1110'),
    ('RQ1113', 'RELIANCE EASY COAT ENAMEL - RED OXIDE 1113', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'RED OXIDE 1113'),
    ('RQ1108', 'RELIANCE EASY COAT ENAMEL - SOFT TERRACOTTA 1108', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'SOFT TERRACOTTA 1108'),
    ('RQ1109', 'RELIANCE EASY COAT ENAMEL - SANDAL 1109', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'SANDAL 1109'),
    ('RQ1107', 'RELIANCE EASY COAT ENAMEL - GOLDEN BROWN 1107', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'GOLDEN BROWN 1107')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('RQ1106', 'RELIANCE EASY COAT ENAMEL - COLOMBIAN COFFEE 1106', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'COLOMBIAN COFFEE 1106'),
    ('RQ1105', 'RELIANCE EASY COAT ENAMEL - ASH WHITE 1105', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'ASH WHITE 1105'),
    ('RQ1104', 'RELIANCE EASY COAT ENAMEL - CAMEO 1104', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'CAMEO 1104'),
    ('RQ1103', 'RELIANCE EASY COAT ENAMEL - DIYAR 1103', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'DIYAR 1103'),
    ('RQ1126', 'RELIANCE EASY COAT ENAMEL - YELLOW 1126', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'YELLOW 1126'),
    ('RQ1128', 'RELIANCE EASY COAT ENAMEL - DARK BROWN 1128', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'DARK BROWN 1128'),
    ('RQ1101', 'RELIANCE EASY COAT ENAMEL - WHITE 1101', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'WHITE 1101'),
    ('RQ1120', 'RELIANCE EASY COAT ENAMEL - LIGHT BLUE 1120', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'LIGHT BLUE 1120'),
    ('RQ1121', 'RELIANCE EASY COAT ENAMEL - MID BLUE 1121', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'MID BLUE 1121'),
    ('RQ1119', 'RELIANCE EASY COAT ENAMEL - COMET BLUE 1119', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'COMET BLUE 1119'),
    ('RQ1118', 'RELIANCE EASY COAT ENAMEL - SMOKE GREY 1118', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'SMOKE GREY 1118'),
    ('RQ1102', 'RELIANCE EASY COAT ENAMEL - OFF WHITE 1102', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'OFF WHITE 1102'),
    ('RQ1100', 'RELIANCE EASY COAT ENAMEL - BLACK 1100', 'Synthetic Enamel', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'BLACK 1100'),
    ('RG414', 'RELIANCE EASY COAT - WALL PRIMER 414', 'Emulsion Interior', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'WALL PRIMER 414'),
    ('RG415', 'RELIANCE EASY COAT - RED OXIDE PRIMER 415', 'Emulsion Interior', 'RELIANCE', 'Easy Coat', 'Gallon', 'Gallon', 'RED OXIDE PRIMER 415'),
    ('RQ415', 'RELIANCE EASY COAT - RED OXIDE PRIMER 415', 'Emulsion Interior', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'RED OXIDE PRIMER 415'),
    ('RQ414', 'RELIANCE EASY COAT - WALL PRIMER 414', 'Emulsion Interior', 'RELIANCE', 'Easy Coat', 'Quarter', 'Quarter', 'WALL PRIMER 414'),
    ('RG24', 'RELIANCE SUPER ENAMEL - GOLDEN BROWN 24', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'GOLDEN BROWN 24'),
    ('RG023', 'RELIANCE SUPER ENAMEL - BLACK 023', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'BLACK 023'),
    ('RG025', 'RELIANCE SUPER ENAMEL - WHITE 025', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Gallon', 'Gallon', 'WHITE 025'),
    ('RQ025', 'RELIANCE SUPER ENAMEL - WHITE 025', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Quarter', 'Quarter', 'WHITE 025'),
    ('RQ24', 'RELIANCE SUPER ENAMEL - GOLDEN BROWN 24', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Quarter', 'Quarter', 'GOLDEN BROWN 24'),
    ('RQ023', 'RELIANCE SUPER ENAMEL - BLACK 023', 'Synthetic Enamel', 'RELIANCE', 'Synthetic Enamel', 'Quarter', 'Quarter', 'BLACK 023'),
    ('585', 'JINKO D/GLASS - 585 WATT', 'Accessories', 'GENERAL HARDWARE', 'Tools & Adhesives', 'PCS', 'PCS', '585 WATT'),
    ('RGQ', 'ROZZI LAC UNDER COAT', 'Primers & Putty', 'ROZZI', 'Lac Undercoat', 'Quarter', 'Quarter', NULL),
    ('ROG', 'RELIABLE RED OXIDE PRIMER', 'Primers & Putty', 'RELIABLE', 'Reliable Series', 'Gallon', 'Gallon', NULL),
    ('ROD', 'RELIABLE RED OXIDE PRIMER', 'Primers & Putty', 'RELIABLE', 'Reliable Series', 'Drum', 'Drum', NULL),
    ('RG701', 'RELIABLE ADVANCE ENAMEL - WHITE 701', 'Synthetic Enamel', 'RELIABLE', 'Reliable Series', 'Gallon', 'Gallon', 'WHITE 701'),
    ('GQ8800', 'GOBIS SILK SHEEN EMULSION - WHITE 8800', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'WHITE 8800'),
    ('GQ8801', 'GOBIS SILK SHEEN EMULSION - OFF WHITE 8801', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'OFF WHITE 8801'),
    ('GQ8826', 'GOBIS SILK SHEEN EMULSION - ASH WHITE 8826', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'ASH WHITE 8826'),
    ('GQ8870', 'GOBIS SILK SHEEN EMULSION - FLAME ORANGE 8870', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'FLAME ORANGE 8870'),
    ('GQ8868', 'GOBIS SILK SHEEN EMULSION - INDIGO 8868', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'INDIGO 8868'),
    ('GQ8817', 'GOBIS SILK SHEEN EMULSION - TILE RED 8817', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'TILE RED 8817'),
    ('GQ8815', 'GOBIS SILK SHEEN EMULSION - SPRING LEAF 8815', 'Emulsion Interior', 'GOBI''S', 'Silk Sheen (Premium)', 'Quarter', 'Quarter', 'SPRING LEAF 8815'),
    ('GQ2021', 'GOBIS GOLD WALL SEALER', 'Primers & Putty', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', NULL),
    ('GQ537', 'GOBIS EGGSHELL SPECIAL SHADE - ORANGE TROPIC 537', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'ORANGE TROPIC 537'),
    ('GQ538', 'GOBIS EGGSHELL SPECIAL SHADE - NATURAL PAPRIKA 538', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'NATURAL PAPRIKA 538'),
    ('GQ563', 'GOBIS EGGSHELL SPECIAL SHADE - POLISH BROWN 563', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'POLISH BROWN 563'),
    ('GQ582', 'GOBIS EGGSHELL SPECIAL SHADE - MARSH MERIGOLD 582', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'MARSH MERIGOLD 582'),
    ('GQ580', 'GOBIS EGGSHELL SPECIAL SHADE - SHEESHAM 580', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'SHEESHAM 580'),
    ('GQ585', 'GOBIS EGGSHELL SPECIAL SHADE - CRANBERRY 585', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'CRANBERRY 585'),
    ('GQ550', 'GOBIS EGGSHELL SPECIAL SHADE - CHILLI RED 550', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'CHILLI RED 550'),
    ('GQ586', 'GOBIS EGGSHELL SPECIAL SHADE - ALPINE RED 586', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'ALPINE RED 586'),
    ('GQ584', 'GOBIS EGGSHELL SPECIAL SHADE - RED PURPLE 584', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'RED PURPLE 584'),
    ('GQ0552', 'GOBIS EGGSHELL SPECIAL SHADE - INDIGO 0552', 'Emulsion Interior', 'GOBI''S', 'Eggshell Special Shades', 'Quarter', 'Quarter', 'INDIGO 0552'),
    ('GG600', 'GOBIS AQUEOUS MATT FINISH - WHITE 600', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE 600'),
    ('GG699', 'GOBIS AQUEOUS MATT FINISH - BLACK 699', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'BLACK 699'),
    ('GG685', 'GOBIS AQUEOUS MATT FINISH - ROSR WHITE 685', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ROSR WHITE 685'),
    ('GG647', 'GOBIS AQUEOUS MATT FINISH - APRICOT WHIE 647', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'APRICOT WHIE 647')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GG687', 'GOBIS AQUEOUS MATT FINISH - LAVENDER WHITE 687', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'LAVENDER WHITE 687'),
    ('GG612', 'GOBIS AQUEOUS MATT FINISH - THOUSAND NIGHTS 612', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'THOUSAND NIGHTS 612'),
    ('GG634', 'GOBIS AQUEOUS MATT FINISH - PUFF 634', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PUFF 634'),
    ('GG610', 'GOBIS AQUEOUS MATT FINISH - ETERNITY 610', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ETERNITY 610'),
    ('GG691', 'GOBIS AQUEOUS MATT FINISH - FRESH CUT 691', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'FRESH CUT 691'),
    ('GG613', 'GOBIS AQUEOUS MATT FINISH - GREEN SUMMIT 613', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'GREEN SUMMIT 613'),
    ('GG617', 'GOBIS AQUEOUS MATT FINISH - BLUE FLAME 617', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'BLUE FLAME 617'),
    ('GG618', 'GOBIS AQUEOUS MATT FINISH - RED PURPLE 618', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'RED PURPLE 618'),
    ('GG673', 'GOBIS AQUEOUS MATT FINISH - LIME YELLOW673', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'LIME YELLOW673'),
    ('GG632', 'GOBIS AQUEOUS MATT FINISH - AZALEA 632', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'AZALEA 632'),
    ('GG660', 'GOBIS AQUEOUS MATT FINISH - BEIGE 660', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'BEIGE 660'),
    ('GG638', 'GOBIS AQUEOUS MATT FINISH - HEALTH VIOLET 638', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'HEALTH VIOLET 638'),
    ('GG608', 'GOBIS AQUEOUS MATT FINISH - PEACH ORCHID 608', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PEACH ORCHID 608'),
    ('GG646', 'GOBIS AQUEOUS MATT FINISH - CHANDNI 646', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CHANDNI 646'),
    ('GG694', 'GOBIS AQUEOUS MATT FINISH - KITTEN WHITE 694', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'KITTEN WHITE 694'),
    ('GG616', 'GOBIS AQUEOUS MATT FINISH - SILVER TONE 616', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SILVER TONE 616'),
    ('GG686', 'GOBIS AQUEOUS MATT FINISH - PEACH GODDESS 686', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PEACH GODDESS 686'),
    ('GG670', 'GOBIS AQUEOUS MATT FINISH - PINK 670', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PINK 670'),
    ('GG645', 'GOBIS AQUEOUS MATT FINISH - CRYSTAL LIGHT 645', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CRYSTAL LIGHT 645'),
    ('GG625', 'GOBIS AQUEOUS MATT FINISH - TORRES BLUE 625', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'TORRES BLUE 625'),
    ('GG620', 'GOBIS AQUEOUS MATT FINISH - BLAZER BLUE 620', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'BLAZER BLUE 620'),
    ('GG604', 'GOBIS AQUEOUS MATT FINISH - ORCHARD LANE 604', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ORCHARD LANE 604'),
    ('GG697', 'GOBIS AQUEOUS MATT FINISH - MANGO YELLOW 697', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'MANGO YELLOW 697'),
    ('GG609', 'GOBIS AQUEOUS MATT FINISH - CLASSICAL 609', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CLASSICAL 609'),
    ('GG669', 'GOBIS AQUEOUS MATT FINISH - POLISH BROWN 669', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'POLISH BROWN 669'),
    ('GG614', 'GOBIS AQUEOUS MATT FINISH - STEEL GREY 614', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'STEEL GREY 614'),
    ('GG695', 'GOBIS AQUEOUS MATT FINISH - SNOW FIELD 695', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SNOW FIELD 695'),
    ('GG631', 'GOBIS AQUEOUS MATT FINISH - CLASSIC WHITE 631', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CLASSIC WHITE 631'),
    ('GG639', 'GOBIS AQUEOUS MATT FINISH - WHITE COMFORT 639', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE COMFORT 639'),
    ('GG633', 'GOBIS AQUEOUS MATT FINISH - PEARL WHITE 633', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PEARL WHITE 633'),
    ('GG653', 'GOBIS AQUEOUS MATT FINISH - COUNTRY ROSE 653', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'COUNTRY ROSE 653'),
    ('GG623', 'GOBIS AQUEOUS MATT FINISH - REFLECTION 623', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'REFLECTION 623'),
    ('GG602', 'GOBIS AQUEOUS MATT FINISH - ASH WHITE 602', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ASH WHITE 602'),
    ('GG635', 'GOBIS AQUEOUS MATT FINISH - COCKLESHELL 635', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'COCKLESHELL 635'),
    ('GG636', 'GOBIS AQUEOUS MATT FINISH - APRICOT 636', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'APRICOT 636'),
    ('GG671', 'GOBIS AQUEOUS MATT FINISH - PINK BONNET 671', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PINK BONNET 671'),
    ('GG692', 'GOBIS AQUEOUS MATT FINISH - LIGHT GREEN 692', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'LIGHT GREEN 692'),
    ('GG642', 'GOBIS AQUEOUS MATT FINISH - ICE TURQUOISE 642', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ICE TURQUOISE 642'),
    ('GG644', 'GOBIS AQUEOUS MATT FINISH - LILAC TIME 644', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'LILAC TIME 644'),
    ('GG698', 'GOBIS AQUEOUS MATT FINISH - MAUVE 698', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'MAUVE 698'),
    ('GG684', 'GOBIS AQUEOUS MATT FINISH - ORANGE TROPIC 684', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ORANGE TROPIC 684'),
    ('GG688', 'GOBIS AQUEOUS MATT FINISH - PINK VIOLET 688', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PINK VIOLET 688'),
    ('GG662', 'GOBIS AQUEOUS MATT FINISH - RED HAZE 662', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'RED HAZE 662'),
    ('GG674', 'GOBIS AQUEOUS MATT FINISH - WOVEN GREEN 674', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WOVEN GREEN 674'),
    ('GG672', 'GOBIS AQUEOUS MATT FINISH - COOL GREY 672', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'COOL GREY 672'),
    ('GG637', 'GOBIS AQUEOUS MATT FINISH - EGG WHITE 637', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'EGG WHITE 637'),
    ('GG607', 'GOBIS AQUEOUS MATT FINISH - COTTON BALL 607', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'COTTON BALL 607'),
    ('GG601', 'GOBIS AQUEOUS MATT FINISH - OFF WHITE 601', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'OFF WHITE 601'),
    ('GG643', 'GOBIS AQUEOUS MATT FINISH - SOUL 643', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SOUL 643'),
    ('GG690', 'GOBIS AQUEOUS MATT FINISH - ANTIQUE WHITE 690', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ANTIQUE WHITE 690')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GG603', 'GOBIS AQUEOUS MATT FINISH - TWILIGHT 603', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'TWILIGHT 603'),
    ('GG683', 'GOBIS AQUEOUS MATT FINISH - COZY 683', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'COZY 683'),
    ('GG681', 'GOBIS AQUEOUS MATT FINISH - VINTAGE 681', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'VINTAGE 681'),
    ('GG689', 'GOBIS AQUEOUS MATT FINISH - ICED PINK 689', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'ICED PINK 689'),
    ('GG621', 'GOBIS AQUEOUS MATT FINISH - SPINEY GREEN 621', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SPINEY GREEN 621'),
    ('GG676', 'GOBIS AQUEOUS MATT FINISH - SEA BLUE 676', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SEA BLUE 676'),
    ('GG611', 'GOBIS AQUEOUS MATT FINISH - PURPLE HEATHER 611', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PURPLE HEATHER 611'),
    ('GG615', 'GOBIS AQUEOUS MATT FINISH - PEACH COUNTRY 615', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PEACH COUNTRY 615'),
    ('GG630', 'GOBIS AQUEOUS MATT FINISH - CARNIVAL PINK 630', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CARNIVAL PINK 630'),
    ('GG682', 'GOBIS AQUEOUS MATT FINISH - TILE RED 682', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'TILE RED 682'),
    ('GG665', 'GOBIS AQUEOUS MATT FINISH - NATIRAL PAPRIKA 665', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'NATIRAL PAPRIKA 665'),
    ('GG675', 'GOBIS AQUEOUS MATT FINISH - HONEY WHITE 675', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'HONEY WHITE 675'),
    ('GG658', 'GOBIS AQUEOUS MATT FINISH - PLATINUM 658', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PLATINUM 658'),
    ('GG680', 'GOBIS AQUEOUS MATT FINISH - CREAMY ALMOND 680', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'CREAMY ALMOND 680'),
    ('GG651', 'GOBIS AQUEOUS MATT FINISH - WHITE PEPPER 651', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE PEPPER 651'),
    ('GG659', 'GOBIS AQUEOUS MATT FINISH - MOONLIGHT GREY 659', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'MOONLIGHT GREY 659'),
    ('GG648', 'GOBIS AQUEOUS MATT FINISH - TILE RED 648', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'TILE RED 648'),
    ('GG654', 'GOBIS AQUEOUS MATT FINISH - MEADOW DAY 654', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'MEADOW DAY 654'),
    ('GG679', 'GOBIS AQUEOUS MATT FINISH - MOON STONE 679', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'MOON STONE 679'),
    ('GG650', 'GOBIS AQUEOUS MATT FINISH - WHITE FROST 650', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE FROST 650'),
    ('GG677', 'GOBIS AQUEOUS MATT FINISH - WHITE MIST 677', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE MIST 677'),
    ('GG649', 'GOBIS AQUEOUS MATT FINISH - OFF WHITE 649', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'OFF WHITE 649'),
    ('GG657', 'GOBIS AQUEOUS MATT FINISH - SILVER SCREEN 657', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SILVER SCREEN 657'),
    ('GG652', 'GOBIS AQUEOUS MATT FINISH - SOFT WHITE 652', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'SOFT WHITE 652'),
    ('GG666', 'GOBIS AQUEOUS MATT FINISH - PEARL 666', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'PEARL 666'),
    ('GG656', 'GOBIS AQUEOUS MATT FINISH - WINGED SLATE 656', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WINGED SLATE 656'),
    ('GG655', 'GOBIS AQUEOUS MATT FINISH - FRESH SCENT 655', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'FRESH SCENT 655'),
    ('GG678', 'GOBIS AQUEOUS MATT FINISH - IVORY PEARL 678', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'IVORY PEARL 678'),
    ('GG668', 'GOBIS AQUEOUS MATT FINISH - WHITE RAIN 668', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'WHITE RAIN 668'),
    ('GG664', 'GOBIS AQUEOUS MATT FINISH - OCEAN DREAM 664', 'Synthetic Enamel', 'GOBI''S', 'Aqueous Matt (Premium)', 'Gallon', 'Gallon', 'OCEAN DREAM 664'),
    ('GQ400', 'GOBIS GOLD AQUEOUS MATT - WHITE 400', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'WHITE 400'),
    ('GQ442', 'GOBIS GOLD AQUEOUS MATT - BLACK 442', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'BLACK 442'),
    ('GQ407', 'GOBIS GOLD AQUEOUS MATT - PEPPERMINT 407', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PEPPERMINT 407'),
    ('GQ411', 'GOBIS GOLD AQUEOUS MATT - CAMEO 411', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'CAMEO 411'),
    ('GQ415', 'GOBIS GOLD AQUEOUS MATT - CRESCENT MOON 415', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'CRESCENT MOON 415'),
    ('GQ417', 'GOBIS GOLD AQUEOUS MATT - COCKLESHELL 417', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'COCKLESHELL 417'),
    ('GQ419', 'GOBIS GOLD AQUEOUS MATT - LILAC TIME 419', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'LILAC TIME 419'),
    ('GQ423', 'GOBIS GOLD AQUEOUS MATT - ETERNITY 423', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'ETERNITY 423'),
    ('GQ427', 'GOBIS GOLD AQUEOUS MATT - VINTAGE 427', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'VINTAGE 427'),
    ('GQ431', 'GOBIS GOLD AQUEOUS MATT - LIME YELLOW 431', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'LIME YELLOW 431'),
    ('GQ408', 'GOBIS GOLD AQUEOUS MATT - VANILLA LATTE 408', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'VANILLA LATTE 408'),
    ('GQ412', 'GOBIS GOLD AQUEOUS MATT - SOFT PEACH 412', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'SOFT PEACH 412'),
    ('GQ416', 'GOBIS GOLD AQUEOUS MATT - LAVENDER WHITE 416', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'LAVENDER WHITE 416'),
    ('GQ418', 'GOBIS GOLD AQUEOUS MATT - MAGNOLIA 418', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'MAGNOLIA 418'),
    ('GQ420', 'GOBIS GOLD AQUEOUS MATT - VINTAGE VIOLET 420', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'VINTAGE VIOLET 420'),
    ('GQ424', 'GOBIS GOLD AQUEOUS MATT - RED HAZE 424', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'RED HAZE 424'),
    ('GQ428', 'GOBIS GOLD AQUEOUS MATT - PINK 428', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PINK 428'),
    ('GQ432', 'GOBIS GOLD AQUEOUS MATT - MANGO YELLOW 432', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'MANGO YELLOW 432'),
    ('GQ401', 'GOBIS GOLD AQUEOUS MATT - OFF WHITE 401', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'OFF WHITE 401'),
    ('GQ403', 'GOBIS GOLD AQUEOUS MATT - ANTIQUE WHITE 403', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'ANTIQUE WHITE 403')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GQ405', 'GOBIS GOLD AQUEOUS MATT - ASH WHITE 405', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'ASH WHITE 405'),
    ('GQ409', 'GOBIS GOLD AQUEOUS MATT - SPRING AIR 409', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'SPRING AIR 409'),
    ('GQ413', 'GOBIS GOLD AQUEOUS MATT - TIE RED 413', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'TIE RED 413'),
    ('GQ421', 'GOBIS GOLD AQUEOUS MATT - PINK VIOLET 421', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PINK VIOLET 421'),
    ('GQ425', 'GOBIS GOLD AQUEOUS MATT - STEEL GREY 425', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'STEEL GREY 425'),
    ('GQ429', 'GOBIS GOLD AQUEOUS MATT - ICED PINK 429', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'ICED PINK 429'),
    ('GQ433', 'GOBIS GOLD AQUEOUS MATT - TRIPLE CROWN 433', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'TRIPLE CROWN 433'),
    ('GQ435', 'GOBIS GOLD AQUEOUS MATT - FRESH CUT 435', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'FRESH CUT 435'),
    ('GQ437', 'GOBIS GOLD AQUEOUS MATT - TWISTED MINT 437', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'TWISTED MINT 437'),
    ('GQ439', 'GOBIS GOLD AQUEOUS MATT - SEA BLUE 439', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'SEA BLUE 439'),
    ('GQ441', 'GOBIS GOLD AQUEOUS MATT - MAUVE 441', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'MAUVE 441'),
    ('GQ402', 'GOBIS GOLD AQUEOUS MATT - PEARL WHITE 402', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PEARL WHITE 402'),
    ('GQ404', 'GOBIS GOLD AQUEOUS MATT - THOUSAND NIGHTS 404', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'THOUSAND NIGHTS 404'),
    ('GQ406', 'GOBIS GOLD AQUEOUS MATT - SILVER TONE 406', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'SILVER TONE 406'),
    ('GQ410', 'GOBIS GOLD AQUEOUS MATT - SAND 410', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'SAND 410'),
    ('GQ414', 'GOBIS GOLD AQUEOUS MATT - DEEP SPICE 414', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'DEEP SPICE 414'),
    ('GQ422', 'GOBIS GOLD AQUEOUS MATT - PURPLE HEATHER 422', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PURPLE HEATHER 422'),
    ('GQ426', 'GOBIS GOLD AQUEOUS MATT - RED PURPLE 426', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'RED PURPLE 426'),
    ('GQ430', 'GOBIS GOLD AQUEOUS MATT - PUFF 430', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PUFF 430'),
    ('GQ434', 'GOBIS GOLD AQUEOUS MATT - PEACH COUNTRY 434', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PEACH COUNTRY 434'),
    ('GQ436', 'GOBIS GOLD AQUEOUS MATT - LIGHT GREEN 436', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'LIGHT GREEN 436'),
    ('GQ438', 'GOBIS GOLD AQUEOUS MATT - LEAF GREEN 438', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'LEAF GREEN 438'),
    ('GQ440', 'GOBIS GOLD AQUEOUS MATT - COOL BLUE 440', 'Synthetic Enamel', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'COOL BLUE 440'),
    ('GQ1466', 'GOBIS GOLD SPECIAL SHADES EMULSION - PARASOL 1466', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PARASOL 1466'),
    ('GQ1433', 'GOBIS GOLD SPECIAL SHADES EMULSION - APRICOT 1433', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'APRICOT 1433'),
    ('GQ1465', 'GOBIS GOLD SPECIAL SHADES EMULSION - TERRACOTTA 1465', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'TERRACOTTA 1465'),
    ('GQ1428', 'GOBIS GOLD SPECIAL SHADES EMULSION - PINK VIOLET 1428', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PINK VIOLET 1428'),
    ('GQ1414', 'GOBIS GOLD SPECIAL SHADES EMULSION - FRESH ORANGE 1414', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'FRESH ORANGE 1414'),
    ('GQ1421', 'GOBIS GOLD SPECIAL SHADES EMULSION - CHOCLATE 1421', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'CHOCLATE 1421'),
    ('GQ1429', 'GOBIS GOLD SPECIAL SHADES EMULSION - CARNIVAL PINK 1429', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'CARNIVAL PINK 1429'),
    ('GQ1420', 'GOBIS GOLD SPECIAL SHADES EMULSION - BRIGHT RED 1420', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'BRIGHT RED 1420'),
    ('GQ1462', 'GOBIS GOLD SPECIAL SHADES EMULSION - PURPLE 1462', 'Emulsion Interior', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', 'PURPLE 1462'),
    ('GG3100', 'GOBIS ARMOR WALL EMULSION - WHITE 3100', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE 3100'),
    ('GG3101', 'GOBIS ARMOR WALL EMULSION - OFF WHITE 3101', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'OFF WHITE 3101'),
    ('GG3105', 'GOBIS ARMOR WALL EMULSION - PERAL WHITE 3105', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PERAL WHITE 3105'),
    ('GG3108', 'GOBIS ARMOR WALL EMULSION - WHITE PAPPER 3108', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE PAPPER 3108'),
    ('GG3147', 'GOBIS ARMOR WALL EMULSION - CHERRY BLOSSOM PINK 3147', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CHERRY BLOSSOM PINK 3147'),
    ('GG3138', 'GOBIS ARMOR WALL EMULSION - ICE AGE 3138', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ICE AGE 3138'),
    ('GG3111', 'GOBIS ARMOR WALL EMULSION - KITTEN WHITE 3111', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'KITTEN WHITE 3111'),
    ('GG3155', 'GOBIS ARMOR WALL EMULSION - PEACH 3155', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PEACH 3155'),
    ('GG3109', 'GOBIS ARMOR WALL EMULSION - ANTIQUE WHITE 3109', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ANTIQUE WHITE 3109'),
    ('GG3119', 'GOBIS ARMOR WALL EMULSION - SWISS MISS 3119', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SWISS MISS 3119'),
    ('GG3159', 'GOBIS ARMOR WALL EMULSION - BLUE 3159', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BLUE 3159'),
    ('GG3107', 'GOBIS ARMOR WALL EMULSION - CHOCLESHELL 3107', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CHOCLESHELL 3107'),
    ('GG3112', 'GOBIS ARMOR WALL EMULSION - PEACH GODDESS 3112', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PEACH GODDESS 3112'),
    ('GG3158', 'GOBIS ARMOR WALL EMULSION - ASH WHITE 3158', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ASH WHITE 3158'),
    ('GG3127', 'GOBIS ARMOR WALL EMULSION - PASTEL GREEN 3127', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PASTEL GREEN 3127'),
    ('GG3114', 'GOBIS ARMOR WALL EMULSION - FRESH ORANGE 3114', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'FRESH ORANGE 3114'),
    ('GG3110', 'GOBIS ARMOR WALL EMULSION - HONEY MILK 3110', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'HONEY MILK 3110'),
    ('GG3173', 'GOBIS ARMOR WALL EMULSION - CAMEO 3173', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CAMEO 3173')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GG3164', 'GOBIS ARMOR WALL EMULSION - ICE GREY 3164', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ICE GREY 3164'),
    ('GG3122', 'GOBIS ARMOR WALL EMULSION - HEALTH VIOLET 3122', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'HEALTH VIOLET 3122'),
    ('GG3168', 'GOBIS ARMOR WALL EMULSION - DOVE GREY 3168', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DOVE GREY 3168'),
    ('GG3170', 'GOBIS ARMOR WALL EMULSION - SAND STONE 3170', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SAND STONE 3170'),
    ('GG3113', 'GOBIS ARMOR WALL EMULSION - DESERT DAWN 3113', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DESERT DAWN 3113'),
    ('GG3134', 'GOBIS ARMOR WALL EMULSION - WHISPER 3134', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHISPER 3134'),
    ('GG3166', 'GOBIS ARMOR WALL EMULSION - PARASOL 3166', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PARASOL 3166'),
    ('GG3131', 'GOBIS ARMOR WALL EMULSION - WINTER WILLOW 3131', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WINTER WILLOW 3131'),
    ('GG3171', 'GOBIS ARMOR WALL EMULSION - ZEPHYR 3171', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ZEPHYR 3171'),
    ('GG3167', 'GOBIS ARMOR WALL EMULSION - TEA ROSE 3167', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TEA ROSE 3167'),
    ('GG3135', 'GOBIS ARMOR WALL EMULSION - GOOSE WING 3135', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'GOOSE WING 3135'),
    ('GG3128', 'GOBIS ARMOR WALL EMULSION - PINK VIOLET 3128', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PINK VIOLET 3128'),
    ('GG3121', 'GOBIS ARMOR WALL EMULSION - CHOCLATE 3121', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CHOCLATE 3121'),
    ('GQ3100', 'GOBIS ARMOR WALL EMULSION - WHITE 3100', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WHITE 3100'),
    ('GQ3101', 'GOBIS ARMOR WALL EMULSION - OFF WHITE 3101', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'OFF WHITE 3101'),
    ('GQ3105', 'GOBIS ARMOR WALL EMULSION - PERAL WHITE 3105', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PERAL WHITE 3105'),
    ('GQ3108', 'GOBIS ARMOR WALL EMULSION - WHITE PEPPER 3108', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WHITE PEPPER 3108'),
    ('GQ3147', 'GOBIS ARMOR WALL EMULSION - CHERRY BLOSSOM PINK 3147', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CHERRY BLOSSOM PINK 3147'),
    ('GQ3138', 'GOBIS ARMOR WALL EMULSION - ICE AGE 3138', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ICE AGE 3138'),
    ('GQ3111', 'GOBIS ARMOR WALL EMULSION - KITTEN WHITE 3111', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'KITTEN WHITE 3111'),
    ('GQ3155', 'GOBIS ARMOR WALL EMULSION - PEACH 3155', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PEACH 3155'),
    ('GQ3109', 'GOBIS ARMOR WALL EMULSION - ANTIQUE WHITE 3109', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ANTIQUE WHITE 3109'),
    ('GQ3119', 'GOBIS ARMOR WALL EMULSION - SWISS MISS 3119', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SWISS MISS 3119'),
    ('GQ3159', 'GOBIS ARMOR WALL EMULSION - BLUE 3159', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'BLUE 3159'),
    ('GQ3107', 'GOBIS ARMOR WALL EMULSION - COCKLESHELL 3107', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'COCKLESHELL 3107'),
    ('GQ3112', 'GOBIS ARMOR WALL EMULSION - PEACH GODDESS 3112', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PEACH GODDESS 3112'),
    ('GQ3158', 'GOBIS ARMOR WALL EMULSION - ASH WHITE 3158', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ASH WHITE 3158'),
    ('GQ3127', 'GOBIS ARMOR WALL EMULSION - PASTEL GREEN 3127', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PASTEL GREEN 3127'),
    ('GQ3114', 'GOBIS ARMOR WALL EMULSION - FRESH ORANGE 3114', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'FRESH ORANGE 3114'),
    ('GQ3110', 'GOBIS ARMOR WALL EMULSION - HONEY MILK 3110', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'HONEY MILK 3110'),
    ('GQ3173', 'GOBIS ARMOR WALL EMULSION - CAMEO 3173', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CAMEO 3173'),
    ('GQ3164', 'GOBIS ARMOR WALL EMULSION - ICE GREY 3164', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ICE GREY 3164'),
    ('GQ3122', 'GOBIS ARMOR WALL EMULSION - HEALTH VIOLET 3122', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'HEALTH VIOLET 3122'),
    ('GQ3168', 'GOBIS ARMOR WALL EMULSION - DOVE GREY 3168', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'DOVE GREY 3168'),
    ('GQ3170', 'GOBIS ARMOR WALL EMULSION - SAND STONE 3170', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SAND STONE 3170'),
    ('GQ3113', 'GOBIS ARMOR WALL EMULSION - DESERT DAWN 3113', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'DESERT DAWN 3113'),
    ('GQ3134', 'GOBIS ARMOR WALL EMULSION - WHISPER 3134', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WHISPER 3134'),
    ('GQ3166', 'GOBIS ARMOR WALL EMULSION - PARASOL 3166', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PARASOL 3166'),
    ('GQ3131', 'GOBIS ARMOR WALL EMULSION - WINTER WILLOW 3131', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WINTER WILLOW 3131'),
    ('GQ3171', 'GOBIS ARMOR WALL EMULSION - ZEPHYR 3171', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ZEPHYR 3171'),
    ('GQ3167', 'GOBIS ARMOR WALL EMULSION - TEA ROSE 3167', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'TEA ROSE 3167'),
    ('GQ3135', 'GOBIS ARMOR WALL EMULSION - GOOSE WING 3135', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'GOOSE WING 3135'),
    ('GQ3128', 'GOBIS ARMOR WALL EMULSION - PINK VIOLET 3128', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PINK VIOLET 3128'),
    ('GQ3121', 'GOBIS ARMOR WALL EMULSION - CHOCLATE 3121', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CHOCLATE 3121'),
    ('0', 'GOBIS ARMOR WALL EMULSION', 'Emulsion Interior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', NULL),
    ('GG300', 'GOBIS ARMOR AQUEOUS MATT - WHITE 300', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE 300'),
    ('GG339', 'GOBIS ARMOR AQUEOUS MATT - WHITE COMFORT 339', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE COMFORT 339'),
    ('GG331', 'GOBIS ARMOR AQUEOUS MATT - CLASSIC WHITE 331', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CLASSIC WHITE 331'),
    ('GG312', 'GOBIS ARMOR AQUEOUS MATT - THOUSAND NIGHTS 312', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'THOUSAND NIGHTS 312'),
    ('GG320', 'GOBIS ARMOR AQUEOUS MATT - BLAZER BLUE 320', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BLAZER BLUE 320')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GG314', 'GOBIS ARMOR AQUEOUS MATT - STEEL GREY 314', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'STEEL GREY 314'),
    ('GG301', 'GOBIS ARMOR AQUEOUS MATT - OFF WHITE 301', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'OFF WHITE 301'),
    ('GG302', 'GOBIS ARMOR AQUEOUS MATT - ASH WHITE 302', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ASH WHITE 302'),
    ('GG316', 'GOBIS ARMOR AQUEOUS MATT - SILVER TONE 316', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SILVER TONE 316'),
    ('GG389', 'GOBIS ARMOR AQUEOUS MATT - ICED PINK 389', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ICED PINK 389'),
    ('GG325', 'GOBIS ARMOR AQUEOUS MATT - TORRES BLUE 325', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TORRES BLUE 325'),
    ('GG333', 'GOBIS ARMOR AQUEOUS MATT - PEARL WHITE 333', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PEARL WHITE 333'),
    ('GG387', 'GOBIS ARMOR AQUEOUS MATT - LAVENDER WHITE 387', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'LAVENDER WHITE 387'),
    ('GG392', 'GOBIS ARMOR AQUEOUS MATT - LIGHT GREEN 392', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'LIGHT GREEN 392'),
    ('GG315', 'GOBIS ARMOR AQUEOUS MATT - PEACH COUNTRY 315', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PEACH COUNTRY 315'),
    ('GG376', 'GOBIS ARMOR AQUEOUS MATT - SEA BLUE 376', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SEA BLUE 376'),
    ('GG335', 'GOBIS ARMOR AQUEOUS MATT - COCKLESHELL 335', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'COCKLESHELL 335'),
    ('GG385', 'GOBIS ARMOR AQUEOUS MATT - ROSE WHITE 385', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ROSE WHITE 385'),
    ('GG373', 'GOBIS ARMOR AQUEOUS MATT - LIME YELLOW 373', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'LIME YELLOW 373'),
    ('GG388', 'GOBIS ARMOR AQUEOUS MATT - PINK VIOLET 388', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PINK VIOLET 388'),
    ('GG303', 'GOBIS ARMOR AQUEOUS MATT - VINTAGE VIOLET 303', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'VINTAGE VIOLET 303'),
    ('GG390', 'GOBIS ARMOR AQUEOUS MATT - ANTIQUE WHITE 390', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ANTIQUE WHITE 390'),
    ('GG381', 'GOBIS ARMOR AQUEOUS MATT - VINTAGE 381', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'VINTAGE 381'),
    ('GG386', 'GOBIS ARMOR AQUEOUS MATT - PEACH GODDESS 386', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PEACH GODDESS 386'),
    ('GG369', 'GOBIS ARMOR AQUEOUS MATT - POLISH BROWN 369', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'POLISH BROWN 369'),
    ('GG330', 'GOBIS ARMOR AQUEOUS MATT - CARNIVAL PINK 330', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CARNIVAL PINK 330'),
    ('GG394', 'GOBIS ARMOR AQUEOUS MATT - KITTEN WHITE 394', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'KITTEN WHITE 394'),
    ('GG310', 'GOBIS ARMOR AQUEOUS MATT - ETERNITY 310', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ETERNITY 310'),
    ('GG360', 'GOBIS ARMOR AQUEOUS MATT - BEIGE 360', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BEIGE 360'),
    ('GG304', 'GOBIS ARMOR AQUEOUS MATT - TRIPLE CROWN 304', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TRIPLE CROWN 304'),
    ('GG382', 'GOBIS ARMOR AQUEOUS MATT - TILE RED 382', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TILE RED 382'),
    ('GG2301', 'GOBIS ARMOR HIGH GLOSS ENAMEL - WHITE 2301', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE 2301'),
    ('GG2345', 'GOBIS ARMOR HIGH GLOSS ENAMEL - BLACK 2345', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BLACK 2345'),
    ('GG2302', 'GOBIS ARMOR HIGH GLOSS ENAMEL - OFF WHITE 2302', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'OFF WHITE 2302'),
    ('GG2358', 'GOBIS ARMOR HIGH GLOSS ENAMEL - DARK GREY 2358', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DARK GREY 2358'),
    ('GG2324', 'GOBIS ARMOR HIGH GLOSS ENAMEL - BEIGE 2324', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BEIGE 2324'),
    ('GG2330', 'GOBIS ARMOR HIGH GLOSS ENAMEL - GOLDEN BROWN 2330', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'GOLDEN BROWN 2330'),
    ('GG2356', 'GOBIS ARMOR HIGH GLOSS ENAMEL - WHITE GREEN 2356', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE GREEN 2356'),
    ('GG2315', 'GOBIS ARMOR HIGH GLOSS ENAMEL - VIVID BLUE 2315', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'VIVID BLUE 2315'),
    ('GG2391', 'GOBIS ARMOR HIGH GLOSS ENAMEL - REFLECTION 2391', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'REFLECTION 2391'),
    ('GG2310', 'GOBIS ARMOR HIGH GLOSS ENAMEL - LEMON 2310', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'LEMON 2310'),
    ('GG2318', 'GOBIS ARMOR HIGH GLOSS ENAMEL - SHEESHAM 2318', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SHEESHAM 2318'),
    ('GG2309', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ORANGE 2309', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ORANGE 2309'),
    ('GG2325', 'GOBIS ARMOR HIGH GLOSS ENAMEL - SEA GREEN 2325', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SEA GREEN 2325'),
    ('GG2355', 'GOBIS ARMOR HIGH GLOSS ENAMEL - MAUVE 2355', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'MAUVE 2355'),
    ('GG2393', 'GOBIS ARMOR HIGH GLOSS ENAMEL - THOUSAND NIGHTS 2393', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'THOUSAND NIGHTS 2393'),
    ('GG2313', 'GOBIS ARMOR HIGH GLOSS ENAMEL - GOLDEN YELLOW 2313', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'GOLDEN YELLOW 2313'),
    ('GG2328', 'GOBIS ARMOR HIGH GLOSS ENAMEL - CORIANDER 2328', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CORIANDER 2328'),
    ('GG2316', 'GOBIS ARMOR HIGH GLOSS ENAMEL - SIGNAL RED 2316', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SIGNAL RED 2316'),
    ('GG2357', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ADAMS GREEN 2357', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ADAMS GREEN 2357'),
    ('GG2321', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ROYAL BLUE 2321', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ROYAL BLUE 2321'),
    ('GG2317', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ASH WHITE 2317', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ASH WHITE 2317'),
    ('GG2346', 'GOBIS ARMOR HIGH GLOSS ENAMEL - EARLY DAWN 2346', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'EARLY DAWN 2346'),
    ('GG2351', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ROSE PINK 2351', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ROSE PINK 2351'),
    ('GG2311', 'GOBIS ARMOR HIGH GLOSS ENAMEL - RED OXIDE 2311', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'RED OXIDE 2311')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GG2322', 'GOBIS ARMOR HIGH GLOSS ENAMEL - ROYAL GREEN 2322', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ROYAL GREEN 2322'),
    ('GG2326', 'GOBIS ARMOR HIGH GLOSS ENAMEL - PUMICE 2326', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PUMICE 2326'),
    ('GG2347', 'GOBIS ARMOR HIGH GLOSS ENAMEL - CAMEO 2347', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CAMEO 2347'),
    ('GG2348', 'GOBIS ARMOR HIGH GLOSS ENAMEL - SOFT TERRACOTTA 2348', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SOFT TERRACOTTA 2348'),
    ('GG2350', 'GOBIS ARMOR HIGH GLOSS ENAMEL - BROWN 2350', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BROWN 2350'),
    ('GG2354', 'GOBIS ARMOR HIGH GLOSS ENAMEL - CORN FLOWER 2354', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CORN FLOWER 2354'),
    ('GG2323', 'GOBIS ARMOR HIGH GLOSS ENAMEL - SMOKE GREY 2323', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SMOKE GREY 2323'),
    ('GG2320', 'GOBIS ARMOR HIGH GLOSS ENAMEL - DIYAR 2320', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DIYAR 2320'),
    ('GG2349', 'GOBIS ARMOR HIGH GLOSS ENAMEL - POLISH BROWN 2349', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'POLISH BROWN 2349'),
    ('GG2312', 'GOBIS ARMOR HIGH GLOSS ENAMEL - DARK BROWN 2312', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DARK BROWN 2312'),
    ('GG2314', 'GOBIS ARMOR HIGH GLOSS ENAMEL - LIGHT BLUE 2314', 'Synthetic Enamel', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'LIGHT BLUE 2314'),
    ('GG4101', 'GOBIS ARMOR WEATHER GUARD - WHITE 4101', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WHITE 4101'),
    ('GG4116', 'GOBIS ARMOR WEATHER GUARD - OFF WHITE 4116', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'OFF WHITE 4116'),
    ('GG4167', 'GOBIS ARMOR WEATHER GUARD - PORCELAIN PEACH 4167', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'PORCELAIN PEACH 4167'),
    ('GG4102', 'GOBIS ARMOR WEATHER GUARD - ASH WHITE 4102', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ASH WHITE 4102'),
    ('GG4179', 'GOBIS ARMOR WEATHER GUARD - SKY GREY 4179', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SKY GREY 4179'),
    ('GG4119', 'GOBIS ARMOR WEATHER GUARD - ROGUE PINK 4119', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'ROGUE PINK 4119'),
    ('GG4103', 'GOBIS ARMOR WEATHER GUARD - AUTUMN STONE 4103', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'AUTUMN STONE 4103'),
    ('GG4169', 'GOBIS ARMOR WEATHER GUARD - DESERT DAWN 4169', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DESERT DAWN 4169'),
    ('GG4173', 'GOBIS ARMOR WEATHER GUARD - GREY WHITE 4173', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'GREY WHITE 4173'),
    ('GG4180', 'GOBIS ARMOR WEATHER GUARD - WIREWORK GREY 4180', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'WIREWORK GREY 4180'),
    ('GG4158', 'GOBIS ARMOR WEATHER GUARD - POLISH BROWN 4158', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'POLISH BROWN 4158'),
    ('GG4124', 'GOBIS ARMOR WEATHER GUARD - SUGAR CANE 4124', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SUGAR CANE 4124'),
    ('GG4106', 'GOBIS ARMOR WEATHER GUARD - BEIGE 4106', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BEIGE 4106'),
    ('GG4123', 'GOBIS ARMOR WEATHER GUARD - STONE GREY 4123', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'STONE GREY 4123'),
    ('GG4160', 'GOBIS ARMOR WEATHER GUARD - GOOSE WING 4160', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'GOOSE WING 4160'),
    ('GG4127', 'GOBIS ARMOR WEATHER GUARD - TERRACOTTA 4127', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TERRACOTTA 4127'),
    ('GG4107', 'GOBIS ARMOR WEATHER GUARD - CAMEO 4107', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CAMEO 4107'),
    ('GG4178', 'GOBIS ARMOR WEATHER GUARD - CAMEL COAT 4178', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CAMEL COAT 4178'),
    ('GG4174', 'GOBIS ARMOR WEATHER GUARD - POTTERY CLAY 4174', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'POTTERY CLAY 4174'),
    ('GG4164', 'GOBIS ARMOR WEATHER GUARD - EVENING SHADOW 4164', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'EVENING SHADOW 4164'),
    ('GG4126', 'GOBIS ARMOR WEATHER GUARD - TEA ROSE 4126', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'TEA ROSE 4126'),
    ('GG4125', 'GOBIS ARMOR WEATHER GUARD - SWEET PEACH 4125', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SWEET PEACH 4125'),
    ('GG4176', 'GOBIS ARMOR WEATHER GUARD - CINNAMON 4176', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CINNAMON 4176'),
    ('GG4177', 'GOBIS ARMOR WEATHER GUARD - DOVE GREY 4177', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'DOVE GREY 4177'),
    ('GG4161', 'GOBIS ARMOR WEATHER GUARD - CHARCOAL 4161', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'CHARCOAL 4161'),
    ('GG4159', 'GOBIS ARMOR WEATHER GUARD - SHARA SAND 4159', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SHARA SAND 4159'),
    ('GG4155', 'GOBIS ARMOR WEATHER GUARD - SWEET JEWEL 4155', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SWEET JEWEL 4155'),
    ('GG4156', 'GOBIS ARMOR WEATHER GUARD - RED HAZE 4156', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'RED HAZE 4156'),
    ('GG4121', 'GOBIS ARMOR WEATHER GUARD - SAND STONE 4121', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'SAND STONE 4121'),
    ('GG4118', 'GOBIS ARMOR WEATHER GUARD - AUTUMN RED 4118', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'AUTUMN RED 4118'),
    ('GG4184', 'GOBIS ARMOR WEATHER GUARD - BEAVER 4184', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', 'BEAVER 4184'),
    ('GQ4101', 'GOBIS ARMOR WEATHER GUARD - WHITE 4101', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WHITE 4101'),
    ('GQ4116', 'GOBIS ARMOR WEATHER GUARD - OFF WHITE 4116', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'OFF WHITE 4116'),
    ('GQ4167', 'GOBIS ARMOR WEATHER GUARD - PORCELAIN PEACH 4167', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'PORCELAIN PEACH 4167'),
    ('GQ4102', 'GOBIS ARMOR WEATHER GUARD - ASH WHITE 4102', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ASH WHITE 4102'),
    ('GQ4179', 'GOBIS ARMOR WEATHER GUARD - SKY GREY 4179', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SKY GREY 4179'),
    ('GQ4119', 'GOBIS ARMOR WEATHER GUARD - ROGUE PINK 4119', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'ROGUE PINK 4119'),
    ('GQ4103', 'GOBIS ARMOR WEATHER GUARD - AUTUMN STONE 4103', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'AUTUMN STONE 4103'),
    ('GQ4169', 'GOBIS ARMOR WEATHER GUARD - DESERT DAWN 4169', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'DESERT DAWN 4169')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('GQ4173', 'GOBIS ARMOR WEATHER GUARD - GREAY WHITE 4173', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'GREAY WHITE 4173'),
    ('GQ4180', 'GOBIS ARMOR WEATHER GUARD - WIREWORK GREY 4180', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'WIREWORK GREY 4180'),
    ('GQ4158', 'GOBIS ARMOR WEATHER GUARD - POLISH BROWN 4158', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'POLISH BROWN 4158'),
    ('GQ4124', 'GOBIS ARMOR WEATHER GUARD - SUGAR CAN 4124', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SUGAR CAN 4124'),
    ('GQ4106', 'GOBIS ARMOR WEATHER GUARD - BEIGE 4106', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'BEIGE 4106'),
    ('GQ4123', 'GOBIS ARMOR WEATHER GUARD - STONE GREY 4123', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'STONE GREY 4123'),
    ('GQ4160', 'GOBIS ARMOR WEATHER GUARD - GOOSE WING 4160', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'GOOSE WING 4160'),
    ('GQ4127', 'GOBIS ARMOR WEATHER GUARD - TERRACOTTA 4127', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'TERRACOTTA 4127'),
    ('GQ4107', 'GOBIS ARMOR WEATHER GUARD - CAMEO 4107', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CAMEO 4107'),
    ('GQ4178', 'GOBIS ARMOR WEATHER GUARD - CAMEL COAT 4178', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CAMEL COAT 4178'),
    ('GQ4174', 'GOBIS ARMOR WEATHER GUARD - POTTERY CLAY 4174', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'POTTERY CLAY 4174'),
    ('GQ4164', 'GOBIS ARMOR WEATHER GUARD - EVENING SHADOW 4164', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'EVENING SHADOW 4164'),
    ('GQ4126', 'GOBIS ARMOR WEATHER GUARD - TEA ROSE 4126', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'TEA ROSE 4126'),
    ('GQ4125', 'GOBIS ARMOR WEATHER GUARD - SWEET PEACH 4125', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SWEET PEACH 4125'),
    ('GQ4176', 'GOBIS ARMOR WEATHER GUARD - CINNAMON 4176', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CINNAMON 4176'),
    ('GQ4177', 'GOBIS ARMOR WEATHER GUARD - DOVE GREY 4177', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'DOVE GREY 4177'),
    ('GQ4161', 'GOBIS ARMOR WEATHER GUARD - CHARCOAL 4161', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'CHARCOAL 4161'),
    ('GQ4159', 'GOBIS ARMOR WEATHER GUARD - SHARA SAND 4159', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SHARA SAND 4159'),
    ('GQ4155', 'GOBIS ARMOR WEATHER GUARD - SWEET JEWEL 4155', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SWEET JEWEL 4155'),
    ('GQ4156', 'GOBIS ARMOR WEATHER GUARD - RED HAZE 4156', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'RED HAZE 4156'),
    ('GQ4121', 'GOBIS ARMOR WEATHER GUARD - SAND STONE 4121', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'SAND STONE 4121'),
    ('GQ4118', 'GOBIS ARMOR WEATHER GUARD - AUTUMN RED 4118', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'AUTUMN RED 4118'),
    ('GQ4184', 'GOBIS ARMOR WEATHER GUARD - BEAVER 4184', 'Weather Shield Exterior', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', 'BEAVER 4184'),
    ('GQ2004', 'GOBIS SONA LAPI', 'Primers & Putty', 'GOBI''S', 'Putty & Surface Prep', 'Quarter', 'Quarter', NULL),
    ('GG2002', 'GOBIS GOLD SERIES LAPI', 'Primers & Putty', 'GOBI''S', 'Gold Series', 'Gallon', 'Gallon', NULL),
    ('GG4200', 'GOBIS ARMOR WALL PUTTY', 'Primers & Putty', 'GOBI''S', 'Armor Series', 'Gallon', 'Gallon', NULL),
    ('GQ4200', 'GOBIS ARMOR WALL PUTTY', 'Primers & Putty', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', NULL),
    ('GQ2007', 'GOBIS GOLD SERIES WATER PRIMER', 'Primers & Putty', 'GOBI''S', 'Gold Series', 'Quarter', 'Quarter', NULL),
    ('GQ4100', 'GOBIS ARMOR WATER PRIMER', 'Primers & Putty', 'GOBI''S', 'Armor Series', 'Quarter', 'Quarter', NULL),
    ('GD4100', 'GOBIS ARMOR WATER PRIMER', 'Primers & Putty', 'GOBI''S', 'Armor Series', 'Drum', 'Drum', NULL),
    ('GG1600', 'GOBIS VALMATE WEATHER SHEILD - WHITE 1600', 'Weather Shield Exterior', 'GOBI''S', 'Valmate / Summer / Kontra', 'Gallon', 'Gallon', 'WHITE 1600'),
    ('GG1602', 'GOBIS VALMATE WEATHER SHEILD - ASH WHITE 1602', 'Weather Shield Exterior', 'GOBI''S', 'Valmate / Summer / Kontra', 'Gallon', 'Gallon', 'ASH WHITE 1602'),
    ('GG1607', 'GOBIS VALMATE WEATHER SHEILD - CAMEO 1607', 'Weather Shield Exterior', 'GOBI''S', 'Valmate / Summer / Kontra', 'Gallon', 'Gallon', 'CAMEO 1607'),
    ('GD8000', 'GOBIS PLASTIC EMULSION - WHITE 8000', 'Emulsion Interior', 'GOBI''S', 'General Series', 'Drum', 'Drum', 'WHITE 8000'),
    ('GQ795', 'GOBIS CAR MAN - NC MATT BLACK 795', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC MATT BLACK 795'),
    ('GQ701', 'GOBIS CAR MAN - NC GLOSS LACQUER 701', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC GLOSS LACQUER 701'),
    ('GQ721', 'GOBIS CAR MAN - NC MATT LACQUER 721', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC MATT LACQUER 721'),
    ('GQ714', 'GOBIS CAR MAN - NC FINE SILVER 714', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC FINE SILVER 714'),
    ('GQ703', 'GOBIS CAR MAN - NC BLACK 703', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC BLACK 703'),
    ('GQ045', 'GOBIS CAR MAN - NC TOY WHITE 045', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC TOY WHITE 045'),
    ('GQ718', 'GOBIS CAR MAN - NC PUTTY 718', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC PUTTY 718'),
    ('GQ712', 'GOBIS CAR MAN - NC PRIMER 712', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC PRIMER 712'),
    ('GQ728', 'GOBIS CAR MAN - NC WOOD SEALER 728', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC WOOD SEALER 728'),
    ('GQ26U', 'GOBIS CAR MAN - NC SU WHITE 26U', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC SU WHITE 26U'),
    ('GQ702', 'GOBIS CAR MAN - NC WHITE 702', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC WHITE 702'),
    ('GQ16', 'GOBIS CAR MAN - NC HARDNER 16', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC HARDNER 16'),
    ('GQ17', 'GOBIS CAR MAN - NC HARDNER 17', 'Synthetic Enamel', 'GOBI''S', 'Car Man Synthetic', 'Quarter', 'Quarter', 'NC HARDNER 17'),
    ('GD1200', 'GOBIS HEAT FLEX - WHITE', 'Synthetic Enamel', 'GOBI''S', 'Heat Flex Speciality', 'Drum', 'Drum', 'WHITE'),
    ('GQ0062', 'GOBIS 400 THINER OIL', 'Solvents & Thinners', 'GOBI''S', 'Thinners & Solvents', 'Quarter', 'Quarter', NULL),
    ('KG5989', 'KAIZEN ZINC PHOSPHATE PRIMER - GREY 5989', 'Primers & Putty', 'KAIZEN', 'Industrial Coatings', 'Gallon', 'Gallon', 'GREY 5989')
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

  INSERT INTO public.items (
    tenant_id, code, name, category, brand, brand_id, series_id,
    unit, pack_size, shade_code, cost_price, retail_price,
    stock_qty, min_stock_alert, has_token, token_value, created_at
  )
  SELECT
    v_tenant_id,
    v.code,
    v.name,
    v.category,
    v.brand,
    b.id,
    bs.id,
    v.unit,
    v.pack_size,
    v.shade_code,
    0.00,
    0.00,
    0.00,
    5.00,
    false,
    0.00,
    NOW()
  FROM (VALUES
    ('KG5839', 'KAIZEN HI BUILD EPOXY WHITE - WHITE 5839', 'Primers & Putty', 'KAIZEN', 'Industrial Coatings', 'Gallon', 'Gallon', 'WHITE 5839'),
    ('KGG', 'KAIZEN UNDERCOAT GREY', 'Primers & Putty', 'KAIZEN', 'Industrial Coatings', 'Gallon', 'Gallon', NULL),
    ('CQ9600', 'CHOICE PREMIER SERIES ENAMEL', 'Synthetic Enamel', 'CHOICE', 'Premier Series', 'Quarter', 'Quarter', NULL),
    ('BPVQ', 'BLUE BIRD POLYURETHANE VARNISH - GLOSS', 'Wood & Varnish', 'BLUE BIRD', 'Wood Care & Varnish', 'Quarter', 'Quarter', 'GLOSS'),
    ('BS1000', 'BLUE BIRD SOLIGNUM BROWN', 'Wood & Varnish', 'BLUE BIRD', 'Wood Care & Varnish', '1L Quarter', '1L Quarter', NULL),
    ('SSPRAY', 'BLUE BIRD SOLIGNUM COLORLESS - SPRAY', 'Wood & Varnish', 'BLUE BIRD', 'Wood Care & Varnish', 'PCS', 'PCS', 'SPRAY'),
    ('Tinlet', 'COMMANDER PAINT BRUSH', 'Accessories', 'GENERAL HARDWARE', 'Tools & Adhesives', 'Drum', 'Drum', NULL)
  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
  JOIN public.brands b ON b.tenant_id = v_tenant_id AND b.name = v.brand
  LEFT JOIN public.brand_series bs ON bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND bs.name = v.series
  ON CONFLICT (tenant_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    brand = EXCLUDED.brand,
    brand_id = EXCLUDED.brand_id,
    series_id = EXCLUDED.series_id,
    unit = EXCLUDED.unit,
    pack_size = EXCLUDED.pack_size,
    shade_code = EXCLUDED.shade_code,
    cost_price = 0.00,
    retail_price = 0.00,
    stock_qty = 0.00;

END $$;
