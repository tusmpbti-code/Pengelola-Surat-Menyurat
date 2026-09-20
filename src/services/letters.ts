import { supabase, isSupabaseConfigured, uploadLetterFile } from './supabase';
import {
  Letter,
  LetterCategory,
  LetterLog,
  DashboardStats,
  LetterType,
  LetterStatus,
  JournalFilterParams,
  ComprehensiveReportStats,
  ReportArchive,
} from '../types';

/**
 * Mengambil statistik dashboard dari database nyata.
 * Mengembalikan angka 0 jika database kosong. Tidak ada data dummy.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const defaultStats: DashboardStats = {
    total_incoming: 0,
    total_outgoing: 0,
    total_this_month: 0,
    need_review: 0,
  };

  if (!isSupabaseConfigured()) {
    return defaultStats;
  }

  try {
    // 1. Total Surat Masuk (INCOMING) yang belum dihapus
    const { count: incomingCount, error: incomingErr } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('letter_type', 'INCOMING')
      .is('deleted_at', null);

    if (incomingErr) console.warn('Statistik surat masuk:', incomingErr.message);

    // 2. Total Surat Keluar (OUTGOING) yang belum dihapus
    const { count: outgoingCount, error: outgoingErr } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('letter_type', 'OUTGOING')
      .is('deleted_at', null);

    if (outgoingErr) console.warn('Statistik surat keluar:', outgoingErr.message);

    // 3. Surat Bulan Ini
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const { count: monthCount, error: monthErr } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .gte('letter_date', startOfMonth)
      .is('deleted_at', null);

    if (monthErr) console.warn('Statistik surat bulan ini:', monthErr.message);

    // 4. Perlu Verifikasi (NEED_REVIEW)
    const { count: reviewCount, error: reviewErr } = await supabase
      .from('letters')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'NEED_REVIEW')
      .is('deleted_at', null);

    if (reviewErr) console.warn('Statistik perlu verifikasi:', reviewErr.message);

    return {
      total_incoming: incomingCount || 0,
      total_outgoing: outgoingCount || 0,
      total_this_month: monthCount || 0,
      need_review: reviewCount || 0,
    };
  } catch (err) {
    console.error('Gagal mengambil statistik dashboard:', err);
    return defaultStats;
  }
}

/**
 * Pengecekan Duplikasi Nomor Surat Resmi (Requirement K).
 * Jika nomor surat sudah ada, kembalikan data surat yang ada.
 */
export async function checkDuplicateLetterNumber(
  letterNumber: string,
  excludeLetterId?: string
): Promise<{ exists: boolean; letter?: Letter }> {
  if (!isSupabaseConfigured() || !letterNumber.trim()) {
    return { exists: false };
  }

  try {
    let query = supabase
      .from('letters')
      .select('id, letter_number, subject, letter_type, letter_date, status')
      .ilike('letter_number', letterNumber.trim())
      .is('deleted_at', null);

    if (excludeLetterId) {
      query = query.neq('id', excludeLetterId);
    }

    const { data, error } = await query.limit(1);

    if (error) {
      console.warn('Cek duplikasi nomor surat:', error.message);
      return { exists: false };
    }

    if (data && data.length > 0) {
      return { exists: true, letter: data[0] as Letter };
    }

    return { exists: false };
  } catch (err) {
    console.error('Error checkDuplicateLetterNumber:', err);
    return { exists: false };
  }
}

/**
 * Mengambil atau Meng-generate Nomor Agenda Atomik (Requirement D).
 * ATOMIC DATABASE MECHANISM:
 * - Dimulai dari 001 setiap tahun kalender
 * - Tidak menghitung jumlah baris atau COUNT + 1 (mencegah tabrakan saat soft-delete / concurrency)
 * - Disimpan permanen di database
 * - Dibuat hanya ketika surat benar-benar dibuat
 */
export async function getOrGenerateNextAgendaNumber(
  letterType: LetterType,
  year: number = new Date().getFullYear()
): Promise<string> {
  if (!isSupabaseConfigured()) {
    return '001';
  }

  try {
    // 1. Coba panggil PostgreSQL Function atomic yang dibuat di migration
    const { data: rpcNumber, error: rpcErr } = await supabase.rpc('get_next_agenda_number', {
      p_letter_type: letterType,
      p_year: year,
    });

    if (!rpcErr && rpcNumber) {
      return String(rpcNumber);
    }

    // 2. Fallback Atomic Counter menggunakan tabel agenda_counters
    const { data: currentCounter } = await supabase
      .from('agenda_counters')
      .select('last_number')
      .eq('year', year)
      .eq('letter_type', letterType)
      .maybeSingle();

    let nextNumber = 1;

    if (currentCounter && typeof currentCounter.last_number === 'number') {
      nextNumber = currentCounter.last_number + 1;
      await supabase
        .from('agenda_counters')
        .update({ last_number: nextNumber, updated_at: new Date().toISOString() })
        .eq('year', year)
        .eq('letter_type', letterType);
    } else {
      // Periksa apakah ada surat tahun ini untuk inisialisasi counter di atas angka tertinggi
      const { data: existingLetters } = await supabase
        .from('letters')
        .select('agenda_number')
        .eq('letter_type', letterType)
        .gte('letter_date', `${year}-01-01`)
        .lte('letter_date', `${year}-12-31`)
        .not('agenda_number', 'is', null);

      let maxFound = 0;
      if (existingLetters && existingLetters.length > 0) {
        existingLetters.forEach((l) => {
          if (l.agenda_number) {
            const parsed = parseInt(l.agenda_number.replace(/\D/g, ''), 10);
            if (!isNaN(parsed) && parsed > maxFound) {
              maxFound = parsed;
            }
          }
        });
      }

      nextNumber = maxFound + 1;

      await supabase.from('agenda_counters').upsert({
        year,
        letter_type: letterType,
        last_number: nextNumber,
        updated_at: new Date().toISOString(),
      });
    }

    return String(nextNumber).padStart(3, '0');
  } catch (err) {
    console.error('Error in getOrGenerateNextAgendaNumber:', err);
    return '001';
  }
}

export interface GetLettersParams {
  letter_type?: LetterType;
  status?: LetterStatus | 'ALL';
  search?: string;
  category_id?: string;
  nature?: string;
  year?: number;
  month?: number;
  start_date?: string;
  end_date?: string;
  date_field?: 'letter_date' | 'received_date' | 'created_at';
  sort_by?: 'agenda_number' | 'letter_date' | 'received_date' | 'letter_number' | 'created_at' | 'subject';
  sort_direction?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
  include_trash?: boolean;
}

export interface GetLettersResult {
  letters: Letter[];
  total: number;
}

/**
 * Mengambil daftar surat nyata dengan filter, sorting, dan pagination
 */
export async function getLetters(params?: GetLettersParams): Promise<GetLettersResult> {
  if (!isSupabaseConfigured()) {
    return { letters: [], total: 0 };
  }

  try {
    let query = supabase
      .from('letters')
      .select(
        `
        *,
        category:letter_categories(*),
        files:letter_files(*),
        creator:profiles!letters_created_by_fkey(full_name, email, role),
        verifier:profiles!letters_verified_by_fkey(full_name, email, role)
      `,
        { count: 'exact' }
      );

    // Soft delete filter
    if (params?.include_trash) {
      query = query.not('deleted_at', 'is', null);
    } else {
      query = query.is('deleted_at', null);
    }

    if (params?.letter_type) {
      query = query.eq('letter_type', params.letter_type);
    }

    if (params?.status && params.status !== 'ALL') {
      query = query.eq('status', params.status);
    }

    if (params?.category_id && params.category_id !== 'ALL') {
      query = query.eq('category_id', params.category_id);
    }

    if (params?.nature && params.nature !== 'ALL') {
      query = query.eq('letter_nature', params.nature);
    }

    // Filter Rentang Periode Tanggal (start_date - end_date)
    const targetDateField = params?.date_field || 'letter_date';
    if (params?.start_date) {
      query = query.gte(targetDateField, params.start_date);
    }
    if (params?.end_date) {
      query = query.lte(targetDateField, params.end_date);
    }

    // Filter Tahun
    if (params?.year) {
      query = query
        .gte('letter_date', `${params.year}-01-01`)
        .lte('letter_date', `${params.year}-12-31`);
    }

    // Filter Bulan
    if (params?.year && params?.month) {
      const padMonth = String(params.month).padStart(2, '0');
      const startDay = `${params.year}-${padMonth}-01`;
      const lastDayNum = new Date(params.year, params.month, 0).getDate();
      const endDay = `${params.year}-${padMonth}-${String(lastDayNum).padStart(2, '0')}`;
      query = query.gte('letter_date', startDay).lte('letter_date', endDay);
    }

    // Pencarian menyeluruh (nomor surat, perihal, asal, tujuan, nomor agenda, ringkasan)
    if (params?.search && params.search.trim() !== '') {
      const q = `%${params.search.trim()}%`;
      query = query.or(
        `letter_number.ilike.${q},subject.ilike.${q},sender.ilike.${q},recipient.ilike.${q},agenda_number.ilike.${q},summary.ilike.${q}`
      );
    }

    // Sorting
    const sortBy = params?.sort_by || 'created_at';
    const sortAsc = params?.sort_direction === 'asc';
    query = query.order(sortBy, { ascending: sortAsc });

    // Pagination
    const page = params?.page || 1;
    const pageSize = params?.page_size || 15;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.warn('Gagal memuat surat:', error.message);
      return { letters: [], total: 0 };
    }

    return {
      letters: (data as Letter[]) || [],
      total: count || 0,
    };
  } catch (err) {
    console.error('Error fetching letters:', err);
    return { letters: [], total: 0 };
  }
}

/**
 * Mengambil 1 surat lengkap beserta relasi file dan log
 */
export async function getLetterById(id: string): Promise<Letter | null> {
  if (!isSupabaseConfigured() || !id) return null;

  try {
    const { data, error } = await supabase
      .from('letters')
      .select(`
        *,
        category:letter_categories(*),
        files:letter_files(*),
        creator:profiles!letters_created_by_fkey(full_name, email, role),
        verifier:profiles!letters_verified_by_fkey(full_name, email, role)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.warn('Gagal memuat detail surat:', error.message);
      return null;
    }

    return data as Letter;
  } catch (err) {
    console.error('Error getLetterById:', err);
    return null;
  }
}

/**
 * Mengambil riwayat aktivitas (audit log) spesifik untuk 1 surat
 */
export async function getLetterHistory(letterId: string): Promise<LetterLog[]> {
  if (!isSupabaseConfigured() || !letterId) return [];

  try {
    const { data, error } = await supabase
      .from('letter_logs')
      .select(`
        *,
        user:profiles!letter_logs_user_id_fkey(full_name, email, role)
      `)
      .eq('letter_id', letterId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Gagal memuat riwayat surat:', error.message);
      return [];
    }

    return (data as LetterLog[]) || [];
  } catch (err) {
    console.error('Error getLetterHistory:', err);
    return [];
  }
}

/**
 * Mencatat surat baru (Surat Masuk atau Surat Keluar)
 * Nomor agenda di-generate secara atomic jika tidak diisi secara khusus
 */
export async function createLetter(
  letterData: Omit<
    Letter,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'verified_at'
    | 'deleted_at'
    | 'category'
    | 'files'
    | 'creator'
    | 'verifier'
    | 'created_by'
    | 'verified_by'
  >,
  fileToUpload?: File | null,
  currentUserId?: string | null
): Promise<{ data: Letter | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase belum terkonfigurasi.' };
  }

  try {
    // 1. Tentukan nomor agenda secara atomic jika kosong
    let finalAgendaNumber = letterData.agenda_number ? letterData.agenda_number.trim() : null;
    if (!finalAgendaNumber) {
      const year = letterData.letter_date
        ? new Date(letterData.letter_date).getFullYear()
        : new Date().getFullYear();
      finalAgendaNumber = await getOrGenerateNextAgendaNumber(letterData.letter_type, year);
    }

    // 2. Simpan record surat ke tabel letters
    const payload = {
      ...letterData,
      agenda_number: finalAgendaNumber,
      created_by: currentUserId || null,
      status: letterData.status || 'NEED_REVIEW',
    };

    const { data: newLetter, error: letterError } = await supabase
      .from('letters')
      .insert(payload)
      .select(`
        *,
        category:letter_categories(*),
        files:letter_files(*),
        creator:profiles!letters_created_by_fkey(full_name, email, role)
      `)
      .single();

    if (letterError) {
      return { data: null, error: letterError.message };
    }

    // 3. Jika ada file fisik terlampir, unggah ke storage privat 'letter-files'
    if (fileToUpload && newLetter?.id) {
      try {
        const uploaded = await uploadLetterFile(
          fileToUpload,
          newLetter.id,
          letterData.letter_type,
          letterData.letter_date
        );
        if (uploaded) {
          await supabase.from('letter_files').insert({
            letter_id: newLetter.id,
            file_name: uploaded.name,
            file_path: uploaded.path,
            file_type: uploaded.type,
            file_size: uploaded.size,
            storage_bucket: 'letter-files',
            uploaded_by: currentUserId || null,
          });
        }
      } catch (fileErr: unknown) {
        const errMsg = fileErr instanceof Error ? fileErr.message : 'Gagal mengunggah file lampiran.';
        console.error('Peringatan: Gagal menyimpan file lampiran:', errMsg);
      }
    }

    // 4. Catat ke audit log
    if (newLetter?.id && currentUserId) {
      await logLetterAction(
        newLetter.id,
        'CREATE',
        `Mencatat ${letterData.letter_type === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'} nomor: ${letterData.letter_number} (Agenda: ${finalAgendaNumber})`,
        null,
        payload as Record<string, unknown>,
        currentUserId
      );
    }

    return { data: newLetter as Letter, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menyimpan surat.';
    return { data: null, error: message };
  }
}

/**
 * Memperbarui data surat dengan mencatat old_data dan new_data di audit log (Requirement I)
 */
export async function updateLetter(
  id: string,
  updates: Partial<Letter>,
  fileToUpload?: File | null,
  currentUserId?: string | null
): Promise<{ success: boolean; error: string | null; letter?: Letter }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase belum terkonfigurasi.' };
  }

  try {
    // 1. Ambil data surat saat ini untuk perbandingan audit log (old_data)
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();

    // 2. Jika ada file lampiran baru yang diunggah
    if (fileToUpload) {
      const type = (updates.letter_type || oldData?.letter_type || 'INCOMING') as LetterType;
      const date = (updates.letter_date || oldData?.letter_date) as string;
      const uploaded = await uploadLetterFile(fileToUpload, id, type, date);
      if (uploaded) {
        await supabase.from('letter_files').insert({
          letter_id: id,
          file_name: uploaded.name,
          file_path: uploaded.path,
          file_type: uploaded.type,
          file_size: uploaded.size,
          storage_bucket: 'letter-files',
          uploaded_by: currentUserId || null,
        });
      }
    }

    // 3. Bersihkan fields joined dari updates payload
    const cleanedUpdates = { ...updates };
    delete (cleanedUpdates as Record<string, unknown>).category;
    delete (cleanedUpdates as Record<string, unknown>).files;
    delete (cleanedUpdates as Record<string, unknown>).creator;
    delete (cleanedUpdates as Record<string, unknown>).verifier;

    const { data: updatedLetter, error } = await supabase
      .from('letters')
      .update(cleanedUpdates)
      .eq('id', id)
      .select(`
        *,
        category:letter_categories(*),
        files:letter_files(*),
        creator:profiles!letters_created_by_fkey(full_name, email, role),
        verifier:profiles!letters_verified_by_fkey(full_name, email, role)
      `)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // 4. Catat perubahan penting ke audit log (old_data & new_data)
    if (currentUserId) {
      await logLetterAction(
        id,
        'UPDATE',
        `Memperbarui data surat nomor: ${updates.letter_number || oldData?.letter_number || id}`,
        oldData as Record<string, unknown>,
        cleanedUpdates as Record<string, unknown>,
        currentUserId
      );
    }

    return { success: true, error: null, letter: updatedLetter as Letter };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui surat.';
    return { success: false, error: message };
  }
}

/**
 * Mengajukan surat untuk ditinjau / diverifikasi (DRAFT -> NEED_REVIEW)
 */
export async function submitForReviewLetter(
  id: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();

    const { error } = await supabase
      .from('letters')
      .update({ status: 'NEED_REVIEW' })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    await logLetterAction(
      id,
      'SUBMIT_REVIEW',
      `Mengajukan surat nomor: ${oldData?.letter_number} untuk peninjauan verifikasi`,
      oldData as Record<string, unknown>,
      { status: 'NEED_REVIEW' },
      userId
    );

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengajukan surat.';
    return { success: false, error: message };
  }
}

/**
 * Verifikasi surat resmi oleh ADMIN / SUPER_ADMIN (Requirement H)
 * Flow: NEED_REVIEW -> VERIFIED
 * Menyimpan verified_by dan verified_at
 */
export async function verifyLetter(
  id: string,
  verifierId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();
    const verifiedAt = new Date().toISOString();

    const { error } = await supabase
      .from('letters')
      .update({
        status: 'VERIFIED',
        verified_by: verifierId,
        verified_at: verifiedAt,
      })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    await logLetterAction(
      id,
      'VERIFY',
      `Memverifikasi surat resmi nomor: ${oldData?.letter_number}`,
      oldData as Record<string, unknown>,
      { status: 'VERIFIED', verified_by: verifierId, verified_at: verifiedAt },
      verifierId
    );

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memverifikasi surat.';
    return { success: false, error: message };
  }
}

/**
 * Mengarsipkan surat secara permanen (Requirement H)
 * Flow: VERIFIED -> ARCHIVED
 */
export async function archiveLetter(
  id: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();

    const { error } = await supabase
      .from('letters')
      .update({ status: 'ARCHIVED' })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    await logLetterAction(
      id,
      'ARCHIVE',
      `Memindahkan surat nomor: ${oldData?.letter_number} ke status arsip permanen`,
      oldData as Record<string, unknown>,
      { status: 'ARCHIVED' },
      userId
    );

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal mengarsipkan surat.';
    return { success: false, error: message };
  }
}

/**
 * Soft Delete surat ke status TRASH (Requirement J)
 * Menyetel status: TRASH dan deleted_at: timestamp
 * Tidak menghapus data secara permanen
 */
export async function softDeleteLetter(
  id: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();
    const deletedAt = new Date().toISOString();

    const { error } = await supabase
      .from('letters')
      .update({
        status: 'TRASH',
        deleted_at: deletedAt,
      })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    await logLetterAction(
      id,
      'DELETE',
      `Memindahkan surat nomor: ${oldData?.letter_number} ke tempat sampah (soft delete)`,
      oldData as Record<string, unknown>,
      { status: 'TRASH', deleted_at: deletedAt },
      userId
    );

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus surat.';
    return { success: false, error: message };
  }
}

/**
 * Memulihkan surat dari tempat sampah (Restore from TRASH)
 */
export async function restoreLetter(
  id: string,
  userId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase belum terkonfigurasi' };

  try {
    const { data: oldData } = await supabase.from('letters').select('*').eq('id', id).single();

    const { error } = await supabase
      .from('letters')
      .update({
        status: 'NEED_REVIEW',
        deleted_at: null,
      })
      .eq('id', id);

    if (error) return { success: false, error: error.message };

    await logLetterAction(
      id,
      'RESTORE',
      `Memulihkan surat nomor: ${oldData?.letter_number} dari tempat sampah`,
      oldData as Record<string, unknown>,
      { status: 'NEED_REVIEW', deleted_at: null },
      userId
    );

    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal memulihkan surat.';
    return { success: false, error: message };
  }
}

/**
 * Mencatat audit log aktivitas
 */
export async function logLetterAction(
  letterId: string | null,
  action: string,
  description: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
  userId: string | null
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    await supabase.from('letter_logs').insert({
      letter_id: letterId,
      user_id: userId,
      action,
      description,
      old_data: oldData,
      new_data: newData,
    });
  } catch (err) {
    console.warn('Gagal mencatat log surat:', err);
  }
}

/**
 * Mengambil daftar master kategori surat
 */
export async function getCategories(): Promise<LetterCategory[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('letter_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Gagal mengambil kategori:', error.message);
      return [];
    }

    return (data as LetterCategory[]) || [];
  } catch (err) {
    console.error('Error getCategories:', err);
    return [];
  }
}

/**
 * Tambah master kategori
 */
export async function createCategory(
  category: Omit<LetterCategory, 'id' | 'created_at' | 'updated_at'>
): Promise<{ data: LetterCategory | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'Supabase belum terkonfigurasi.' };
  }

  try {
    const { data, error } = await supabase
      .from('letter_categories')
      .insert(category)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as LetterCategory, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menambah kategori.';
    return { data: null, error: message };
  }
}

/**
 * Mengambil audit log aktivitas global
 */
export async function getLetterLogs(limit: number = 50): Promise<LetterLog[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('letter_logs')
      .select(`
        *,
        user:profiles!letter_logs_user_id_fkey(full_name, email, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('Gagal mengambil log aktivitas:', error.message);
      return [];
    }

    return (data as LetterLog[]) || [];
  } catch (err) {
    console.error('Error getLetterLogs:', err);
    return [];
  }
}

/**
 * Mengambil daftar surat untuk Jurnal Cetak / Export (Tahap 4)
 * Strict requirement:
 * - Urutan INCOMING: Tanggal Diterima ASC, Nomor Agenda ASC
 * - Urutan OUTGOING: Tanggal Surat ASC, Nomor Agenda ASC
 * - Nomor agenda berasal langsung dari database (tidak dihitung ulang)
 */
export async function getJournalLetters(params: JournalFilterParams): Promise<Letter[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    let query = supabase
      .from('letters')
      .select(
        `
        *,
        category:letter_categories(*),
        files:letter_files(*),
        creator:profiles!letters_created_by_fkey(full_name, email, role),
        verifier:profiles!letters_verified_by_fkey(full_name, email, role)
      `
      )
      .eq('letter_type', params.letter_type)
      .is('deleted_at', null);

    if (params.category_id && params.category_id !== 'ALL') {
      query = query.eq('category_id', params.category_id);
    }

    if (params.nature && params.nature !== 'ALL') {
      query = query.eq('letter_nature', params.nature);
    }

    const dateCol = params.letter_type === 'INCOMING' ? 'received_date' : 'letter_date';

    if (params.year) {
      query = query
        .gte(dateCol, `${params.year}-01-01`)
        .lte(dateCol, `${params.year}-12-31`);
    }

    if (params.period_start) {
      query = query.gte(dateCol, params.period_start);
    }

    if (params.period_end) {
      query = query.lte(dateCol, params.period_end);
    }

    // Default sorting according to official specs:
    if (params.letter_type === 'INCOMING') {
      query = query
        .order('received_date', { ascending: true, nullsFirst: false })
        .order('agenda_number', { ascending: true, nullsFirst: false });
    } else {
      query = query
        .order('letter_date', { ascending: true, nullsFirst: false })
        .order('agenda_number', { ascending: true, nullsFirst: false });
    }

    const { data, error } = await query;

    if (error) {
      console.warn('Gagal memuat jurnal surat:', error.message);
      return [];
    }

    return (data as Letter[]) || [];
  } catch (err) {
    console.error('Error in getJournalLetters:', err);
    return [];
  }
}

/**
 * Mengambil statistik rekapitulasi komprehensif dari database nyata
 * Semua angka berbasis data riil (0 jika belum ada data, tanpa mock).
 */
export async function getComprehensiveReportStats(
  selectedYear: number = new Date().getFullYear()
): Promise<ComprehensiveReportStats> {
  const emptyStats: ComprehensiveReportStats = {
    total_incoming: 0,
    total_outgoing: 0,
    total_all: 0,
    total_this_year: 0,
    total_this_month: 0,
    total_verified: 0,
    total_need_review: 0,
    total_draft: 0,
    total_archived: 0,
    categories_breakdown: [],
    natures_breakdown: [],
    monthly_trends: [
      { month: 1, month_name: 'Januari', incoming: 0, outgoing: 0 },
      { month: 2, month_name: 'Februari', incoming: 0, outgoing: 0 },
      { month: 3, month_name: 'Maret', incoming: 0, outgoing: 0 },
      { month: 4, month_name: 'April', incoming: 0, outgoing: 0 },
      { month: 5, month_name: 'Mei', incoming: 0, outgoing: 0 },
      { month: 6, month_name: 'Juni', incoming: 0, outgoing: 0 },
      { month: 7, month_name: 'Juli', incoming: 0, outgoing: 0 },
      { month: 8, month_name: 'Agustus', incoming: 0, outgoing: 0 },
      { month: 9, month_name: 'September', incoming: 0, outgoing: 0 },
      { month: 10, month_name: 'Oktober', incoming: 0, outgoing: 0 },
      { month: 11, month_name: 'November', incoming: 0, outgoing: 0 },
      { month: 12, month_name: 'Desember', incoming: 0, outgoing: 0 },
    ],
  };

  if (!isSupabaseConfigured()) return emptyStats;

  try {
    // Ambil seluruh data surat aktif tahun berjalan
    const { data: yearLetters, error: yearErr } = await supabase
      .from('letters')
      .select('id, letter_type, status, letter_nature, category_id, letter_date, received_date')
      .gte('letter_date', `${selectedYear}-01-01`)
      .lte('letter_date', `${selectedYear}-12-31`)
      .is('deleted_at', null);

    if (yearErr) {
      console.warn('Gagal memuat rekap tahunan:', yearErr.message);
    }

    // Ambil data kategori master
    const categories = await getCategories();

    // Hitung counts
    const letters = yearLetters || [];
    let incomingCount = 0;
    let outgoingCount = 0;
    let verifiedCount = 0;
    let reviewCount = 0;
    let draftCount = 0;
    let archivedCount = 0;

    const currentMonthNum = new Date().getMonth() + 1;
    let thisMonthCount = 0;

    const monthlyTrends = emptyStats.monthly_trends.map((m) => ({ ...m }));
    const natureMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();

    for (const l of letters) {
      if (l.letter_type === 'INCOMING') incomingCount++;
      if (l.letter_type === 'OUTGOING') outgoingCount++;

      if (l.status === 'VERIFIED') verifiedCount++;
      else if (l.status === 'NEED_REVIEW') reviewCount++;
      else if (l.status === 'DRAFT') draftCount++;
      else if (l.status === 'ARCHIVED') archivedCount++;

      // Bulan surat
      const letterDate = new Date(l.letter_date);
      if (!isNaN(letterDate.getTime())) {
        const mIdx = letterDate.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          if (l.letter_type === 'INCOMING') {
            monthlyTrends[mIdx].incoming++;
          } else {
            monthlyTrends[mIdx].outgoing++;
          }
        }
        if (letterDate.getMonth() + 1 === currentMonthNum) {
          thisMonthCount++;
        }
      }

      // Sifat surat
      const nat = l.letter_nature?.trim() || 'Biasa';
      natureMap.set(nat, (natureMap.get(nat) || 0) + 1);

      // Kategori surat
      if (l.category_id) {
        categoryMap.set(l.category_id, (categoryMap.get(l.category_id) || 0) + 1);
      }
    }

    const categoriesBreakdown: { category_id: string; category_name: string; count: number }[] =
      categories.map((c) => ({
        category_id: c.id,
        category_name: c.name,
        count: categoryMap.get(c.id) || 0,
      }));

    const naturesBreakdown: { nature: string; count: number }[] = Array.from(
      natureMap.entries()
    ).map(([nature, count]) => ({
      nature,
      count,
    }));

    return {
      total_incoming: incomingCount,
      total_outgoing: outgoingCount,
      total_all: letters.length,
      total_this_year: letters.length,
      total_this_month: thisMonthCount,
      total_verified: verifiedCount,
      total_need_review: reviewCount,
      total_draft: draftCount,
      total_archived: archivedCount,
      categories_breakdown: categoriesBreakdown,
      natures_breakdown: naturesBreakdown,
      monthly_trends: monthlyTrends,
    };
  } catch (err) {
    console.error('Error getComprehensiveReportStats:', err);
    return emptyStats;
  }
}

/**
 * Menyimpan dokumen PDF laporan ke arsip (Requirement Q)
 */
export async function saveReportArchive(params: {
  report_type: 'JURNAL_SURAT_MASUK' | 'JURNAL_SURAT_KELUAR' | 'REKAP_TAHUNAN';
  title: string;
  period_start: string;
  period_end: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  storage_bucket?: string;
  total_records?: number;
  created_by?: string | null;
}): Promise<{ success: boolean; data?: ReportArchive; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase belum terkonfigurasi.' };
  }

  try {
    const { data, error } = await supabase
      .from('report_archives')
      .insert({
        report_type: params.report_type,
        title: params.title,
        period_start: params.period_start,
        period_end: params.period_end,
        file_name: params.file_name,
        file_path: params.file_path,
        file_size: params.file_size || 0,
        storage_bucket: params.storage_bucket || 'letter-files',
        total_records: params.total_records || 0,
        created_by: params.created_by,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as ReportArchive };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menyimpan arsip laporan' };
  }
}

/**
 * Mengambil riwayat arsip berkas laporan PDF
 */
export async function getReportArchives(): Promise<ReportArchive[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const { data, error } = await supabase
      .from('report_archives')
      .select(`
        *,
        creator:profiles!report_archives_created_by_fkey(full_name, email, role)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.warn('Gagal memuat arsip laporan:', error.message);
      return [];
    }

    return (data as ReportArchive[]) || [];
  } catch (err) {
    console.error('Error getReportArchives:', err);
    return [];
  }
}

/**
 * Mencatat audit aktivitas laporan (Requirement R)
 * PRINT_JOURNAL, EXPORT_JOURNAL_PDF, EXPORT_JOURNAL_EXCEL, ARCHIVE_JOURNAL
 */
export async function logReportAction(
  action: 'PRINT_JOURNAL' | 'EXPORT_JOURNAL_PDF' | 'EXPORT_JOURNAL_EXCEL' | 'ARCHIVE_JOURNAL',
  details: {
    reportType: string;
    periodStart?: string;
    periodEnd?: string;
    totalRecords?: number;
    fileName?: string;
  },
  userId: string | null
): Promise<void> {
  const periodText =
    details.periodStart && details.periodEnd
      ? `${details.periodStart} s.d. ${details.periodEnd}`
      : 'Semua Periode';

  let actionDesc = '';
  switch (action) {
    case 'PRINT_JOURNAL':
      actionDesc = `Mencetak langsung ${details.reportType} periode ${periodText} (${details.totalRecords || 0} surat)`;
      break;
    case 'EXPORT_JOURNAL_PDF':
      actionDesc = `Mengunduh berkas PDF ${details.reportType} periode ${periodText} (${details.totalRecords || 0} surat)`;
      break;
    case 'EXPORT_JOURNAL_EXCEL':
      actionDesc = `Mengekspor berkas Excel ${details.reportType} periode ${periodText} (${details.totalRecords || 0} surat)`;
      break;
    case 'ARCHIVE_JOURNAL':
      actionDesc = `Menyimpan arsip dokumen PDF ${details.reportType} (${details.fileName || 'laporan.pdf'})`;
      break;
  }

  await logLetterAction(
    null,
    action,
    actionDesc,
    null,
    {
      report_type: details.reportType,
      period_start: details.periodStart,
      period_end: details.periodEnd,
      total_records: details.totalRecords,
      file_name: details.fileName,
      timestamp: new Date().toISOString(),
    },
    userId
  );
}
