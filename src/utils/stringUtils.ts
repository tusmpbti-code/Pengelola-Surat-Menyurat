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
