import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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

async function main() {
  console.log('Checking Supabase connection...');
  const { data, error } = await supabase.from('tenants').select('id, name').limit(1);
  if (error) {
    console.error('Connection error:', error);
    process.exit(1);
  }
  console.log('Connected! Tenant found:', data);
  
  // Try executing RPC if available or testing table existence
  const { data: gData, error: gErr } = await supabase.from('global_ai_settings').select('*').limit(1);
  if (gErr) {
    console.log('global_ai_settings table not yet accessible via REST or does not exist:', gErr.message);
  } else {
    console.log('global_ai_settings exists:', gData);
  }
}

main();
