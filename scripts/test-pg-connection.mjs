import pg from 'pg';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

// Try standard Supabase postgres connection string variants
const ref = 'ignspvajzblmsbertmmv';

async function testConnection() {
  const pass = 'postgres'; // try default postgres pass or service key
  const connectionString = `postgres://postgres.${ref}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;
  
  console.log('Testing PG connection...');
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to Supabase DB via PG!');
    const res = await client.query('SELECT NOW()');
    console.log('Result:', res.rows);
    await client.end();
  } catch (err) {
    console.error('PG Connection Error:', err.message);
  }
}

testConnection();
