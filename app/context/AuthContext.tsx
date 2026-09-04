import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { registerPushToken, unregisterPushToken } from '../utils/notifications';
import { readGuestMode, writeGuestMode } from '../lib/guestMode';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  topics: string[];
  articles_read: number;
  reading_streak: number;
  daily_goal: number;
  followers_count: number;
  following_count: number;
  onboarding_complete: boolean;
  created_at?: string | null;
  followers?: number | null;
  following?: number | null;
  longest_streak?: number | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isGuestMode: boolean;
  continueAsGuest: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(() => readGuestMode());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        writeGuestMode(false);
        setIsGuestMode(false);
      }
      setSession(session);
      if (session?.user) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    setLoading(false);
    // Register push token whenever we load a profile (no-op if already registered)
    registerPushToken(userId);
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    writeGuestMode(false);
    setIsGuestMode(false);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, email_confirmed: true } },
    });
    if (error) throw error;

    writeGuestMode(false);
    setIsGuestMode(false);

    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
    }
  };

  const signOut = async () => {
    const userId = session?.user?.id;

    // Push cleanup must never prevent someone from leaving their account.
    if (userId) {
      await unregisterPushToken(userId).catch(() => {});
    }

    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;

    // Auth events normally perform this update. Setting it here as well keeps
    // the UI reliable when the browser/native event arrives late.
    writeGuestMode(false);
    setIsGuestMode(false);
    setProfile(null);
    setSession(null);
    setLoading(false);
  };

  const continueAsGuest = () => {
    writeGuestMode(true);
    setIsGuestMode(true);
    setProfile(null);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user) await fetchProfile(session.user.id);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!session?.user) return;
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id);
    if (error) throw error;
    await refreshProfile();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      loading,
      isGuestMode,
      continueAsGuest,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
