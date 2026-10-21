import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env.local
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

async function main() {
  console.log('Querying Database for Shop TPH (', TENANT_ID, ')...');

  // 1. Get Brands
  const { data: brands, error: bErr } = await supabase
    .from('brands')
    .select('*')
    .eq('tenant_id', TENANT_ID);
  
  // 2. Get Brand Series
  const { data: series, error: sErr } = await supabase
    .from('brand_series')
    .select('*')
    .eq('tenant_id', TENANT_ID);

  // 3. Get All Items for TPH
  const { data: items, error: iErr } = await supabase
    .from('items')
    .select('id, code, name, brand, series_id, pack_size, unit, stock_qty, cost_price, retail_price, category, shade_code')
    .eq('tenant_id', TENANT_ID);

  if (iErr) {
    console.error('Error fetching items:', iErr);
    return;
  }

  console.log(`Found ${items.length} total items in DB for TPH.`);
  console.log(`Brands in DB:`, brands?.map(b => b.name));
  console.log(`Series in DB:`, series?.map(s => s.name));

  // Filter Gobi's items
  const gobiItems = items.filter(it => (it.brand || '').toUpperCase().includes('GOBI'));
  console.log(`Gobi's items count in DB: ${gobiItems.length}`);

  // Let's print distinct product names under Gobi's
  const gobiProductNames = Array.from(new Set(gobiItems.map(it => it.name))).sort();
  console.log(`\nDistinct Gobi's product names (${gobiProductNames.length}):`);
  gobiProductNames.forEach(n => console.log('  -', n));

  // Check prices of Gobi's items
  const itemsWithPrices = gobiItems.filter(it => (Number(it.cost_price || 0) > 0 || Number(it.retail_price || 0) > 0));
  console.log(`\nGobi's items with price > 0: ${itemsWithPrices.length} / ${gobiItems.length}`);

  // Group by series
  const seriesMap = {};
  series?.forEach(s => { seriesMap[s.id] = s.name; });

  const gobiBySeries = {};
  gobiItems.forEach(it => {
    const sName = seriesMap[it.series_id] || 'Unassigned / Unknown';
    gobiBySeries[sName] = (gobiBySeries[sName] || 0) + 1;
  });
  console.log('\nGobi items count by Series in DB:', gobiBySeries);

  // Let's output a full JSON for deep comparison
  fs.writeFileSync('gobi_db_items.json', JSON.stringify({
    totalGobiItems: gobiItems.length,
    series: gobiBySeries,
    items: gobiItems
  }, null, 2));

  console.log('Saved gobi_db_items.json for detailed cross check.');
}

main().catch(console.error);
