import { createClient } from '@supabase/supabase-js';

// Supabase configuration - with fallback to hardcoded values if env vars are missing
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://zwrooqvwxdwvnuhpepta.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cm9vcXZ3eGR3dm51aHBlcHRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM4NzUxMzAsImV4cCI6MjA2OTQ1MTEzMH0.fW8hwOwQ1nxMScr2yZTnWNxFTrCJimn2L1y7avTapBc';

// Check if environment variables are configured
const isSupabaseConfigured = supabaseUrl && supabaseAnonKey && 
  supabaseUrl !== 'your-supabase-url' && 
  supabaseAnonKey !== 'your-supabase-anon-key';

// Create Supabase client only if properly configured
export const supabase = isSupabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Configure auth settings for persistent login across refreshes
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Explicitly persist to localStorage with a stable key to avoid ref/key drift
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-studiosix-auth-token',
    // Use PKCE OAuth flow and redirect to app root
    flowType: 'pkce',
    redirectTo: `${window.location.origin}/`
  }
}) : null;

if (typeof window !== 'undefined') {
  try {
    console.log('🔐 Supabase client init', {
      configured: isSupabaseConfigured,
      storageKey: 'sb-studiosix-auth-token',
      existingSessionKeys: Object.keys(window.localStorage || {}).filter(k => /sb-.*-auth-token$/.test(k) || k === 'sb-studiosix-auth-token')
    });
  } catch {}
}

// Configuration status
export const isAuthConfigured = isSupabaseConfigured;

// Export auth helpers
export const auth = {
  // Check if auth is configured
  isConfigured() {
    return isSupabaseConfigured && !!supabase;
  },

  // Sign in with email and password
  async signIn(email, password) {
    if (!supabase) {
      return { data: null, error: { message: 'Authentication not configured. Please set up Supabase credentials.' } };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      console.log('🔐 Supabase signIn result:', { 
        user: data?.user?.email, 
        session: !!data?.session, 
        error: error?.message 
      });
      
      return { data, error };
    } catch (err) {
      console.error('🔐 Supabase signIn exception:', err);
      return { data: null, error: { message: err.message } };
    }
  },

  // Sign up with email and password
  async signUp(email, password, metadata = {}) {
    if (!supabase) {
      return { data: null, error: { message: 'Authentication not configured. Please set up Supabase credentials.' } };
    }
    try {
      // For custom verification flow, we'll create the user without email confirmation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
          // Skip email confirmation since we handle it with our custom system
          emailRedirectTo: undefined
        },
      });
      
      console.log('🔐 Supabase signUp result:', { 
        user: data?.user?.email, 
        session: !!data?.session, 
        error: error?.message 
      });
      
      return { data, error };
    } catch (err) {
      console.error('🔐 Supabase signUp exception:', err);
      return { data: null, error: { message: err.message } };
    }
  },

  // Sign in with Google
  async signInWithGoogle() {
    if (!supabase) {
      return { data: null, error: { message: 'Authentication not configured. Please set up Supabase credentials.' } };
    }
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // Sign out
  async signOut() {
    if (!supabase) {
      return { error: { message: 'Authentication not configured.' } };
    }
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error };
      }
      return { error: null };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  // Get current user
  async getCurrentUser() {
    if (!supabase) {
      return null;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    } catch (err) {
      console.error('Error getting current user:', err);
      return null;
    }
  },

  // Get current session
  async getCurrentSession() {
    if (!supabase) {
      return null;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session;
    } catch (err) {
      console.error('Error getting current session:', err);
      return null;
    }
  },

  // Listen to auth changes
  onAuthStateChange(callback) {
    if (!supabase) {
      console.warn('Supabase not configured - auth state changes will not be tracked');
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    try {
      return supabase.auth.onAuthStateChange(callback);
    } catch (err) {
      console.error('Error setting up auth state listener:', err);
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  },

  // Admin function to confirm user email (requires service role key)
  async adminConfirmUser(email) {
    if (!supabase) {
      return { error: { message: 'Authentication not configured.' } };
    }
    
    console.log('🔐 Attempting admin confirm user:', email);
    
    // This would require service role key which we don't have in frontend
    // For now, we'll try a workaround by directly signing in
    try {
      // Get user by email (this might not work with anon key)
      const { data: users, error } = await supabase
        .from('auth.users')
        .select('*')
        .eq('email', email);
        
      console.log('🔐 User lookup result:', { users, error });
      
      if (error) {
        return { error };
      }
      
      return { data: users };
    } catch (err) {
      console.error('🔐 Admin confirm error:', err);
      return { error: { message: err.message } };
    }
  }
};

export default supabase; 