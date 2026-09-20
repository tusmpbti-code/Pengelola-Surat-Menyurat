import { supabase, isSupabaseConfigured } from './supabase';
import { Profile } from '../types';

export interface AuthResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

/**
 * Memeriksa apakah sistem membutuhkan Initial Admin Setup.
 * Jika tabel profiles kosong (0 record), maka sistem belum memiliki administrator.
 */
export async function checkIfSetupNeeded(): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.warn('Cek inisialisasi administrator:', error.message);
      // Jika terjadi error RLS atau tabel belum ada, anggap belum selesai setup
      return true;
    }

    return count === 0;
  } catch (err) {
    console.error('Gagal memeriksa status setup admin:', err);
    return false;
  }
}

/**
 * Pendaftaran administrator pertama (SUPER_ADMIN) pada SIPAS BTI.
 */
export async function signUpInitialSuperAdmin(
  fullName: string,
  email: string,
  password: string
): Promise<AuthResponse<{ user: unknown; profile: Profile | null }>> {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: 'Koneksi Supabase belum dikonfigurasi. Silakan lengkapi URL dan Anon Key di pengaturan.',
    };
  }

  // Verifikasi apakah benar-benar belum ada profil
  const setupNeeded = await checkIfSetupNeeded();
  if (!setupNeeded) {
    return {
      data: null,
      error: 'Administrator sistem sudah pernah dibuat sebelumnya. Silakan gunakan menu Login.',
    };
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'SUPER_ADMIN',
        },
      },
    });

    if (authError) {
      return { data: null, error: authError.message };
    }

    if (!authData.user) {
      return { data: null, error: 'Pendaftaran gagal dibuat oleh sistem autentikasi.' };
    }

    // Pastikan record profil terisi dengan role SUPER_ADMIN
    const newProfile: Partial<Profile> = {
      id: authData.user.id,
      full_name: fullName,
      email: email,
      role: 'SUPER_ADMIN',
      is_active: true,
    };

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .upsert(newProfile, { onConflict: 'id' })
      .select()
      .single();

    if (profileError) {
      console.warn('Catatan: Trigger profil mungkin sudah memproses record:', profileError.message);
    }

    return {
      data: {
        user: authData.user,
        profile: (profileData as Profile) || null,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat membuat admin pertama.';
    return { data: null, error: message };
  }
}

/**
 * Login pengguna ke SIPAS BTI
 */
export async function signInUser(
  email: string,
  password: string
): Promise<AuthResponse<{ user: unknown; profile: Profile | null }>> {
  if (!isSupabaseConfigured()) {
    return {
      data: null,
      error: 'Koneksi Supabase belum terkonfigurasi.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { data: null, error: error.message };
    }

    if (!data.user) {
      return { data: null, error: 'User tidak ditemukan.' };
    }

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileErr) {
      console.warn('Gagal memuat profil user:', profileErr.message);
    }

    if (profile && !profile.is_active) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: 'Akun Anda sedang dinonaktifkan oleh administrator. Hubungi Tata Usaha SMP Bhinneka Tunggal Ika.',
      };
    }

    return {
      data: {
        user: data.user,
        profile: (profile as Profile) || null,
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal melakukan login.';
    return { data: null, error: message };
  }
}

/**
 * Logout pengguna
 */
export async function signOutUser(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: null };
  }

  try {
    const { error } = await supabase.auth.signOut();
    return { error: error ? error.message : null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal keluar sesi.';
    return { error: message };
  }
}

/**
 * Permintaan reset password
 */
export async function sendPasswordReset(email: string): Promise<{ error: string | null; success: boolean }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase belum terkonfigurasi.', success: false };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      return { error: error.message, success: false };
    }

    return { error: null, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengirim email reset password.';
    return { error: message, success: false };
  }
}

/**
 * Ambil profil pengguna berdasarkan ID
 */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.warn('Gagal mengambil profil:', error.message);
      return null;
    }

    return data as Profile;
  } catch (err) {
    console.error('Error getUserProfile:', err);
    return null;
  }
}
