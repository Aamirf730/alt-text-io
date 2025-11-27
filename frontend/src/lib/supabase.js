import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

// Debug Supabase configuration
console.log('🔧 Supabase Configuration:');
console.log('  - URL:', supabaseUrl);
console.log('  - Anon Key:', supabaseAnonKey ? (supabaseAnonKey.substring(0, 20) + '...') : 'NOT SET');
console.log('  - Env URL:', process.env.REACT_APP_SUPABASE_URL || 'NOT SET');
console.log('  - Env Key:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

// Check if using placeholder values
if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
  console.warn('⚠️ WARNING: Supabase is using placeholder values! Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    site: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? window.location.origin
      : 'https://www.alt-text.pro'
  }
});
