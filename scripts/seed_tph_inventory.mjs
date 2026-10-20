import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 1. Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TENANT_ID = '36da36b6-c1d2-448c-b685-3d7f354fdfca';

// Unit normalization
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

// Brand and Series classification
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

// Map to exact 7 UI categories
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

async function runSeed() {
  console.log('--- Starting Inventory Seed for TPH (', TENANT_ID, ') ---');

  // Fetch all brands for this tenant
  const { data: dbBrands, error: bErr } = await supabase
    .from('brands')
    .select('id, name')
    .eq('tenant_id', TENANT_ID);

  if (bErr) throw bErr;
  const brandMap = new Map(dbBrands.map(b => [b.name.toLowerCase(), b.id]));

  // Fetch all brand_series for this tenant
  const { data: dbSeries, error: sErr } = await supabase
    .from('brand_series')
    .select('id, brand_id, name')
    .eq('tenant_id', TENANT_ID);

  if (sErr) throw sErr;
  const seriesMap = new Map(dbSeries.map(s => [`${s.brand_id}_${s.name.toLowerCase()}`, s.id]));

  console.log(`Loaded ${dbBrands.length} brands and ${dbSeries.length} series from DB.`);

  // Parse STOCK REPORT.pdf
  const content = fs.readFileSync('parsed_stock_report.txt', 'utf8');
  const lines = content.split('\n').map(l => l.trim());

  let currentGroup = '';
  const itemsToInsert = [];

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

        const brandId = brandMap.get(brand.toLowerCase()) || null;
        let seriesId = null;
        if (brandId) {
          seriesId = seriesMap.get(`${brandId}_${series.toLowerCase()}`) || null;
        }

        let name = currentGroup;
        if (shade) {
          name = currentGroup + ' - ' + shade;
        }

        itemsToInsert.push({
          tenant_id: TENANT_ID,
          code: code.trim(),
          name: name.trim(),
          category,
          brand,
          brand_id: brandId,
          series_id: seriesId,
          unit,
          pack_size: unit,
          shade_code: shade || null,
          cost_price: 0.00,
          retail_price: 0.00,
          stock_qty: 0.00,
          min_stock_alert: 5.00,
          has_token: false,
          token_value: 0.00,
        });
      }
    } else {
      if (parts.length === 1 && line.length > 2 && !/^\d+$/.test(line) && !line.startsWith('-180846')) {
        currentGroup = line;
      }
    }
  }

  console.log(`Prepared ${itemsToInsert.length} items to insert with 0 quantity & 0 prices.`);

  // Insert in batches of 100 with upsert
  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < itemsToInsert.length; i += batchSize) {
    const chunk = itemsToInsert.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('items')
      .upsert(chunk, { onConflict: 'tenant_id,code' });

    if (error) {
      console.error(`Error in batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
    insertedCount += chunk.length;
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${insertedCount}/${itemsToInsert.length} items.`);
  }

  console.log('✅ ALL ITEMS SUCCESSFULLY SEEDED INTO TPH!');

  // Verify count in DB
  const { count, error: cErr } = await supabase
    .from('items')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', TENANT_ID);

  console.log(`Verification: Total items in TPH database = ${count}`);
}

runSeed().catch(console.error);
