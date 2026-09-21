import { GoogleGenAI, Type } from '@google/genai';
import * as mammoth from 'mammoth';

export interface LetterAIExtraction {
  jenis_surat: 'INCOMING' | 'OUTGOING' | null;
  nomor_surat: string | null;
  tanggal_surat: string | null;
  tanggal_diterima: string | null;
  asal_surat: string | null;
  tujuan_surat: string | null;
  perihal: string | null;
  sifat_surat: string | null;
  lampiran: string | null;
  penandatangan: string | null;
  jabatan_penandatangan: string | null;
  ringkasan: string | null;
  kata_kunci: string[];
  klasifikasi: string | null;
  tanggal_kegiatan: string | null;
  tempat_kegiatan: string | null;
}

export interface ExtractionRequest {
  fileBase64: string; // Base64 string of file content (without data URL prefix or with it stripped)
  mimeType: string;   // 'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'
  fileName?: string;
  categories?: string[];
  userHintType?: 'INCOMING' | 'OUTGOING';
}

export interface ExtractionResponse {
  success: boolean;
  data?: LetterAIExtraction;
  rawResponse?: string;
  processingTime?: number;
  modelName: string;
  promptVersion: string;
  error?: string;
}

const SYSTEM_INSTRUCTION = `Kamu adalah AI Document Extraction Assistant untuk administrasi surat SMP Bhinneka Tunggal Ika.

Baca dokumen surat yang diberikan.

Ekstrak hanya informasi yang benar-benar terdapat dalam dokumen.

Jangan mengarang.
Jangan menebak.
Jika informasi tidak tersedia atau tidak terbaca dengan yakin, gunakan null.

Pertahankan nomor surat persis seperti dokumen.

Tanggal dikembalikan dalam format YYYY-MM-DD.

Ringkasan harus objektif dan singkat.

Klasifikasi harus mengikuti master klasifikasi yang diberikan aplikasi.

Kembalikan JSON sesuai schema.`;

const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

export function checkGeminiConfigured(): { configured: boolean; message: string } {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    return {
      configured: false,
      message: 'GEMINI_API_KEY belum dikonfigurasi di Secrets Google AI Studio.',
    };
  }
  return {
    configured: true,
    message: 'Engine Google Gemini siap digunakan.',
  };
}

export function formatGeminiError(error: any): string {
  if (!error) return 'Dokumen belum dapat diproses.';
  const rawMsg = error.message || String(error);

  if (
    rawMsg.includes('503') ||
    rawMsg.includes('high demand') ||
    rawMsg.includes('UNAVAILABLE') ||
    rawMsg.includes('overloaded')
  ) {
    return 'Layanan Google Gemini sedang mengalami antrean server sementara (High Demand / Kode 503). Silakan klik "Coba Lagi" dalam beberapa detik, atau gunakan tombol "Input Manual".';
  }

  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return 'Batas kuota harian/menit AI tercapai sementara (Kode 429). Silakan tunggu sebentar dan klik "Coba Lagi", atau lanjutkan dengan "Input Manual".';
  }

  if (
    rawMsg.includes('GEMINI_API_KEY') ||
    rawMsg.includes('apiKey') ||
    rawMsg.includes('API_KEY_INVALID') ||
    rawMsg.includes('API key not valid')
  ) {
    return 'Kunci GEMINI_API_KEY server belum diatur atau belum valid di panel Secrets. Silakan tambahkan GEMINI_API_KEY di menu Settings > Secrets AI Studio, atau gunakan tombol "Input Manual" untuk langsung mengisi formulir surat.';
  }

  if (
    rawMsg.includes('INVALID_ARGUMENT') ||
    rawMsg.includes('Request contains an invalid argument')
  ) {
    return 'Format dokumen atau isi berkas tidak dapat diproses oleh AI. Pastikan berkas berupa gambar yang jelas (JPG/PNG), PDF yang valid, atau dokumen Word (.docx). Anda dapat menggunakan "Input Manual" untuk melanjutkan.';
  }

  if (rawMsg.includes('Payload Too Large') || rawMsg.includes('request entity too large')) {
    return 'Ukuran berkas terlalu besar. Gunakan berkas di bawah 10 MB atau gunakan tombol "Input Manual".';
  }

  return rawMsg;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.length < 10) {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi di environment server atau masih menggunakan nilai placeholder. Silakan buka menu Settings > Secrets di Google AI Studio untuk memasukkan GEMINI_API_KEY Anda.'
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function extractLetterFromDocument(
  req: ExtractionRequest
): Promise<ExtractionResponse> {
  const startTime = Date.now();
  let selectedModel = CANDIDATE_MODELS[0];
  const promptVersion = 'v1.0-sipas-bti';

  try {
    const ai = getGeminiClient();

    // Clean base64 string if data URL prefix exists
    let cleanBase64 = req.fileBase64 || '';
    if (cleanBase64.includes('base64,')) {
      cleanBase64 = cleanBase64.split('base64,')[1];
    }
    cleanBase64 = cleanBase64.trim();

    if (!cleanBase64) {
      throw new Error('Berkas dokumen kosong atau tidak terbaca dengan benar.');
    }

    // Normalize MIME type and file format
    let mimeType = (req.mimeType || '').toLowerCase().trim();
    const fileNameLower = (req.fileName || '').toLowerCase();

    // Auto-detect MIME type from Base64 magic bytes if generic or missing
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (cleanBase64.startsWith('JVBERi0')) mimeType = 'application/pdf';
      else if (cleanBase64.startsWith('/9j/')) mimeType = 'image/jpeg';
      else if (cleanBase64.startsWith('iVBORw')) mimeType = 'image/png';
      else if (cleanBase64.startsWith('UklGR')) mimeType = 'image/webp';
      else if (cleanBase64.startsWith('UEsDB')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    const isDocx =
      mimeType.includes('wordprocessingml') ||
      mimeType.includes('vnd.openxmlformats') ||
      fileNameLower.endsWith('.docx');
    const isDoc =
      mimeType.includes('msword') ||
      (fileNameLower.endsWith('.doc') && !fileNameLower.endsWith('.docx'));

    if (mimeType.includes('pdf') || fileNameLower.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (mimeType.includes('png') || fileNameLower.endsWith('.png')) mimeType = 'image/png';
    else if (mimeType.includes('webp') || fileNameLower.endsWith('.webp')) mimeType = 'image/webp';
    else if (
      mimeType.includes('jpg') ||
      mimeType.includes('jpeg') ||
      fileNameLower.endsWith('.jpg') ||
      fileNameLower.endsWith('.jpeg')
    ) {
      mimeType = 'image/jpeg';
    }

    const categoryContext =
      req.categories && req.categories.length > 0
        ? `\nDaftar master klasifikasi yang tersedia di SMP Bhinneka Tunggal Ika: ${req.categories.join(', ')}. Jika perihal sesuai dengan salah satu klasifikasi ini, pilih nama klasifikasi yang paling tepat. Jika tidak yakin, kembalikan null.`
        : '';

    const userHintContext = req.userHintType
      ? `\nPetunjuk konteks jenis surat saat ini: ${
          req.userHintType === 'INCOMING'
            ? 'Surat Masuk (diterima oleh SMP Bhinneka Tunggal Ika)'
            : 'Surat Keluar (diterbitkan oleh SMP Bhinneka Tunggal Ika)'
        }. Verifikasi apakah isi dokumen sesuai dengan petunjuk ini.`
      : '';

    const promptText = `Silakan baca dokumen surat resmi ini dengan sangat cermat dan teliti.
Ekstrak semua informasi metadata ke dalam format JSON yang telah ditentukan.${categoryContext}${userHintContext}

PENTING:
1. Pertahankan nomor surat apa adanya (huruf besar/kecil, garis miring, titik).
2. Jika ada stempel tanggal penerimaan surat (agenda masuk), gunakan untuk tanggal_diterima.
3. Ekstrak tanggal surat dalam format YYYY-MM-DD.
4. Identifikasi apakah surat ditujukan ke SMP Bhinneka Tunggal Ika (jenis_surat: "INCOMING") atau diterbitkan oleh SMP Bhinneka Tunggal Ika ke pihak luar (jenis_surat: "OUTGOING").
5. Jangan pernah mengarang informasi apapun jika tidak tertulis jelas pada dokumen (gunakan null).`;

    let contents: any;

    if (isDocx || isDoc) {
      // Ekstraksi teks dari berkas Microsoft Word
      let docText = '';
      try {
        const docBuffer = Buffer.from(cleanBase64, 'base64');
        if (isDocx) {
          const res = await mammoth.extractRawText({ buffer: docBuffer });
          docText = res.value || '';
        } else {
          // File .doc biner Word 97-2003: ekstrak string teks yang dapat dibaca
          const rawStr = docBuffer.toString('binary');
          const printableChunks = rawStr.match(/[\x20-\x7E\r\n]{4,}/g);
          docText = printableChunks ? printableChunks.join(' ') : docBuffer.toString('utf-8');
        }
      } catch (wordParseErr) {
        console.warn('Gagal membaca isi berkas Word via mammoth/buffer:', wordParseErr);
      }

      contents = {
        parts: [
          {
            text: `Berikut adalah seluruh isi teks dari dokumen surat resmi (berformat Microsoft Word: ${
              req.fileName || 'Dokumen.docx'
            }):\n\n--- AWAL ISI SURAT ---\n${docText || '(Dokumen kosong atau teks tidak dapat diurai otomatis)'}\n--- AKHIR ISI SURAT ---\n\n${promptText}`,
          },
        ],
      };
    } else {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          {
            text: promptText,
          },
        ],
      };
    }

    let response: any = null;
    let lastError: any = null;

    // Multi-model resilience: Try candidate models with backoff retry on temporary spikes (503 / 429)
    for (const candidateModel of CANDIDATE_MODELS) {
      selectedModel = candidateModel;
      let attempt = 0;
      const maxAttempts = 2;

      while (attempt < maxAttempts) {
        attempt++;
        try {
          response = await ai.models.generateContent({
            model: candidateModel,
            contents,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  jenis_surat: {
                    type: Type.STRING,
                    description: 'INCOMING jika surat diterima SMP BTI, OUTGOING jika diterbitkan SMP BTI, atau null jika ragu',
                  },
                  nomor_surat: {
                    type: Type.STRING,
                    description: 'Nomor resmi surat persis seperti tertera di dokumen, atau null',
                  },
                  tanggal_surat: {
                    type: Type.STRING,
                    description: 'Tanggal surat format YYYY-MM-DD, atau null',
                  },
                  tanggal_diterima: {
                    type: Type.STRING,
                    description: 'Tanggal diterima / stempel agenda format YYYY-MM-DD, atau null',
                  },
                  asal_surat: {
                    type: Type.STRING,
                    description: 'Instansi / pihak pengirim surat, atau null',
                  },
                  tujuan_surat: {
                    type: Type.STRING,
                    description: 'Pihak / instansi penerima surat, atau null',
                  },
                  perihal: {
                    type: Type.STRING,
                    description: 'Perihal atau hal pokok surat, atau null',
                  },
                  sifat_surat: {
                    type: Type.STRING,
                    description: 'Biasa, Penting, Segera, Rahasia, Sangat Rahasia, atau Kilat',
                  },
                  lampiran: {
                    type: Type.STRING,
                    description: 'Keterangan jumlah lampiran seperti "1 Berkas" atau null jika tidak ada lampiran',
                  },
                  penandatangan: {
                    type: Type.STRING,
                    description: 'Nama pejabat yang menandatangani dokumen surat, atau null',
                  },
                  jabatan_penandatangan: {
                    type: Type.STRING,
                    description: 'Jabatan pejabat penandatangan, atau null',
                  },
                  ringkasan: {
                    type: Type.STRING,
                    description: 'Ringkasan objektif dan padat mengenai pokok isi surat',
                  },
                  kata_kunci: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Array kata kunci terkait surat',
                  },
                  klasifikasi: {
                    type: Type.STRING,
                    description: 'Kategori klasifikasi dari master atau null jika tidak yakin',
                  },
                  tanggal_kegiatan: {
                    type: Type.STRING,
                    description: 'Tanggal pelaksanaan kegiatan jika dicantumkan, format YYYY-MM-DD atau null',
                  },
                  tempat_kegiatan: {
                    type: Type.STRING,
                    description: 'Tempat atau lokasi pelaksanaan kegiatan jika ada, atau null',
                  },
                },
                required: [
                  'jenis_surat',
                  'nomor_surat',
                  'tanggal_surat',
                  'asal_surat',
                  'tujuan_surat',
                  'perihal',
                  'ringkasan',
                  'kata_kunci',
                ],
              },
            },
          });

          if (response && response.text) {
            break;
          }
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || String(err);
          const isTransient =
            msg.includes('503') ||
            msg.includes('high demand') ||
            msg.includes('UNAVAILABLE') ||
            msg.includes('429') ||
            msg.includes('RESOURCE_EXHAUSTED') ||
            msg.includes('ECONNRESET') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('overloaded');

          console.warn(`[GeminiExtractor] Model '${candidateModel}' (attempt ${attempt}/${maxAttempts}) failed:`, msg);

          if (isTransient && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
            continue;
          }
          break;
        }
      }

      if (response && response.text) {
        break;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Tidak mendapatkan respons dari engine AI Gemini.');
    }

    const rawText = response.text || '';
    const processingTime = Number(((Date.now() - startTime) / 1000).toFixed(2));

    // Parse JSON safely
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(cleanJson);

    // Normalize result structure ensuring compliant null defaults
    const structuredData: LetterAIExtraction = {
      jenis_surat:
        parsed.jenis_surat === 'INCOMING' || parsed.jenis_surat === 'OUTGOING'
          ? parsed.jenis_surat
          : req.userHintType || null,
      nomor_surat: parsed.nomor_surat && String(parsed.nomor_surat).trim() !== '' ? String(parsed.nomor_surat).trim() : null,
      tanggal_surat: parsed.tanggal_surat && String(parsed.tanggal_surat).trim() !== '' ? String(parsed.tanggal_surat).trim() : null,
      tanggal_diterima: parsed.tanggal_diterima && String(parsed.tanggal_diterima).trim() !== '' ? String(parsed.tanggal_diterima).trim() : null,
      asal_surat: parsed.asal_surat && String(parsed.asal_surat).trim() !== '' ? String(parsed.asal_surat).trim() : null,
      tujuan_surat: parsed.tujuan_surat && String(parsed.tujuan_surat).trim() !== '' ? String(parsed.tujuan_surat).trim() : null,
      perihal: parsed.perihal && String(parsed.perihal).trim() !== '' ? String(parsed.perihal).trim() : null,
      sifat_surat: parsed.sifat_surat && String(parsed.sifat_surat).trim() !== '' ? String(parsed.sifat_surat).trim() : null,
      lampiran: parsed.lampiran && String(parsed.lampiran).trim() !== '' ? String(parsed.lampiran).trim() : null,
      penandatangan: parsed.penandatangan && String(parsed.penandatangan).trim() !== '' ? String(parsed.penandatangan).trim() : null,
      jabatan_penandatangan: parsed.jabatan_penandatangan && String(parsed.jabatan_penandatangan).trim() !== '' ? String(parsed.jabatan_penandatangan).trim() : null,
      ringkasan: parsed.ringkasan && String(parsed.ringkasan).trim() !== '' ? String(parsed.ringkasan).trim() : null,
      kata_kunci: Array.isArray(parsed.kata_kunci)
        ? parsed.kata_kunci.filter((k: unknown) => typeof k === 'string' && k.trim().length > 0)
        : [],
      klasifikasi: parsed.klasifikasi && String(parsed.klasifikasi).trim() !== '' ? String(parsed.klasifikasi).trim() : null,
      tanggal_kegiatan: parsed.tanggal_kegiatan && String(parsed.tanggal_kegiatan).trim() !== '' ? String(parsed.tanggal_kegiatan).trim() : null,
      tempat_kegiatan: parsed.tempat_kegiatan && String(parsed.tempat_kegiatan).trim() !== '' ? String(parsed.tempat_kegiatan).trim() : null,
    };

    return {
      success: true,
      data: structuredData,
      rawResponse: rawText,
      processingTime,
      modelName: selectedModel,
      promptVersion,
    };
  } catch (error: any) {
    const processingTime = Number(((Date.now() - startTime) / 1000).toFixed(2));
    console.error('Error during Gemini document extraction:', error);

    return {
      success: false,
      error: formatGeminiError(error),
      processingTime,
      modelName: selectedModel,
      promptVersion,
    };
  }
}
