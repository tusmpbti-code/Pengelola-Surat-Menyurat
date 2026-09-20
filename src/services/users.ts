import { supabase, isSupabaseConfigured } from './supabase';
import { Profile, UserRole } from '../types';

/**
 * Mengambil daftar seluruh profil pengguna untuk SUPER_ADMIN.
 * Database kosong saat awal (tanpa akun/profil dummy).
 */
export async function getProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Gagal memuat profil pengguna:', error.message);
      return [];
    }

    return (data as Profile[]) || [];
  } catch (err) {
    console.error('Error getProfiles:', err);
    return [];
  }
}

/**
 * Memperbarui role pengguna (SUPER_ADMIN, ADMIN, VIEWER)
 */
export async function updateProfileRole(
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui role';
    return { success: false, error: message };
  }
}

/**
 * Mengaktifkan atau menonaktifkan akun pengguna
 */
export async function toggleProfileActive(
  userId: string,
  isActive: boolean
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: isActive })
      .eq('id', userId);

    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengubah status aktif user';
    return { success: false, error: message };
  }
}
