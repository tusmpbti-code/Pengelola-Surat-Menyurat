import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { Profile, UserRole } from '../types';
import { checkIfSetupNeeded, getUserProfile, signInUser, signOutUser } from '../services/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  isLoading: boolean;
  isSetupRequired: boolean;
  isConfigured: boolean;
  signIn: typeof signInUser;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSetupRequired, setIsSetupRequired] = useState<boolean>(false);
  const isConfigured = isSupabaseConfigured();

  const loadUserProfile = useCallback(async (userId: string) => {
    try {
      const p = await getUserProfile(userId);
      setProfile(p);
    } catch (err) {
      console.warn('Gagal memuat profil user saat ini:', err);
    }
  }, []);

  const checkSetupStatus = useCallback(async (): Promise<boolean> => {
    if (!isConfigured) {
      setIsSetupRequired(false);
      return false;
    }
    const needed = await checkIfSetupNeeded();
    setIsSetupRequired(needed);
    return needed;
  }, [isConfigured]);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
    await checkSetupStatus();
  }, [user, loadUserProfile, checkSetupStatus]);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      setIsLoading(true);

      if (!isConfigured) {
        setIsLoading(false);
        return;
      }

      try {
        // Cek apakah sistem butuh initial admin setup
        await checkSetupStatus();

        // Cek sesi yang sudah tersimpan
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          if (currentSession?.user) {
            await loadUserProfile(currentSession.user.id);
          }
        }
      } catch (err) {
        console.error('Error saat inisialisasi auth:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // Listener untuk perubahan state autentikasi Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadUserProfile(newSession.user.id);
        } else {
          setProfile(null);
        }

        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          await checkSetupStatus();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isConfigured, checkSetupStatus, loadUserProfile]);

  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setSession(null);
    setProfile(null);
    await checkSetupStatus();
  };

  const role: UserRole | null = profile?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        isLoading,
        isSetupRequired,
        isConfigured,
        signIn: signInUser,
        signOut: handleSignOut,
        refreshProfile,
        checkSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
