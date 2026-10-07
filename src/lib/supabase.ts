import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ignspvajzblmsbertmmv.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon_key_placeholder';

// Task 13.3.5: Strict startup assertion — fail immediately if service role key is unconfigured
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey || supabaseServiceKey === 'service_key_placeholder') {
  throw new Error(
    '[FATAL SECURITY EXCEPTION] SUPABASE_SERVICE_ROLE_KEY is unconfigured or set to invalid placeholder. ' +
    'Server cannot start without a valid service role key.'
  );
}

// Standard client for browser/client-side calls
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend server routes / Developer Super Admin actions
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});
