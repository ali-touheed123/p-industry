import pg from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach((line) => {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
});

// Extract project ref from URL: https://ignspvajzblmsbertmmv.supabase.co
const projectRef = 'ignspvajzblmsbertmmv';

const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20261003_01_centralized_ai_usage_system.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

console.log('Migration SQL loaded. Length:', sql.length);
