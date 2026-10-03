import pg from 'pg';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

const ref = 'ignspvajzblmsbertmmv';
const hosts = [
  `postgres://postgres:${env.SUPABASE_SERVICE_ROLE_KEY}@db.${ref}.supabase.co:5432/postgres`,
  `postgres://postgres:${env.SUPABASE_SERVICE_ROLE_KEY}@db.${ref}.supabase.co:6543/postgres`,
  `postgres://postgres.${ref}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgres://postgres.${ref}:${env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres`
];

async function testHosts() {
  for (const conn of hosts) {
    console.log('Trying:', conn.replace(env.SUPABASE_SERVICE_ROLE_KEY, '****'));
    const client = new pg.Client({ connectionString: conn, connectionTimeoutMillis: 3000, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log('SUCCESS with:', conn.replace(env.SUPABASE_SERVICE_ROLE_KEY, '****'));
      await client.end();
      return conn;
    } catch (e) {
      console.log('Failed:', e.message);
    }
  }
}

testHosts();
