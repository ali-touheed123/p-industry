const fs = require('fs');

const content = fs.readFileSync('parsed_stock_report.txt', 'utf8');
const lines = content.split('\n').map(l => l.trim());

const TENANT_ID = '36da36b6-c1d2-448c-b685-3d7f354fdfca'; // TPH

// Unit standardization
function normalizeUnit(u) {
  const upper = u.toUpperCase().trim();
  if (upper === 'GALLON') return 'Gallon';
  if (upper === 'QUARTER') return 'Quarter';
  if (upper === 'DRUM') return 'Drum';
  if (upper === 'PIECS' || upper === 'PIECES' || upper === 'PKT') return 'PCS';
  if (upper === 'KG') return 'KG';
  if (upper === 'FOOT') return 'Foot';
  if (upper === 'LTR' || upper === 'LITER') return '1L Quarter';
  if (upper === 'CAN') return 'Can';
  if (upper === 'BAG') return 'Bag';
  return u;
}

// Map group to Brand and Series
function classifyBrandAndSeries(groupName) {
  const g = groupName.toUpperCase();
  if (g.startsWith('GOBI')) {
    let series = 'General Series';
    if (g.includes('GOLD')) series = 'Gold Series';
    else if (g.includes('SILK SHEEN')) series = 'Silk Sheen (Premium)';
    else if (g.includes('ARMOR')) series = 'Armor Series';
    else if (g.includes('VALMATE') || g.includes('SUMMER') || g.includes('KONTRA')) series = 'Valmate / Summer / Kontra';
    else if (g.includes('EGGSHELL')) series = 'Eggshell Special Shades';
    else if (g.includes('SONA LAPI') || g.includes('LAPI') || g.includes('PUTTY')) series = 'Putty & Surface Prep';
    else if (g.includes('CAR MAN')) series = 'Car Man Synthetic';
    else if (g.includes('HEAT FLEX')) series = 'Heat Flex Speciality';
    else if (g.includes('THINER') || g.includes('THINNER')) series = 'Thinners & Solvents';
    else if (g.includes('AQUEOUS MATT')) series = 'Aqueous Matt (Premium)';
    return { brand: "GOBI'S", series };
  } else if (g.startsWith('RELIANCE')) {
    let series = 'General Series';
    if (g.includes('PLASTIC EMULSION')) series = 'Plastic Emulsion';
    else if (g.includes('WEATHER GUARD')) series = 'Weather Guard';
    else if (g.includes('EASY COAT')) series = 'Easy Coat';
    else if (g.includes('SUPER ENAMEL') || g.includes('SYNTHETIC ENAMEL')) series = 'Synthetic Enamel';
    return { brand: 'RELIANCE', series };
  } else if (g.startsWith('BRIGHTO')) {
    let series = 'Boom Series';
    if (g.includes('SUPER MASTIC')) series = 'Boom Super Mastic';
    else if (g.includes('GLOSS ENAMEL')) series = 'Boom Gloss Enamel';
    else if (g.includes('SUPER SILK')) series = 'Boom Super Silk';
    return { brand: 'BRIGHTO', series };
  } else if (g.startsWith('BERGER')) {
    return { brand: 'BERGER', series: 'Water Base Primer' };
  } else if (g.startsWith('KAIZEN')) {
    return { brand: 'KAIZEN', series: 'Industrial Coatings' };
  } else if (g.startsWith('RELIABLE')) {
    return { brand: 'RELIABLE', series: 'Reliable Series' };
  } else if (g.startsWith('BLUE BIRD')) {
    return { brand: 'BLUE BIRD', series: 'Wood Care & Varnish' };
  } else if (g.startsWith('NIPPON')) {
    return { brand: 'NIPPON', series: 'Q Enamel' };
  } else if (g.startsWith('CHOICE')) {
    return { brand: 'CHOICE', series: 'Premier Series' };
  } else if (g.startsWith('ROZZI')) {
    return { brand: 'ROZZI', series: 'Lac Undercoat' };
  } else if (g.startsWith('BLACKHORSE')) {
    return { brand: 'BLACKHORSE', series: 'Gloss Finish Enamel' };
  } else if (g.startsWith('SILK GOLDEN')) {
    return { brand: 'SILK GOLDEN', series: 'Silk Matt' };
  } else if (g.startsWith('UJALA')) {
    return { brand: 'UJALA', series: 'Synthetic Enamel' };
  } else {
    return { brand: 'GENERAL HARDWARE', series: 'Tools & Adhesives' };
  }
}

// Map group to exact 7 UI categories from StockInventory.tsx
function mapToUiCategory(groupName) {
  const g = groupName.toUpperCase();
  if (g.includes('WEATHER') || g.includes('GUARD') || g.includes('SHEILD')) {
    return 'Weather Shield Exterior';
  }
  if (
    g.includes('SEALER') ||
    g.includes('PRIMER') ||
    g.includes('UNDER COAT') ||
    g.includes('UNDERCOAT') ||
    g.includes('PUTTY') ||
    g.includes('LAPI') ||
    g.includes('FILLING') ||
    g.includes('EPOXY')
  ) {
    return 'Primers & Putty';
  }
  if (g.includes('VARNISH') || g.includes('LACQUER') || g.includes('SOLIGNUM')) {
    return 'Wood & Varnish';
  }
  if (g.includes('THINNER') || g.includes('THINER')) {
    return 'Solvents & Thinners';
  }
  if (g.includes('RUBBER') || g.includes('GLUE') || g.includes('ADHESIVE') || g.includes('REGMAR') || g.includes('BRUSH') || g.includes('GLASS') || g.includes('WATT')) {
    return 'Accessories';
  }
  if (g.includes('ENAMEL') || g.includes('MATT') || g.includes('CAR MAN') || g.includes('HEAT FLEX')) {
    return 'Synthetic Enamel';
  }
  if (g.includes('EMULSION') || g.includes('MASTIC') || g.includes('EASY COAT') || g.includes('EGGSHELL')) {
    return 'Emulsion Interior';
  }
  return 'Accessories';
}

// Parse items from parsed_stock_report.txt
let currentGroup = '';
let products = [];
const brandSet = new Set();
const seriesMap = new Map(); // brand -> Set of series

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!line) continue;
  if (
    line.startsWith('STOCK BALANCE REPORT') ||
    line.startsWith('As On :') ||
    line.startsWith('Product Description') ||
    line.startsWith('Page ') ||
    line.startsWith('Opening') ||
    line.startsWith('-- ')
  ) {
    continue;
  }

  const parts = line.split('\t').map(p => p.trim());
  const firstCol = parts[0] ? parts[0].toUpperCase() : '';
  const isUnit = ['GALLON', 'QUARTER', 'DRUM', 'PIECS', 'PIECES', 'CAN', 'BAG', 'KG', 'LTR', 'LITER', 'TUBE', 'PKT', 'PACKET', 'FOOT'].includes(firstCol);

  if (isUnit) {
    const isSubtotal = parts.length === 5 && parts.slice(1).every(p => /^-?\d+(\.\d+)?$/.test(p));
    if (!isSubtotal && parts.length >= 4) {
      const rawUnit = parts[0];
      const rawCodeAndDesc = parts[3];

      if (/sunrise/i.test(currentGroup) || /diamond/i.test(currentGroup) || /sunrise/i.test(rawCodeAndDesc) || /diamond/i.test(rawCodeAndDesc)) {
        continue;
      }

      const match = rawCodeAndDesc.match(/^(\S+)(?:\s+(.*))?$/);
      const code = match ? match[1].trim() : rawCodeAndDesc.trim();
      const shade = (match && match[2]) ? match[2].trim() : '';

      const { brand, series } = classifyBrandAndSeries(currentGroup);
      const category = mapToUiCategory(currentGroup);
      const unit = normalizeUnit(rawUnit);

      brandSet.add(brand);
      if (!seriesMap.has(brand)) seriesMap.set(brand, new Set());
      seriesMap.get(brand).add(series);

      // Name: Group Name + Shade Description if available
      let name = currentGroup;
      if (shade) {
        name = currentGroup + ' - ' + shade;
      }

      products.push({
        code,
        name,
        brand,
        series,
        category,
        unit,
        pack_size: unit,
        shade_code: shade || null
      });
    }
  } else {
    if (parts.length === 1 && line.length > 2 && !/^\d+$/.test(line) && !line.startsWith('-180846')) {
      currentGroup = line;
    }
  }
}

console.log('Parsed items:', products.length);
console.log('Brands count:', brandSet.size);

// Build SQL
let sql = `-- Migration: 20261020_01_seed_tph_inventory_from_stock_report.sql
-- Direct SQL Seed Migration for Store: TPH (Tawakkal Paint House)
-- Tenant ID: ${TENANT_ID}
-- Source: STOCK REPORT.pdf
-- Scope: Option B (PDF catalog only, excluding Sunrise & Diamond)
-- Quantities, opening, balance = 0 | Prices & taxes = 0.00
-- Token tables untouched (has_token = false, token_value = 0.00)

DO $$
DECLARE
  v_tenant_id UUID := '${TENANT_ID}'::UUID;
BEGIN
  -- 1. Ensure Tenant exists
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Target tenant % does not exist in public.tenants', v_tenant_id;
  END IF;

  -- 2. Seed Brands
`;

for (const b of Array.from(brandSet).sort()) {
  const escapedB = b.replace(/'/g, "''");
  sql += `  INSERT INTO public.brands (tenant_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, '${escapedB}', 'active', NOW(), NOW()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brands
    WHERE tenant_id = v_tenant_id AND lower(name) = lower('${escapedB}')
  );\n`;
}

sql += `\n  -- 3. Seed Brand Series\n`;

for (const [brand, seriesSet] of seriesMap.entries()) {
  const escapedB = brand.replace(/'/g, "''");
  for (const s of Array.from(seriesSet).sort()) {
    const escapedS = s.replace(/'/g, "''");
    sql += `  INSERT INTO public.brand_series (tenant_id, brand_id, name, status, created_at, updated_at)
  SELECT v_tenant_id, b.id, '${escapedS}', 'active', NOW(), NOW()
  FROM public.brands b
  WHERE b.tenant_id = v_tenant_id AND lower(b.name) = lower('${escapedB}')
    AND NOT EXISTS (
      SELECT 1 FROM public.brand_series bs
      WHERE bs.tenant_id = v_tenant_id AND bs.brand_id = b.id AND lower(bs.name) = lower('${escapedS}')
    );\n`;
  }
}

sql += `\n  -- 4. Seed Inventory Items (Opening = 0, Balance = 0, Price = 0)\n`;

// Batch insert items in chunks of 50
const chunkSize = 50;
for (let i = 0; i < products.length; i += chunkSize) {
  const chunk = products.slice(i, i + chunkSize);
  sql += `  INSERT INTO public.items (
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
  FROM (VALUES\n`;

  const valuesRows = chunk.map((p, idx) => {
    const escCode = p.code.replace(/'/g, "''");
    const escName = p.name.replace(/'/g, "''");
    const escCat = p.category.replace(/'/g, "''");
    const escBrand = p.brand.replace(/'/g, "''");
    const escSeries = p.series.replace(/'/g, "''");
    const escUnit = p.unit.replace(/'/g, "''");
    const escPack = p.pack_size.replace(/'/g, "''");
    const escShade = p.shade_code ? `'${p.shade_code.replace(/'/g, "''")}'` : 'NULL';
    return `    ('${escCode}', '${escName}', '${escCat}', '${escBrand}', '${escSeries}', '${escUnit}', '${escPack}', ${escShade})`;
  });

  sql += valuesRows.join(',\n');
  sql += `\n  ) AS v(code, name, category, brand, series, unit, pack_size, shade_code)
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
    stock_qty = 0.00;\n\n`;
}

sql += `END $$;\n`;

fs.writeFileSync('supabase/migrations/20261020_01_seed_tph_inventory_from_stock_report.sql', sql, 'utf8');
console.log('Migration generated successfully: supabase/migrations/20261020_01_seed_tph_inventory_from_stock_report.sql');
console.log('Total items in migration:', products.length);
