import React, { useState, useEffect, useMemo } from 'react';
import { Letter, SystemSettings, LetterCategory, JournalColumnConfig } from '../types';
import {
  getJournalLetters,
  getCategories,
  saveReportArchive,
  logReportAction,
} from '../services/letters';
import { getSystemSettings } from '../services/settings';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { generateJournalPDF, formatIndoDate } from '../utils/pdfGenerator';
import { exportJournalToExcel } from '../utils/excelGenerator';
import { uploadLetterFile } from '../services/supabase';
import {
  Printer,
  Download,
  FileSpreadsheet,
  Archive,
  Filter,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Calendar,
  Check,
  Building2,
  FileText,
  AlertCircle,
  X,
} from 'lucide-react';

interface JournalReportViewProps {
  letterType: 'INCOMING' | 'OUTGOING';
  onNavigateToDetail?: (id: string) => void;
}

export const JournalReportView: React.FC<JournalReportViewProps> = ({
  letterType,
  onNavigateToDetail,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const currentYear = new Date().getFullYear();
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');

  // Filter state
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [periodStart, setPeriodStart] = useState<string>(
    `${currentYear}-${currentMonthStr}-01`
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    new Date(currentYear, new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedNature, setSelectedNature] = useState<string>('ALL');

  // Data state
  const [letters, setLetters] = useState<Letter[]>([]);
  const [categories, setCategories] = useState<LetterCategory[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);

  // Modals & UI states
  const [showColumnConfig, setShowColumnConfig] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Column visibility state (Requirement P)
  const [columns, setColumns] = useState<JournalColumnConfig>({
    no: true,
    agenda_number: true,
    received_date: letterType === 'INCOMING',
    letter_date: true,
    letter_number: true,
    sender_or_recipient: true,
    subject: true,
    attachment: true,
    notes: true,
  });

  // Load initial settings and categories
  useEffect(() => {
    async function init() {
      const [sett, cats] = await Promise.all([getSystemSettings(), getCategories()]);
      setSettings(sett);
      setCategories(cats);
    }
    init();
  }, []);

  // Fetch journal records based on active filter
  const loadJournalData = async () => {
    setLoading(true);
    try {
      const data = await getJournalLetters({
        letter_type: letterType,
        year: selectedYear,
        period_start: periodStart || undefined,
        period_end: periodEnd || undefined,
        category_id: selectedCategory === 'ALL' ? undefined : selectedCategory,
        nature: selectedNature === 'ALL' ? undefined : selectedNature,
      });
      setLetters(data);
    } catch (err) {
      console.error('Gagal memuat jurnal surat:', err);
      showToast('Gagal memuat data jurnal', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJournalData();
  }, [letterType, selectedYear, periodStart, periodEnd, selectedCategory, selectedNature]);

  // Preset Filters
  const applyPreset = (type: 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_YEAR' | 'ALL') => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (type === 'THIS_MONTH') {
      const start = new Date(y, m, 1).toISOString().split('T')[0];
      const end = new Date(y, m + 1, 0).toISOString().split('T')[0];
      setSelectedYear(y);
      setPeriodStart(start);
      setPeriodEnd(end);
    } else if (type === 'LAST_MONTH') {
      const start = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const end = new Date(y, m, 0).toISOString().split('T')[0];
      setSelectedYear(m === 0 ? y - 1 : y);
      setPeriodStart(start);
      setPeriodEnd(end);
    } else if (type === 'THIS_YEAR') {
      setSelectedYear(y);
      setPeriodStart(`${y}-01-01`);
      setPeriodEnd(`${y}-12-31`);
    } else {
      // ALL
      setSelectedYear(y);
      setPeriodStart('');
      setPeriodEnd('');
    }
  };

  // CETAK LANGSUNG (Requirement K)
  const handlePrint = async () => {
    await logReportAction(
      'PRINT_JOURNAL',
      {
        reportType: letterType === 'INCOMING' ? 'Jurnal Surat Masuk' : 'Jurnal Surat Keluar',
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        totalRecords: letters.length,
      },
      user?.id || null
    );
    window.print();
  };

  // DOWNLOAD PDF (Requirement F, G, H, I, J, L, M)
  const handleDownloadPDF = async () => {
    try {
      const doc = generateJournalPDF({
        letterType,
        letters,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        systemSettings: settings,
        columns,
      });

      const safeDate = new Date().toISOString().slice(0, 10);
      const fileName = `Jurnal_${
        letterType === 'INCOMING' ? 'Surat_Masuk' : 'Surat_Keluar'
      }_${safeDate}.pdf`;

      doc.save(fileName);

      await logReportAction(
        'EXPORT_JOURNAL_PDF',
        {
          reportType: letterType === 'INCOMING' ? 'Jurnal Surat Masuk' : 'Jurnal Surat Keluar',
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          totalRecords: letters.length,
          fileName,
        },
        user?.id || null
      );

      showToast('Berkas PDF Jurnal berhasil diunduh', 'success');
    } catch (err) {
      console.error('Gagal generate PDF:', err);
      showToast('Terjadi kendala saat membuat PDF', 'error');
    }
  };

  // EXPORT EXCEL (Requirement N)
  const handleExportExcel = async () => {
    try {
      exportJournalToExcel({
        letterType,
        letters,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        systemSettings: settings,
        columns,
      });

      await logReportAction(
        'EXPORT_JOURNAL_EXCEL',
        {
          reportType: letterType === 'INCOMING' ? 'Jurnal Surat Masuk' : 'Jurnal Surat Keluar',
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          totalRecords: letters.length,
        },
        user?.id || null
      );

      showToast('Jurnal berhasil diekspor ke Excel', 'success');
    } catch (err) {
      console.error('Gagal export excel:', err);
      showToast('Gagal mengekspor berkas Excel', 'error');
    }
  };

  // SIMPAN PDF SEBAGAI ARSIP (Requirement Q)
  const handleSaveToArchive = async () => {
    setIsArchiving(true);
    try {
      const doc = generateJournalPDF({
        letterType,
        letters,
        periodStart: periodStart || undefined,
        periodEnd: periodEnd || undefined,
        systemSettings: settings,
        columns,
      });

      const pdfBlob = doc.output('blob');
      const safeDate = new Date().toISOString().slice(0, 10);
      const timestamp = Date.now();
      const fileName = `Jurnal_${
        letterType === 'INCOMING' ? 'Surat_Masuk' : 'Surat_Keluar'
      }_${safeDate}_${timestamp}.pdf`;

      const fileObj = new File([pdfBlob], fileName, { type: 'application/pdf' });
      const folderPath = `reports/jurnal/${selectedYear}`;

      // Upload to Storage
      const uploadRes = await uploadLetterFile(fileObj, folderPath);

      // Save metadata to database
      const saveRes = await saveReportArchive({
        report_type:
          letterType === 'INCOMING' ? 'JURNAL_SURAT_MASUK' : 'JURNAL_SURAT_KELUAR',
        title: `${letterType === 'INCOMING' ? 'Jurnal Surat Masuk' : 'Jurnal Surat Keluar'} (${
          periodStart || 'Semua'
        } s.d. ${periodEnd || 'Sekarang'})`,
        period_start: periodStart || `${selectedYear}-01-01`,
        period_end: periodEnd || `${selectedYear}-12-31`,
        file_name: fileName,
        file_path: uploadRes?.path || `${folderPath}/${fileName}`,
        file_size: pdfBlob.size,
        storage_bucket: 'letter-files',
        total_records: letters.length,
        created_by: user?.id || null,
      });

      await logReportAction(
        'ARCHIVE_JOURNAL',
        {
          reportType: letterType === 'INCOMING' ? 'Jurnal Surat Masuk' : 'Jurnal Surat Keluar',
          periodStart: periodStart || undefined,
          periodEnd: periodEnd || undefined,
          totalRecords: letters.length,
          fileName,
        },
        user?.id || null
      );

      if (saveRes.success) {
        showToast('Dokumen Jurnal berhasil disimpan ke Arsip Laporan', 'success');
      } else {
        showToast('Dokumen PDF terunggah ke penyimpanan arsip', 'info');
      }
    } catch (err) {
      console.error('Gagal menyimpan arsip jurnal:', err);
      showToast('Terjadi kendala saat menyimpan ke arsip', 'error');
    } finally {
      setIsArchiving(false);
    }
  };

  const schoolName =
    settings?.school_name?.trim() || 'SMP BHINNEKA TUNGGAL IKA';
  const journalTitle =
    letterType === 'INCOMING' ? 'JURNAL SURAT MASUK' : 'JURNAL SURAT KELUAR';
  const periodText =
    periodStart && periodEnd
      ? `${formatIndoDate(periodStart)} s.d. ${formatIndoDate(periodEnd)}`
      : 'Semua Periode';

  return (
    <div className="space-y-6">
      {/* Page Header (Hidden on print) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print-hide">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{journalTitle}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                A4 Landscape
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Format registrasi persuratan kedinasan & buku agenda resmi sekolah
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowColumnConfig(!showColumnConfig)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title="Pilih Kolom Cetak"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>Kolom</span>
          </button>

          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title="Pratinjau Lembar Cetak"
          >
            <Eye className="w-3.5 h-3.5 text-blue-600" />
            <span>Preview</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 inline-flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
            title="Export ke Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleDownloadPDF}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            title="Unduh PDF Resmi"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download PDF</span>
          </button>

          <button
            onClick={handleSaveToArchive}
            disabled={isArchiving}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-purple-600 hover:bg-purple-700 text-white inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
            title="Simpan PDF ke Arsip"
          >
            <Archive className="w-3.5 h-3.5" />
            <span>{isArchiving ? 'Menyimpan...' : 'Simpan ke Arsip'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            title="Cetak Langsung"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Cetak</span>
          </button>
        </div>
      </div>

      {/* Filter Card (Hidden on print) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 print-hide">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>FILTER JURNAL</span>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 mr-1 hidden sm:inline">Pintas:</span>
            <button
              onClick={() => applyPreset('THIS_MONTH')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Bulan Ini
            </button>
            <button
              onClick={() => applyPreset('LAST_MONTH')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Bulan Lalu
            </button>
            <button
              onClick={() => applyPreset('THIS_YEAR')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              Tahun {currentYear}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Periode Mulai */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Awal</label>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Periode Selesai */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-600"
            />
          </div>

          {/* Tahun Buku */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Tahun Kalender</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-600"
            >
              {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          </div>

          {/* Klasifikasi */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Klasifikasi</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-600"
            >
              <option value="ALL">Semua Klasifikasi</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sifat Surat */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sifat Surat</label>
            <select
              value={selectedNature}
              onChange={(e) => setSelectedNature(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 outline-none focus:border-blue-600"
            >
              <option value="ALL">Semua Sifat</option>
              <option value="Biasa">Biasa</option>
              <option value="Penting">Penting</option>
              <option value="Segera">Segera</option>
              <option value="Rahasia">Rahasia</option>
              <option value="Sangat Rahasia">Sangat Rahasia</option>
              <option value="Kilat">Kilat</option>
            </select>
          </div>
        </div>
      </div>

      {/* Column Customizer Panel (Dropdown / Toggleable) */}
      {showColumnConfig && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-300 text-xs space-y-2 print-hide">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <span className="font-bold text-slate-800">
              Pengaturan Kolom Jurnal (Pilihan Kolom Cetak & Export)
            </span>
            <button
              onClick={() => setShowColumnConfig(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Pilih kolom yang ingin disertakan saat mencetak, mengunduh PDF, maupun mengekspor ke Excel:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.no}
                onChange={(e) => setColumns({ ...columns, no: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>No. Urut</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.agenda_number}
                onChange={(e) => setColumns({ ...columns, agenda_number: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>No. Agenda (Database)</span>
            </label>
            {letterType === 'INCOMING' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={columns.received_date !== false}
                  onChange={(e) => setColumns({ ...columns, received_date: e.target.checked })}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Tanggal Diterima</span>
              </label>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.letter_number}
                onChange={(e) => setColumns({ ...columns, letter_number: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Nomor Surat</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.letter_date}
                onChange={(e) => setColumns({ ...columns, letter_date: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Tanggal Surat</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.sender_or_recipient}
                onChange={(e) =>
                  setColumns({ ...columns, sender_or_recipient: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600"
              />
              <span>{letterType === 'INCOMING' ? 'Asal Surat' : 'Tujuan Surat'}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.subject}
                onChange={(e) => setColumns({ ...columns, subject: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Perihal</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.attachment}
                onChange={(e) => setColumns({ ...columns, attachment: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Lampiran</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={columns.notes}
                onChange={(e) => setColumns({ ...columns, notes: e.target.checked })}
                className="rounded border-slate-300 text-blue-600"
              />
              <span>Keterangan</span>
            </label>
          </div>
        </div>
      )}

      {/* DOCUMENT PAPER DISPLAY CONTAINER (Printed as official administrative paper) */}
      <div className="printable-journal-area bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* KOP RESMI DOKUMEN (Requirement G & S) */}
        <div className="pb-4 border-b-2 border-slate-900">
          <div className="flex items-center justify-between gap-4">
            {settings?.school_logo ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center">
                <img
                  src={settings.school_logo}
                  alt="Logo Sekolah"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-16 h-16 shrink-0 hidden sm:block"></div>
            )}

            <div className="flex-1 text-center space-y-1">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 uppercase font-sans">
                {schoolName}
              </h1>
              {(settings?.school_address ||
                settings?.school_phone ||
                settings?.school_email ||
                settings?.school_website) && (
                <p className="text-xs text-slate-600">
                  {[
                    settings.school_address,
                    settings.school_phone ? `Telp: ${settings.school_phone}` : null,
                    settings.school_email ? `Email: ${settings.school_email}` : null,
                    settings.school_website ? `Web: ${settings.school_website}` : null,
                  ]
                    .filter(Boolean)
                    .join(' | ')}
                </p>
              )}
            </div>

            {/* Elemen penyeimbang di sebelah kanan agar teks judul tepat di tengah */}
            {settings?.school_logo ? (
              <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 hidden sm:block opacity-0" aria-hidden="true"></div>
            ) : (
              <div className="w-16 h-16 shrink-0 hidden sm:block"></div>
            )}
          </div>

          <div className="pt-3 text-center">
            <h2 className="text-base font-bold uppercase tracking-wider text-slate-900">
              {journalTitle}
            </h2>
            <p className="text-xs text-slate-500 font-medium">Periode: {periodText}</p>
          </div>
        </div>

        {/* TABEL JURNAL RESMI (Requirement D, E, J, O) */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                {columns.no && (
                  <th className="py-2.5 px-3 border border-slate-300 text-center w-12">NO.</th>
                )}
                {columns.agenda_number && (
                  <th className="py-2.5 px-3 border border-slate-300 text-center w-24">
                    NO. AGENDA
                  </th>
                )}

                {letterType === 'INCOMING' ? (
                  <>
                    {columns.received_date !== false && (
                      <th className="py-2.5 px-3 border border-slate-300 w-28 text-center">
                        TGL DITERIMA
                      </th>
                    )}
                    {columns.letter_number && (
                      <th className="py-2.5 px-3 border border-slate-300 w-44">
                        NOMOR SURAT
                      </th>
                    )}
                    {columns.letter_date && (
                      <th className="py-2.5 px-3 border border-slate-300 w-28 text-center">
                        TGL SURAT
                      </th>
                    )}
                    {columns.sender_or_recipient && (
                      <th className="py-2.5 px-3 border border-slate-300">ASAL SURAT</th>
                    )}
                    {columns.subject && (
                      <th className="py-2.5 px-3 border border-slate-300">PERIHAL</th>
                    )}
                    {columns.attachment && (
                      <th className="py-2.5 px-3 border border-slate-300 w-24">LAMPIRAN</th>
                    )}
                    {columns.notes && (
                      <th className="py-2.5 px-3 border border-slate-300 w-28">KETERANGAN</th>
                    )}
                  </>
                ) : (
                  <>
                    {columns.letter_date && (
                      <th className="py-2.5 px-3 border border-slate-300 w-28 text-center">
                        TGL SURAT
                      </th>
                    )}
                    {columns.letter_number && (
                      <th className="py-2.5 px-3 border border-slate-300 w-44">
                        NOMOR SURAT
                      </th>
                    )}
                    {columns.sender_or_recipient && (
                      <th className="py-2.5 px-3 border border-slate-300">TUJUAN SURAT</th>
                    )}
                    {columns.subject && (
                      <th className="py-2.5 px-3 border border-slate-300">PERIHAL</th>
                    )}
                    {columns.attachment && (
                      <th className="py-2.5 px-3 border border-slate-300 w-24">LAMPIRAN</th>
                    )}
                    {columns.notes && (
                      <th className="py-2.5 px-3 border border-slate-300 w-28">KETERANGAN</th>
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                      <span>Memuat data arsip surat dari pangkalan data...</span>
                    </div>
                  </td>
                </tr>
              ) : letters.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 text-center text-slate-400 border border-slate-300"
                  >
                    Nihil / Belum ada data surat pada periode dan kriteria filter ini.
                  </td>
                </tr>
              ) : (
                letters.map((l, idx) => (
                  <tr
                    key={l.id}
                    className="hover:bg-slate-50 transition border-b border-slate-200"
                  >
                    {columns.no && (
                      <td className="py-2 px-3 border border-slate-300 text-center font-medium">
                        {idx + 1}
                      </td>
                    )}
                    {/* Requirement O: Nomor Agenda langsung dari DB, tidak dihitung ulang */}
                    {columns.agenda_number && (
                      <td className="py-2 px-3 border border-slate-300 text-center font-bold text-slate-900">
                        {l.agenda_number || '-'}
                      </td>
                    )}

                    {letterType === 'INCOMING' ? (
                      <>
                        {columns.received_date !== false && (
                          <td className="py-2 px-3 border border-slate-300 text-center text-slate-700">
                            {formatIndoDate(l.received_date)}
                          </td>
                        )}
                        {columns.letter_number && (
                          <td
                            className="py-2 px-3 border border-slate-300 font-medium text-blue-700 cursor-pointer hover:underline"
                            onClick={() => onNavigateToDetail?.(l.id)}
                            title="Klik untuk melihat detail"
                          >
                            {l.letter_number}
                          </td>
                        )}
                        {columns.letter_date && (
                          <td className="py-2 px-3 border border-slate-300 text-center text-slate-700">
                            {formatIndoDate(l.letter_date)}
                          </td>
                        )}
                        {columns.sender_or_recipient && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-800">
                            {l.sender}
                          </td>
                        )}
                        {columns.subject && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-800">
                            {l.subject}
                          </td>
                        )}
                        {columns.attachment && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-600">
                            {l.attachment || '-'}
                          </td>
                        )}
                        {columns.notes && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-600">
                            {l.notes || l.letter_nature || '-'}
                          </td>
                        )}
                      </>
                    ) : (
                      <>
                        {columns.letter_date && (
                          <td className="py-2 px-3 border border-slate-300 text-center text-slate-700">
                            {formatIndoDate(l.letter_date)}
                          </td>
                        )}
                        {columns.letter_number && (
                          <td
                            className="py-2 px-3 border border-slate-300 font-medium text-blue-700 cursor-pointer hover:underline"
                            onClick={() => onNavigateToDetail?.(l.id)}
                            title="Klik untuk melihat detail"
                          >
                            {l.letter_number}
                          </td>
                        )}
                        {columns.sender_or_recipient && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-800">
                            {l.recipient}
                          </td>
                        )}
                        {columns.subject && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-800">
                            {l.subject}
                          </td>
                        )}
                        {columns.attachment && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-600">
                            {l.attachment || '-'}
                          </td>
                        )}
                        {columns.notes && (
                          <td className="py-2 px-3 border border-slate-300 text-slate-600">
                            {l.notes || l.letter_nature || '-'}
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* TANDA TANGAN KEPALA TATA USAHA (Requirement I & S) */}
        <div className="pt-8 flex justify-end">
          <div className="text-center min-w-[240px] space-y-1">
            <p className="text-xs text-slate-700">Mengetahui,</p>
            <p className="text-xs font-semibold text-slate-900">
              {settings?.head_of_tu_position?.trim() || 'Kepala Tata Usaha'}
            </p>
            <p className="text-xs text-slate-700">{schoolName}</p>
            <div className="h-16"></div>
            <p className="text-xs font-bold text-slate-900 underline">
              {settings?.head_of_tu_name?.trim() || '( .................................................... )'}
            </p>
          </div>
        </div>

        {/* FOOTER INFORMASI CETAK */}
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Dicetak pada:{' '}
            {new Date().toLocaleString('id-ID', {
              dateStyle: 'long',
              timeStyle: 'medium',
            })}{' '}
            WIB
          </span>
          <span>SIPAS BTI &bull; Total: {letters.length} Berkas Surat</span>
        </div>
      </div>

      {/* MODAL PREVIEW PDF (Requirement K) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Pratinjau Dokumen Format Administrasi A4 Landscape
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unduh PDF</span>
                </button>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe PDF or formatted preview */}
            <div className="flex-1 p-6 overflow-y-auto bg-slate-100 flex justify-center">
              <div className="bg-white shadow-lg p-8 w-full max-w-4xl border border-slate-300 rounded-sm text-xs font-sans">
                {/* Kop Preview */}
                <div className="pb-4 border-b-2 border-slate-900">
                  <div className="flex items-center justify-between gap-3">
                    {settings?.school_logo ? (
                      <div className="w-12 h-12 shrink-0 flex items-center justify-center">
                        <img
                          src={settings.school_logo}
                          alt="Logo Sekolah"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 shrink-0 hidden sm:block"></div>
                    )}

                    <div className="flex-1 text-center space-y-0.5">
                      <h2 className="text-sm sm:text-base font-bold uppercase">{schoolName}</h2>
                      <p className="text-[11px] text-slate-600">
                        {[
                          settings?.school_address,
                          settings?.school_phone ? `Telp: ${settings.school_phone}` : null,
                          settings?.school_email ? `Email: ${settings.school_email}` : null,
                        ]
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    </div>

                    {settings?.school_logo ? (
                      <div className="w-12 h-12 shrink-0 hidden sm:block opacity-0" aria-hidden="true"></div>
                    ) : (
                      <div className="w-12 h-12 shrink-0 hidden sm:block"></div>
                    )}
                  </div>

                  <div className="pt-2 text-center">
                    <h3 className="text-xs sm:text-sm font-bold uppercase">{journalTitle}</h3>
                    <p className="text-[10px] text-slate-500">Periode: {periodText}</p>
                  </div>
                </div>

                {/* Table Preview */}
                <div className="pt-4 overflow-x-auto">
                  <table className="w-full text-left border-collapse border border-slate-300 text-[11px]">
                    <thead className="bg-slate-100 font-bold">
                      <tr>
                        <th className="p-2 border border-slate-300 text-center w-8">NO</th>
                        <th className="p-2 border border-slate-300 text-center w-20">NO. AGENDA</th>
                        {letterType === 'INCOMING' ? (
                          <>
                            <th className="p-2 border border-slate-300 w-24 text-center">TGL DITERIMA</th>
                            <th className="p-2 border border-slate-300 w-36">NOMOR SURAT</th>
                            <th className="p-2 border border-slate-300 w-24 text-center">TGL SURAT</th>
                            <th className="p-2 border border-slate-300">ASAL SURAT</th>
                            <th className="p-2 border border-slate-300">PERIHAL</th>
                          </>
                        ) : (
                          <>
                            <th className="p-2 border border-slate-300 w-24 text-center">TGL SURAT</th>
                            <th className="p-2 border border-slate-300 w-36">NOMOR SURAT</th>
                            <th className="p-2 border border-slate-300">TUJUAN SURAT</th>
                            <th className="p-2 border border-slate-300">PERIHAL</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {letters.slice(0, 15).map((l, i) => (
                        <tr key={l.id} className="border-b border-slate-200">
                          <td className="p-2 border border-slate-300 text-center">{i + 1}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold">
                            {l.agenda_number || '-'}
                          </td>
                          {letterType === 'INCOMING' ? (
                            <>
                              <td className="p-2 border border-slate-300 text-center">
                                {formatIndoDate(l.received_date)}
                              </td>
                              <td className="p-2 border border-slate-300 font-medium">
                                {l.letter_number}
                              </td>
                              <td className="p-2 border border-slate-300 text-center">
                                {formatIndoDate(l.letter_date)}
                              </td>
                              <td className="p-2 border border-slate-300">{l.sender}</td>
                              <td className="p-2 border border-slate-300">{l.subject}</td>
                            </>
                          ) : (
                            <>
                              <td className="p-2 border border-slate-300 text-center">
                                {formatIndoDate(l.letter_date)}
                              </td>
                              <td className="p-2 border border-slate-300 font-medium">
                                {l.letter_number}
                              </td>
                              <td className="p-2 border border-slate-300">{l.recipient}</td>
                              <td className="p-2 border border-slate-300">{l.subject}</td>
                            </>
                          )}
                        </tr>
                      ))}
                      {letters.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400">
                            Nihil data surat.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  {letters.length > 15 && (
                    <p className="text-[10px] text-slate-400 mt-2 text-center italic">
                      Menampilkan 15 dari {letters.length} data untuk pratinjau. Unduh PDF untuk dokumen lengkap multi-halaman.
                    </p>
                  )}
                </div>

                {/* Signature Preview */}
                <div className="pt-6 flex justify-end">
                  <div className="text-center min-w-[200px] text-[11px] space-y-1">
                    <p>Mengetahui,</p>
                    <p className="font-semibold">{settings?.head_of_tu_position || 'Kepala Tata Usaha'}</p>
                    <div className="h-12"></div>
                    <p className="font-bold underline">
                      {settings?.head_of_tu_name || '( ................................... )'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
