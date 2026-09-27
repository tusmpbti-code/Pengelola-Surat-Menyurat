import { supabase, isSupabaseConfigured } from './supabase';
import { LetterAIExtraction, LetterAIResult } from '../types';
import { logLetterAction } from './letters';

export type AIProgressStep =
  | 'IDLE'
  | 'UPLOADING'
  | 'READING'
  | 'ANALYZING'
  | 'EXTRACTING'
  | 'COMPLETED'
  | 'ERROR';

export interface ExtractWithGeminiParams {
  file: File;
  categories?: string[];
  userHintType?: 'INCOMING' | 'OUTGOING';
  onProgress?: (step: AIProgressStep, message: string) => void;
}

export interface ExtractWithGeminiResponse {
  success: boolean;
  data?: LetterAIExtraction;
  rawResponse?: string;
  processingTime?: number;
  modelName: string;
  promptVersion: string;
  error?: string;
}

/**
 * Mengubah file ke base64 (string murni tanpa prefix data url)
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data:image/...;base64, prefix
      const base64Data = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function humanizeAIError(err: unknown): string {
  if (!err) return 'Dokumen belum dapat diproses.';
  const raw = typeof err === 'string' ? err : (err as any)?.message || String(err);
  
  if (
    raw.includes('503') ||
    raw.includes('high demand') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('overloaded')
  ) {
    return 'Layanan Google Gemini sedang mengalami antrean server sementara (High Demand / Kode 503). Silakan klik tombol "Coba Lagi" dalam beberapa detik atau gunakan "Input Manual".';
  }
  
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Batas kuota permintaan AI tercapai sementara (Kode 429). Silakan tunggu sebentar dan klik "Coba Lagi", atau lanjutkan dengan "Input Manual".';
  }
  
  if (
    raw.includes('API_KEY') ||
    raw.includes('API_KEY_INVALID') ||
    raw.includes('API key not valid')
  ) {
    return 'Kunci GEMINI_API_KEY server belum dikonfigurasi. Jika membuka di Google AI Studio, pastikan kunci aktif di menu Settings > Secrets. Jika membuka di hosting mandiri (Netlify/Vercel/server), tambahkan environment variable GEMINI_API_KEY di dashboard hosting Anda, atau gunakan tombol "Input Manual" di bawah untuk langsung mengisi data surat.';
  }

  if (
    raw.includes('INVALID_ARGUMENT') ||
    raw.includes('Request contains an invalid argument')
  ) {
    return 'Format dokumen atau foto tidak dapat diproses oleh AI. Pastikan berkas dokumen tajam dan jelas (PDF, Word DOCX, atau Foto JPG/PNG). Silakan gunakan "Input Manual" untuk melanjutkan.';
  }

  if (raw.includes('404') || raw.includes('Failed to fetch') || raw.includes('NetworkError')) {
    return 'Koneksi ke endpoint pemrosesan server terputus. Silakan klik "Coba Lagi" atau gunakan "Input Manual".';
  }

  return raw;
}

export async function checkAIServerStatus(): Promise<{
  configured: boolean;
  message: string;
  activeModel?: string;
}> {
  try {
    const resp = await fetch('/api/ai-status');
    if (resp.ok) {
      const data = await resp.json();
      return {
        configured: Boolean(data.configured),
        message: data.message || 'Status AI diperoleh.',
        activeModel: data.activeModel || 'gemini-3.8-flash',
      };
    }
  } catch {
    // ignore
  }
  return {
    configured: false,
    message: 'Tidak dapat menghubungi endpoint status AI.',
  };
}

/**
 * Memanggil endpoint backend AI (Vite proxy / Express / Netlify Function)
 * Menjaga secret API key tetap 100% di server side!
 */
export async function extractLetterWithGemini(
  params: ExtractWithGeminiParams
): Promise<ExtractWithGeminiResponse> {
  const { file, categories = [], userHintType, onProgress } = params;

  try {
    // 1. Mengunggah...
    onProgress?.('UPLOADING', 'Mengunggah dokumen surat ke engine pemrosesan...');

    const base64String = await fileToBase64(file);

    // 2. Membaca dokumen...
    onProgress?.('READING', 'Membaca dokumen...');

    // Small delay to provide responsive visual feedback across steps
    await new Promise((r) => setTimeout(r, 300));

    // 3. Menganalisis...
    onProgress?.('ANALYZING', 'Menganalisis dokumen...');

    const payload = {
      fileBase64: base64String,
      mimeType: file.type || 'application/pdf',
      fileName: file.name,
      categories,
      userHintType,
    };

    // Try primary /api/extract-letter first, then fallback to /.netlify/functions/extract-letter
    const endpoints = ['/api/extract-letter', '/.netlify/functions/extract-letter'];
    let lastError: Error | null = null;
    let responseData: ExtractWithGeminiResponse | null = null;

    for (const endpoint of endpoints) {
      try {
        onProgress?.('EXTRACTING', 'Mengekstraksi metadata dengan AI...');

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (resp.ok) {
          const json = await resp.json();
          responseData = json;
          break;
        } else {
          // If 404 or other HTTP error, parse error if possible
          let errText = `Server mengembalikan status ${resp.status}`;
          try {
            const errJson = await resp.json();
            if (errJson.error) errText = errJson.error;
          } catch {
            // ignore JSON parse fail
          }
          lastError = new Error(errText);
        }
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!responseData) {
      throw lastError || new Error('Dokumen belum dapat diproses.');
    }

    if (!responseData.success || !responseData.data) {
      throw new Error(responseData.error || 'Dokumen belum dapat diproses.');
    }

    // 5. Selesai.
    onProgress?.('COMPLETED', 'Selesai.');
    return responseData;
  } catch (error: any) {
    console.error('Error extractLetterWithGemini:', error);
    const friendlyMsg = humanizeAIError(error);
    onProgress?.('ERROR', friendlyMsg);
    return {
      success: false,
      error: friendlyMsg,
      modelName: 'gemini-3.8-flash',
      promptVersion: 'v1.0-sipas-bti',
    };
  }
}

/**
 * Menyimpan hasil ekstraksi AI ke tabel `letter_ai_results` di Supabase
 * dan mencatat ke audit log `AI_PROCESSING`
 */
export async function saveLetterAIResult(params: {
  letterId: string;
  modelName: string;
  promptVersion: string;
  rawResponse?: string;
  structuredResponse: LetterAIExtraction;
  processingTime?: number;
  userId?: string;
}): Promise<{ success: boolean; error: string | null; data?: LetterAIResult }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase belum terkonfigurasi' };
  }

  try {
    const { data, error } = await supabase
      .from('letter_ai_results')
      .insert({
        letter_id: params.letterId,
        model_name: params.modelName,
        prompt_version: params.promptVersion,
        raw_response: params.rawResponse || null,
        structured_response: params.structuredResponse,
        processing_time: params.processingTime || null,
      })
      .select()
      .single();

    if (error) {
      console.warn('Gagal menyimpan letter_ai_results:', error.message);
      return { success: false, error: error.message };
    }

    // Catat ke audit log (AI_PROCESSING)
    await logLetterAction(
      params.letterId,
      'AI_PROCESSING',
      `Ekstraksi informasi dokumen berhasil menggunakan Google Gemini (${params.modelName}) dalam ${params.processingTime || 0} detik`,
      null,
      params.structuredResponse as unknown as Record<string, unknown>,
      params.userId || null
    );

    return { success: true, error: null, data: data as LetterAIResult };
  } catch (err: any) {
    return { success: false, error: err.message || 'Gagal menyimpan hasil AI' };
  }
}

/**
 * Mengambil rekam hasil AI yang tersimpan untuk suatu surat
 */
export async function getLetterAIResult(letterId: string): Promise<LetterAIResult | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('letter_ai_results')
      .select('*')
      .eq('letter_id', letterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Gagal mengambil riwayat AI:', error.message);
      return null;
    }

    return (data as LetterAIResult) || null;
  } catch (err) {
    console.error('Error getLetterAIResult:', err);
    return null;
  }
}
