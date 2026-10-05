import { createClient } from '@supabase/supabase-js';
import { safeStorage } from '../utils/safeStorage';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vnpvgwopeviztrgtfpfo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucHZnd29wZXZpenRyZ3RmcGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTc2ODAsImV4cCI6MjEwNjE5MzY4MH0.FRQ3uqmqqb0--ztCZMCGxC8oItxisx4XEWSRb7-qS3s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
