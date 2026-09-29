/**
 * Utilitas untuk mengurutkan string (khususnya nomor surat dan nomor agenda)
 * secara cerdas / natural (mendukung format angka, romawi, slash, dan teks).
 * Contoh urutan natural:
 * - "01/SMP/2026", "2/SMP/2026", "10/SMP/2026"
 * Menangani perbandingan nilai null/undefined dengan aman.
 */

export function compareLetterNumbers(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: 'asc' | 'desc' = 'asc'
): number {
  const strA = (a ?? '').trim();
  const strB = (b ?? '').trim();

  // Jika salah satu kosong/null
  if (!strA && !strB) return 0;
  if (!strA) return direction === 'asc' ? 1 : -1;
  if (!strB) return direction === 'asc' ? -1 : 1;

  // Gunakan Intl.Collator dengan opsi numeric: true untuk perbandingan natural
  const collator = new Intl.Collator('id-ID', {
    numeric: true,
    sensitivity: 'base',
  });

  const result = collator.compare(strA, strB);
  return direction === 'asc' ? result : -result;
}

/**
 * Format string aman dari nilai null/undefined
 */
export function safeString(val: unknown, fallback: string = '-'): string {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  if (str === '' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return fallback;
  }
  return str;
}

/**
 * Membersihkan nilai string yang dapat bernilai null/kosong.
 * Mencegah string literal "null", "undefined", atau whitespace tersimpan ke PostgreSQL.
 */
export function sanitizeNullableString(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (
    !str ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'none'
  ) {
    return null;
  }
  return str;
}

/**
 * Memastikan nilai tanggal valid untuk tipe DATE di PostgreSQL (format YYYY-MM-DD)
 * Menolak string "null", "undefined", string kosong, atau invalid date dan mengembalikan null.
 */
export function sanitizeDate(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  if (
    !str ||
    str.toLowerCase() === 'null' ||
    str.toLowerCase() === 'undefined' ||
    str.toLowerCase() === '-' ||
    str.toLowerCase() === 'n/a' ||
    str.toLowerCase() === 'none' ||
    str.toLowerCase() === 'nil'
  ) {
    return null;
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return str;
  }

  // Format DD-MM-YYYY atau DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const isoStr = `${year}-${month}-${day}`;
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) return isoStr;
  }

  // Coba parse tanggal umum
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // abaikan jika gagal
  }

  return null;
}

/**
 * Mengekstrak nomor urut / indeks dari format nomor surat kedinasan Indonesia.
 * Contoh:
 * - "421.3/024/SMP-BTI/2026" => "024"
 * - "015/DISDIK/IV/2026" => "015"
 * - "B-104/KEMENAG/03/2026" => "104"
 * - "No. 008/OSIS/2026" => "008"
 * - "820/12/TU/2026" => "012"
 */
export function extractSequenceFromLetterNumber(
  letterNumber: string | null | undefined
): string | null {
  if (!letterNumber) return null;
  const cleaned = letterNumber.trim();
  if (!cleaned) return null;

  // Split berdasarkan separator umum surat dinas: '/', '-', '.', ' '
  const segments = cleaned.split(/[\/\s]+/);

  for (const seg of segments) {
    const trimmed = seg.trim();
    // Abaikan jika tahun 4 digit (misal 1990 s/d 2099)
    if (/^(19|20)\d{2}$/.test(trimmed)) continue;
    // Abaikan jika kode klasifikasi bertitik (misal 421.3, 005.1)
    if (/^\d+\.\d+$/.test(trimmed)) continue;

    // Cek apakah ada nomor urut misal "024", "005", "12", "B-104"
    const match = trimmed.match(/(?:^|[A-Za-z]*-?)(\d{1,4})(?:$|[A-Za-z]*)/);
    if (match && match[1]) {
      const numStr = match[1];
      const parsed = parseInt(numStr, 10);
      if (parsed > 0 && parsed < 2000) {
        return numStr.length >= 3 ? numStr : numStr.padStart(3, '0');
      }
    }
  }

  // Fallback regex umum nomor surat: No. 12 atau Nomor 005
  const fallbackMatch = cleaned.match(/(?:No\.?|Nomor)?\s*(\d{1,4})/i);
  if (fallbackMatch && fallbackMatch[1]) {
    const parsed = parseInt(fallbackMatch[1], 10);
    if (parsed > 0 && parsed < 2000) {
      return fallbackMatch[1].length >= 3 ? fallbackMatch[1] : fallbackMatch[1].padStart(3, '0');
    }
  }

  return null;
}
