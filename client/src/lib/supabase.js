import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'placeholder-key';

// Create client with placeholder values if env vars are missing
// This allows the app to render and show a setup message
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return process.env.REACT_APP_SUPABASE_URL && 
         process.env.REACT_APP_SUPABASE_ANON_KEY &&
         process.env.REACT_APP_SUPABASE_URL !== 'https://placeholder.supabase.co';
};

