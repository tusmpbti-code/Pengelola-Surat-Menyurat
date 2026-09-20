import * as XLSX from 'xlsx';
import { Letter, SystemSettings, JournalColumnConfig } from '../types';
import { formatIndoDate } from './pdfGenerator';

export interface GenerateExcelParams {
  letterType: 'INCOMING' | 'OUTGOING';
  letters: Letter[];
  periodStart?: string;
  periodEnd?: string;
  systemSettings?: SystemSettings | null;
  columns?: JournalColumnConfig;
}

/**
 * Mengekspor data Jurnal Surat ke format Excel (.xlsx)
 * - Menggunakan filter aktif
 * - Mengikuti kolom yang dipilih
 * - Nomor agenda asli dari database (Requirement O)
 */
export function exportJournalToExcel(params: GenerateExcelParams): void {
  const { letterType, letters, periodStart, periodEnd, systemSettings, columns } = params;

  const colCfg = columns || {
    no: true,
    agenda_number: true,
    received_date: true,
    letter_date: true,
    letter_number: true,
    sender_or_recipient: true,
    subject: true,
    attachment: true,
    notes: true,
  };

  const schoolName =
    systemSettings?.school_name?.trim() || 'SMP BHINNEKA TUNGGAL IKA';
  const journalTitle =
    letterType === 'INCOMING' ? 'JURNAL SURAT MASUK' : 'JURNAL SURAT KELUAR';
  const periodText =
    periodStart && periodEnd
      ? `${formatIndoDate(periodStart)} s.d. ${formatIndoDate(periodEnd)}`
      : 'Semua Periode';

  // 1. Header Metadata Baris atas
  const sheetData: any[][] = [
    [schoolName.toUpperCase()],
    [journalTitle],
    [`Periode: ${periodText}`],
    [`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`],
    [], // Baris kosong pemisah
  ];

  // 2. Baris Header Kolom
  const headerRow: string[] = [];
  if (colCfg.no) headerRow.push('NO');
  if (colCfg.agenda_number) headerRow.push('NO. AGENDA');

  if (letterType === 'INCOMING') {
    if (colCfg.received_date !== false) headerRow.push('TANGGAL DITERIMA');
    if (colCfg.letter_number) headerRow.push('NOMOR SURAT');
    if (colCfg.letter_date) headerRow.push('TANGGAL SURAT');
    if (colCfg.sender_or_recipient) headerRow.push('ASAL SURAT');
    if (colCfg.subject) headerRow.push('PERIHAL');
    if (colCfg.attachment) headerRow.push('LAMPIRAN');
    if (colCfg.notes) headerRow.push('KETERANGAN');
  } else {
    if (colCfg.letter_date) headerRow.push('TANGGAL SURAT');
    if (colCfg.letter_number) headerRow.push('NOMOR SURAT');
    if (colCfg.sender_or_recipient) headerRow.push('TUJUAN SURAT');
    if (colCfg.subject) headerRow.push('PERIHAL');
    if (colCfg.attachment) headerRow.push('LAMPIRAN');
    if (colCfg.notes) headerRow.push('KETERANGAN');
  }

  sheetData.push(headerRow);

  // 3. Baris Data Surat
  letters.forEach((l, idx) => {
    const row: any[] = [];
    if (colCfg.no) row.push(idx + 1);
    // Nomor agenda murni dari database
    if (colCfg.agenda_number) row.push(l.agenda_number || '-');

    if (letterType === 'INCOMING') {
      if (colCfg.received_date !== false) row.push(formatIndoDate(l.received_date));
      if (colCfg.letter_number) row.push(l.letter_number || '-');
      if (colCfg.letter_date) row.push(formatIndoDate(l.letter_date));
      if (colCfg.sender_or_recipient) row.push(l.sender || '-');
      if (colCfg.subject) row.push(l.subject || '-');
      if (colCfg.attachment) row.push(l.attachment || '-');
      if (colCfg.notes) row.push(l.notes || l.letter_nature || '-');
    } else {
      if (colCfg.letter_date) row.push(formatIndoDate(l.letter_date));
      if (colCfg.letter_number) row.push(l.letter_number || '-');
      if (colCfg.sender_or_recipient) row.push(l.recipient || '-');
      if (colCfg.subject) row.push(l.subject || '-');
      if (colCfg.attachment) row.push(l.attachment || '-');
      if (colCfg.notes) row.push(l.notes || l.letter_nature || '-');
    }

    sheetData.push(row);
  });

  if (letters.length === 0) {
    sheetData.push(['Nihil / Tidak ada data surat dalam filter ini']);
  }

  // 4. Create Workbook & Worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths
  const colWidths = headerRow.map((h) => {
    if (h === 'NO') return { wch: 6 };
    if (h.includes('AGENDA')) return { wch: 14 };
    if (h.includes('TANGGAL')) return { wch: 18 };
    if (h.includes('NOMOR')) return { wch: 26 };
    if (h.includes('ASAL') || h.includes('TUJUAN')) return { wch: 28 };
    if (h.includes('PERIHAL')) return { wch: 36 };
    return { wch: 20 };
  });
  worksheet['!cols'] = colWidths;

  const workbook = XLSX.utils.book_new();
  const sheetName = letterType === 'INCOMING' ? 'Jurnal Masuk' : 'Jurnal Keluar';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // 5. Download file
  const safeDate = new Date().toISOString().slice(0, 10);
  const fileName = `Jurnal_${letterType === 'INCOMING' ? 'Surat_Masuk' : 'Surat_Keluar'}_${safeDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
