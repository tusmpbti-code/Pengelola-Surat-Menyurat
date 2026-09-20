import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Letter, SystemSettings, JournalColumnConfig } from '../types';

export interface GenerateJournalPdfParams {
  letterType: 'INCOMING' | 'OUTGOING';
  letters: Letter[];
  periodStart?: string;
  periodEnd?: string;
  systemSettings?: SystemSettings | null;
  columns?: JournalColumnConfig;
}

/**
 * Format tanggal Indonesia formal (contoh: "14 Agustus 2026")
 */
export function formatIndoDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Menghasilkan Dokumen PDF Jurnal Surat Resmi (A4 Landscape, Administrasi Kedinasan)
 * - Teks selectable, searchable, copyable (Terstruktur murni, bukan screenshot)
 * - Header sekolah dari system_settings
 * - Multi-page header repeat
 * - Footer halaman dan timestamp
 * - Area tanda tangan resmi Kepala Tata Usaha
 */
export function generateJournalPDF(params: GenerateJournalPdfParams): jsPDF {
  const { letterType, letters, periodStart, periodEnd, systemSettings, columns } = params;

  // A4 Landscape: 297 mm x 210 mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const marginX = 12; // 12 mm margin
  let currentY = 12;

  // 1. KOP SURAT / IDENTITAS RESMI SEKOLAH (Requirement G & S)
  const schoolName =
    systemSettings?.school_name?.trim() || 'SMP BHINNEKA TUNGGAL IKA';
  const schoolAddress = systemSettings?.school_address?.trim() || '';
  const schoolPhone = systemSettings?.school_phone?.trim() || '';
  const schoolEmail = systemSettings?.school_email?.trim() || '';
  const schoolWebsite = systemSettings?.school_website?.trim() || '';
  const schoolLogo = systemSettings?.school_logo?.trim() || null;

  // Render logo sekolah jika tersedia
  if (schoolLogo) {
    try {
      // Mendukung Data URL (Base64) PNG, JPEG, SVG
      const imgFormat = schoolLogo.includes('image/jpeg') || schoolLogo.includes('image/jpg') ? 'JPEG' : 'PNG';
      doc.addImage(schoolLogo, imgFormat, marginX + 3, 9, 18, 18, undefined, 'FAST');
    } catch (logoErr) {
      console.warn('Gagal menambahkan logo ke PDF:', logoErr);
    }
  }

  // Kop teks formal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text(schoolName.toUpperCase(), pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);

  const contactParts: string[] = [];
  if (schoolAddress) contactParts.push(schoolAddress);
  if (schoolPhone) contactParts.push(`Telp: ${schoolPhone}`);
  if (schoolEmail) contactParts.push(`Email: ${schoolEmail}`);
  if (schoolWebsite) contactParts.push(`Web: ${schoolWebsite}`);

  if (contactParts.length > 0) {
    // Split into 1 or 2 lines if long
    if (contactParts.length <= 2) {
      doc.text(contactParts.join(' | '), pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    } else {
      doc.text(contactParts.slice(0, 2).join(' | '), pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
      doc.text(contactParts.slice(2).join(' | '), pageWidth / 2, currentY, { align: 'center' });
      currentY += 4;
    }
  }

  // Garis ganda Kop Resmi (Double border line)
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.6);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 0.8;
  doc.setLineWidth(0.2);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);
  currentY += 5;

  // 2. JUDUL DOKUMEN JURNAL
  const title =
    letterType === 'INCOMING' ? 'JURNAL SURAT MASUK' : 'JURNAL SURAT KELUAR';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(title, pageWidth / 2, currentY, { align: 'center' });
  currentY += 4.5;

  // Periode Laporan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const periodText =
    periodStart && periodEnd
      ? `Periode: ${formatIndoDate(periodStart)} s.d. ${formatIndoDate(periodEnd)}`
      : periodStart
      ? `Periode Mulai: ${formatIndoDate(periodStart)}`
      : periodEnd
      ? `Periode Sampai: ${formatIndoDate(periodEnd)}`
      : 'Periode: Semua Arsip';

  doc.text(periodText, pageWidth / 2, currentY, { align: 'center' });
  currentY += 5;

  // 3. MENYUSUN KOLOM DAN DATA TABEL
  // Default kolom jika tidak dispesifikasikan
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

  const headers: string[] = [];
  if (colCfg.no) headers.push('NO.');
  if (colCfg.agenda_number) headers.push('NO. AGENDA');

  if (letterType === 'INCOMING') {
    if (colCfg.received_date !== false) headers.push('TGL DITERIMA');
    if (colCfg.letter_number) headers.push('NOMOR SURAT');
    if (colCfg.letter_date) headers.push('TGL SURAT');
    if (colCfg.sender_or_recipient) headers.push('ASAL SURAT');
    if (colCfg.subject) headers.push('PERIHAL');
    if (colCfg.attachment) headers.push('LAMPIRAN');
    if (colCfg.notes) headers.push('KETERANGAN');
  } else {
    // SURAT KELUAR
    if (colCfg.letter_date) headers.push('TGL SURAT');
    if (colCfg.letter_number) headers.push('NOMOR SURAT');
    if (colCfg.sender_or_recipient) headers.push('TUJUAN SURAT');
    if (colCfg.subject) headers.push('PERIHAL');
    if (colCfg.attachment) headers.push('LAMPIRAN');
    if (colCfg.notes) headers.push('KETERANGAN');
  }

  // Format data baris (Requirement O: Nomor Agenda dari database, tidak dihitung ulang!)
  const bodyRows: (string | number)[][] = letters.map((l, idx) => {
    const row: (string | number)[] = [];
    if (colCfg.no) row.push(idx + 1);
    if (colCfg.agenda_number) row.push(l.agenda_number ? String(l.agenda_number) : '-');

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

    return row;
  });

  // Jika tidak ada data, tampilkan satu baris informatif
  if (bodyRows.length === 0) {
    const emptyRow = new Array(headers.length).fill('');
    emptyRow[0] = 'Nihil / Belum ada data surat pada periode dan kriteria ini.';
    bodyRows.push(emptyRow);
  }

  // Generate Table using jspdf-autotable (Requirement J: header repeat, clean page breaks)
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: bodyRows,
    theme: 'grid',
    margin: { left: marginX, right: marginX, top: 15, bottom: 20 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2,
      textColor: [20, 20, 20],
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 243, 246],
      textColor: [30, 41, 59],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.3,
      lineColor: [140, 140, 140],
    },
    alternateRowStyles: {
      fillColor: [252, 253, 254],
    },
    showHead: 'everyPage', // Requirement J: header tabel diulang di setiap halaman
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // No
      1: { halign: 'center', cellWidth: 20 }, // No Agenda
    },
    didDrawPage: () => {
      // Footer: Timestamp cetak di kiri (Requirement H)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      const printTimestamp = new Date().toLocaleString('id-ID', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      });
      doc.text(`Dicetak pada: ${printTimestamp} WIB`, marginX, pageHeight - 10);
    },
  });

  // 4. TANDA TANGAN KEPALA TATA USAHA (Requirement I)
  // Hitung posisi setelah tabel di halaman terakhir
  const lastAutoTable = (doc as any).lastAutoTable;
  let finalY = (lastAutoTable?.finalY || currentY) + 8;

  // Jika sisa ruang di halaman terakhir kurang dari 35mm, tambahkan halaman baru untuk tanda tangan
  if (finalY + 35 > pageHeight - 15) {
    doc.addPage();
    finalY = 20;
  }

  const signX = pageWidth - marginX - 60; // Sisi kanan dokumen
  const tuName =
    systemSettings?.head_of_tu_name?.trim() || '....................................................';
  const tuPosition =
    systemSettings?.head_of_tu_position?.trim() || 'Kepala Tata Usaha';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);

  doc.text('Mengetahui,', signX, finalY);
  finalY += 4;
  doc.text(tuPosition, signX, finalY);
  finalY += 4;
  doc.text(schoolName, signX, finalY);
  finalY += 18; // Ruang tanda tangan dan cap stempel

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${tuName} )`, signX, finalY);

  // 5. FOOTER MULTI-PAGE PAGE NUMBERING: Page X of Y (Requirement H & J)
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth - marginX, pageHeight - 10, {
      align: 'right',
    });
  }

  return doc;
}
