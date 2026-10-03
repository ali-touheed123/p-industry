import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'supabase', 'migrations', '20261003_01_centralized_ai_usage_system.sql'),
  'utf-8'
);

async function applyMigration() {
  console.log('Applying AI Usage Migration SQL via Supabase RPC/REST API...');

  // First, check if tables already exist or if we can query via supabase
  const { data: gCheck, error: gErr } = await supabase.from('global_ai_settings').select('*').limit(1);
  if (!gErr) {
    console.log('✅ Table global_ai_settings already exists!', gCheck);
    return;
  }

  // Try using Supabase sql endpoint with service role bearer token if allowed
  try {
    const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
    console.log('Testing REST endpoint accessibility:', url);
  } catch (err) {
    console.error('Error applying migration:', err);
  }
}

applyMigration();
