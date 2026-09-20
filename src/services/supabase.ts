import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

// Optional local storage fallback for live test credentials without requiring server rebuild
const LOCAL_STORAGE_URL_KEY = 'sipas_bti_custom_supabase_url';
const LOCAL_STORAGE_ANON_KEY = 'sipas_bti_custom_supabase_anon';

export function getActiveSupabaseConfig(): { url: string; anonKey: string } {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_URL_KEY) : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_ANON_KEY) : null;

  const url = (localUrl && localUrl.trim()) || envSupabaseUrl;
  const anonKey = (localKey && localKey.trim()) || envSupabaseAnonKey;

  return { url, anonKey };
}

export function saveCustomSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_URL_KEY, url.trim());
    localStorage.setItem(LOCAL_STORAGE_ANON_KEY, anonKey.trim());
    // Reload to apply new client instance
    window.location.reload();
  }
}

export function clearCustomSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCAL_STORAGE_URL_KEY);
    localStorage.removeItem(LOCAL_STORAGE_ANON_KEY);
    window.location.reload();
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getActiveSupabaseConfig();
  return Boolean(
    url &&
    anonKey &&
    url.startsWith('https://') &&
    url.includes('.supabase.co') &&
    anonKey.length > 20
  );
}

// Fallback dummy client if credentials are not configured yet, so the app renders instruction UI without unhandled exceptions
const dummyUrl = 'https://placeholder-project.supabase.co';
const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

const initialConfig = getActiveSupabaseConfig();
const validUrl = isSupabaseConfigured() ? initialConfig.url : dummyUrl;
const validKey = isSupabaseConfigured() ? initialConfig.anonKey : dummyKey;

export const supabase: SupabaseClient = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Private Storage Helper for 'letter-files'
export const STORAGE_BUCKET = 'letter-files';

// Supported file MIME types and extensions for letter attachments (Phase 2 requirement)
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export async function uploadLetterFile(
  file: File,
  letterId: string,
  letterType: 'INCOMING' | 'OUTGOING' = 'INCOMING',
  letterDate?: string
): Promise<{ path: string; size: number; name: string; type: string } | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase belum terkonfigurasi.');
  }

  // 1. Validasi Ukuran File (Maks 20 MB)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `Ukuran file (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal yang diizinkan (20 MB).`
    );
  }

  // 2. Validasi Format Berkas (PDF, Word DOC/DOCX, JPG, JPEG, PNG, WEBP)
  const fileExt = (file.name.split('.').pop() || '').toLowerCase();
  const isValidExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'].includes(fileExt);
  const isValidMime = file.type ? ALLOWED_MIME_TYPES.includes(file.type.toLowerCase()) : false;

  if (!isValidExt && !isValidMime) {
    throw new Error(
      'Format file tidak didukung. Sistem menerima berkas PDF, Word (DOC, DOCX), JPG, JPEG, PNG, atau WEBP.'
    );
  }

  // 3. Tentukan Struktur Path: incoming/YYYY/MM/ atau outgoing/YYYY/MM/
  const targetDate = letterDate ? new Date(letterDate) : new Date();
  const validDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const typeFolder = letterType === 'INCOMING' ? 'incoming' : 'outgoing';

  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const filePath = `${typeFolder}/${year}/${month}/${letterId}_${Date.now()}_${cleanFileName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Gagal mengunggah file surat ke Supabase Storage:', error);
    throw error;
  }

  // Resolusi MIME type yang tepat
  let resolvedType = file.type;
  if (!resolvedType || resolvedType === 'application/octet-stream') {
    if (fileExt === 'docx') resolvedType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (fileExt === 'doc') resolvedType = 'application/msword';
    else if (fileExt === 'pdf') resolvedType = 'application/pdf';
    else if (fileExt === 'png') resolvedType = 'image/png';
    else if (fileExt === 'webp') resolvedType = 'image/webp';
    else if (fileExt === 'jpg' || fileExt === 'jpeg') resolvedType = 'image/jpeg';
  }

  return {
    path: data.path,
    size: file.size,
    name: file.name,
    type: resolvedType || 'application/octet-stream',
  };
}

export async function getSignedFileUrl(
  filePath: string,
  expiresInSeconds: number = 3600,
  bucket: string = STORAGE_BUCKET
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error('Gagal membuat signed URL untuk arsip surat:', error);
    return null;
  }

  return data?.signedUrl || null;
}

export function getFilePublicUrl(filePath: string, bucket: string = STORAGE_BUCKET): string {
  if (!isSupabaseConfigured() || !filePath) return '';
  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data?.publicUrl || '';
}

export async function deleteLetterFileFromStorage(filePath: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false;
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([filePath]);

  if (error) {
    console.error('Gagal menghapus file dari Supabase Storage:', error);
    return false;
  }

  return true;
}
