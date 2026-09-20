import { supabase, isSupabaseConfigured } from './supabase';
import { SystemSettings } from '../types';

/**
 * Mengambil pengaturan sistem sekolah (SMP Bhinneka Tunggal Ika).
 * Sesuai aturan: semua nilai awal dimulai dalam kondisi kosong/null jika belum diisi.
 */
export async function getSystemSettings(): Promise<SystemSettings | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Gagal memuat system_settings:', error.message);
      return null;
    }

    return (data as SystemSettings) || null;
  } catch (err) {
    console.error('Error getSystemSettings:', err);
    return null;
  }
}

/**
 * Memperbarui atau menyimpan pengaturan sistem sekolah
 */
export async function saveSystemSettings(
  settings: Partial<SystemSettings>
): Promise<{ data: SystemSettings | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase belum terkonfigurasi.' };
  }

  try {
    const current = await getSystemSettings();

    if (current && current.id) {
      const { data, error } = await supabase
        .from('system_settings')
        .update({
          school_name: settings.school_name,
          school_address: settings.school_address,
          school_phone: settings.school_phone,
          school_email: settings.school_email,
          school_website: settings.school_website,
          school_logo: settings.school_logo,
          head_of_tu_name: settings.head_of_tu_name,
          head_of_tu_position: settings.head_of_tu_position,
        })
        .eq('id', current.id)
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as SystemSettings, error: null };
    } else {
      const { data, error } = await supabase
        .from('system_settings')
        .insert({
          school_name: settings.school_name,
          school_address: settings.school_address,
          school_phone: settings.school_phone,
          school_email: settings.school_email,
          school_website: settings.school_website,
          school_logo: settings.school_logo,
          head_of_tu_name: settings.head_of_tu_name,
          head_of_tu_position: settings.head_of_tu_position,
        })
        .select()
        .single();

      if (error) return { data: null, error: error.message };
      return { data: data as SystemSettings, error: null };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan sistem.';
    return { data: null, error: message };
  }
}
