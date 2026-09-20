import React, { useState, useEffect } from 'react';
import {
  getComprehensiveReportStats,
  getReportArchives,
} from '../services/letters';
import { ComprehensiveReportStats, ReportArchive } from '../types';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  RefreshCw,
  FileText,
  TrendingUp,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Clock,
  Archive,
  BarChart3,
  Layers,
  Loader2,
} from 'lucide-react';
import { getSignedFileUrl } from '../services/supabase';

interface ReportsPageProps {
  onNavigateToTab?: (tab: string) => void;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({ onNavigateToTab }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [stats, setStats] = useState<ComprehensiveReportStats>({
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
    monthly_trends: [],
  });
  const [archives, setArchives] = useState<ReportArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadArchive = async (arc: ReportArchive) => {
    try {
      setDownloadingId(arc.id);
      const signedUrl = await getSignedFileUrl(arc.file_path, 3600, arc.storage_bucket);
      if (!signedUrl) {
        alert('Gagal mendapatkan tautan berkas privat. Pastikan koneksi Supabase aktif.');
        return;
      }
      const link = document.createElement('a');
      link.href = signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = arc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Download error:', err);
      alert('Gagal mengunduh berkas laporan.');
    } finally {
      setDownloadingId(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, arc] = await Promise.all([
        getComprehensiveReportStats(selectedYear),
        getReportArchives(),
      ]);
      setStats(s);
      setArchives(arc);
    } catch (err) {
      console.error('Gagal memuat rekapitulasi laporan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  return (
    <div className="space-y-6">
      {/* Header Halaman Laporan */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Pusat Laporan & Rekapitulasi Persuratan
            </h2>
            <p className="text-xs text-slate-500">
              Statistik arsip riil pangkalan data & buku agenda resmi SMP Bhinneka Tunggal Ika
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xs outline-none"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </select>
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Muat Ulang Statistik"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* QUICK JUMP CARDS TO OFFICIAL JOURNALS (Requirement D & E) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          onClick={() => onNavigateToTab?.('laporan/jurnal-surat-masuk')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                  Jurnal Surat Masuk
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Resmi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Buku agenda penerimaan surat, format cetak A4 landscape & ekspor
              </p>
              <span className="text-xs font-bold text-emerald-600 mt-1 inline-block">
                Total: {stats.total_incoming} Surat
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
        </div>

        <div
          onClick={() => onNavigateToTab?.('laporan/jurnal-surat-keluar')}
          className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-blue-500/50 hover:shadow-md transition cursor-pointer group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-700 group-hover:scale-105 transition">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                  Jurnal Surat Keluar
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  Resmi
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Buku agenda pengiriman surat, format cetak A4 landscape & ekspor
              </p>
              <span className="text-xs font-bold text-blue-600 mt-1 inline-block">
                Total: {stats.total_outgoing} Surat
              </span>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
        </div>
      </div>

      {/* STATISTIK UTAMA (Real DB Counts, 0 jika belum ada data) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-slate-400">Total Berkas ({selectedYear})</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Layers className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{stats.total_all}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {stats.total_this_month} surat tercatat bulan ini
          </span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-emerald-600">Surat Masuk</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <FileText className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{stats.total_incoming}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Buku agenda masuk</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-blue-600">Surat Keluar</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <FileText className="w-3.5 h-3.5" />
            </span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2">{stats.total_outgoing}</p>
          <span className="text-[11px] text-slate-500 mt-0.5 block">Buku agenda keluar</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-amber-600">Status Verifikasi</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.total_verified}</span>
            <span className="text-xs text-slate-400">/ {stats.total_need_review} perlu telaah</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {stats.total_draft} draf, {stats.total_archived} diarsipkan
          </span>
        </div>
      </div>

      {/* REKAPITULASI BULANAN & DISTRIBUSI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rekapitulasi 12 Bulan (Tabel Riil) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                Rekapitulasi Bulanan Tahun {selectedYear}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Data Riil Database</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Bulan</th>
                  <th className="px-4 py-2.5 text-center">Surat Masuk</th>
                  <th className="px-4 py-2.5 text-center">Surat Keluar</th>
                  <th className="px-4 py-2.5 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.monthly_trends.map((m) => {
                  const subTotal = m.incoming + m.outgoing;
                  return (
                    <tr key={m.month} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-2 font-medium text-slate-800">{m.month_name}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{m.incoming}</td>
                      <td className="px-4 py-2 text-center text-slate-600">{m.outgoing}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {subTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td className="px-4 py-2.5 text-slate-900">JUMLAH TAHUN {selectedYear}</td>
                  <td className="px-4 py-2.5 text-center text-emerald-700">
                    {stats.total_incoming}
                  </td>
                  <td className="px-4 py-2.5 text-center text-blue-700">
                    {stats.total_outgoing}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-900">{stats.total_all}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Klasifikasi & Sifat Surat */}
        <div className="space-y-6">
          {/* Klasifikasi */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-3 flex items-center justify-between">
              <span>Distribusi Klasifikasi</span>
              <span className="text-[10px] font-normal text-slate-400">
                {stats.categories_breakdown.length} Kategori
              </span>
            </h3>

            {stats.categories_breakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Belum ada data kategori tercatat.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {stats.categories_breakdown.map((c) => (
                  <div key={c.category_id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate pr-2" title={c.category_name}>
                      {c.category_name}
                    </span>
                    <span className="font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                      {c.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sifat Surat */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800 mb-3">
              Distribusi Sifat Surat
            </h3>

            {stats.natures_breakdown.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                Belum ada data sifat surat.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.natures_breakdown.map((n) => (
                  <div key={n.nature} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{n.nature}</span>
                    <span className="font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md">
                      {n.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIWAYAT ARSIP BERKAS LAPORAN (Requirement Q) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">
              Riwayat Berkas PDF Tersimpan di Arsip
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Total Tersimpan: {archives.length} Dokumen</span>
        </div>

        {archives.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Belum ada dokumen PDF jurnal yang disimpan ke arsip. Buka Jurnal Surat Masuk atau Keluar dan klik tombol "Simpan ke Arsip" untuk membukukan laporan formal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2.5">Judul Laporan</th>
                  <th className="px-4 py-2.5">Periode Arsip</th>
                  <th className="px-4 py-2.5 text-center">Jumlah Data</th>
                  <th className="px-4 py-2.5">Nama Berkas</th>
                  <th className="px-4 py-2.5">Waktu Simpan</th>
                  <th className="px-4 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archives.map((arc) => {
                  const isDownloading = downloadingId === arc.id;
                  return (
                    <tr key={arc.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-2.5 font-bold text-slate-900">{arc.title}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {arc.period_start} s.d. {arc.period_end}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-purple-700">
                        {arc.total_records} Surat
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                        {arc.file_name}
                      </td>
                      <td className="px-4 py-2.5 text-slate-400">
                        {new Date(arc.created_at).toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          disabled={isDownloading}
                          onClick={() => handleDownloadArchive(arc)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition disabled:opacity-50 cursor-pointer"
                        >
                          {isDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{isDownloading ? 'Mengunduh...' : 'Unduh'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
