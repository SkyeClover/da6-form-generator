import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Supabase isn't configured, skip auth initialization
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    // Get initial session - this handles OAuth callback
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((error) => {
      console.error('Error getting session:', error);
      setLoading(false);
    });

    // Listen for auth changes (including OAuth redirects)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      // Handle OAuth callback
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(session);
        setUser(session?.user ?? null);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!isSupabaseConfigured()) {
      return { data: null, error: new Error('Supabase is not configured') };
    }
    
    // Determine redirect URL - use localhost for local development
    const redirectUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000/dashboard'
      : `${window.location.origin}/dashboard`;
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    return { data, error };
  };

  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      return { error: new Error('Supabase is not configured') };
    }
    
    // Clear local state first
    setUser(null);
    setSession(null);
    
    // Try to sign out from Supabase, but don't treat "no session" as an error
    try {
      const { error } = await supabase.auth.signOut();
      // If the error is about missing session, it's fine - we're already signed out
      if (error && error.message && !error.message.includes('session missing')) {
        return { error };
      }
      return { error: null };
    } catch (error) {
      // If signOut throws an error (like session missing), that's okay
      // We've already cleared the local state
      if (error.message && error.message.includes('session missing')) {
        return { error: null };
      }
      return { error };
    }
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

