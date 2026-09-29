import React, { useEffect, useState } from 'react';
import { getDashboardStats, getLetters } from '../services/letters';
import { DashboardStats, Letter } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/useAuth';
import {
  Inbox,
  Send,
  Calendar,
  AlertCircle,
  PlusCircle,
  Clock,
  CheckCircle2,
  FileText,
  Building2,
  RefreshCw,
  FolderOpen,
  ArrowUpRight
} from 'lucide-react';
import { safeString } from '../utils/stringUtils';
import { NavigationPage } from '../layouts/AppLayout';

interface Props {
  onNavigate: (page: NavigationPage) => void;
  onOpenCreateLetter: (type: 'INCOMING' | 'OUTGOING') => void;
}

export const DashboardPage: React.FC<Props> = ({ onNavigate, onOpenCreateLetter }) => {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const { canManageLetters } = usePermissions();

  const [stats, setStats] = useState<DashboardStats>({
    total_incoming: 0,
    total_outgoing: 0,
    total_this_month: 0,
    need_review: 0,
  });
  const [recentLetters, setRecentLetters] = useState<Letter[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        getDashboardStats(),
        getLetters({ page_size: 5 }),
      ]);
      setStats(s);
      setRecentLetters(l.letters);
    } catch (err) {
      console.error('Gagal memuat data dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            {settings?.school_logo ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white p-1.5 shadow-md shrink-0 flex items-center justify-center border border-slate-700/50 overflow-hidden">
                <img
                  src={settings.school_logo}
                  alt="Logo Sekolah"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : null}

            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium mb-2 border border-emerald-500/30">
                <Building2 className="w-3.5 h-3.5" />
                {settings?.school_name ? `Tata Usaha ${settings.school_name}` : 'Tata Usaha SMP Bhinneka Tunggal Ika'}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                SIPAS BTI — Dashboard Pengarsipan
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
                Selamat datang{profile?.full_name ? `, ${profile.full_name}` : ''}. Kelola arsip surat masuk, surat keluar, dan dokumen resmi sekolah secara terstruktur dan aman.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Perbarui data statistik"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            {canManageLetters && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenCreateLetter('INCOMING')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Surat Masuk</span>
                </button>
                <button
                  onClick={() => onOpenCreateLetter('OUTGOING')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Surat Keluar</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real Statistics Cards: 2 Kolom di HP / 4 Kolom di Desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Surat Masuk */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Surat Masuk
            </span>
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <Inbox className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-3xl font-bold text-slate-900">
              {stats.total_incoming}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 ml-1.5">surat</span>
          </div>
          <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 truncate">
            Arsip surat diterima
          </div>
        </div>

        {/* Total Surat Keluar */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Surat Keluar
            </span>
            <div className="p-2 sm:p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-3xl font-bold text-slate-900">
              {stats.total_outgoing}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 ml-1.5">surat</span>
          </div>
          <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 truncate">
            Arsip surat terbit
          </div>
        </div>

        {/* Surat Bulan Ini */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Bulan Ini
            </span>
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-3xl font-bold text-slate-900">
              {stats.total_this_month}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 ml-1.5">surat</span>
          </div>
          <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 truncate">
            Periode bulan ini
          </div>
        </div>

        {/* Perlu Verifikasi */}
        <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Perlu Verifikasi
            </span>
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <span className="text-xl sm:text-3xl font-bold text-slate-900">
              {stats.need_review}
            </span>
            <span className="text-[11px] sm:text-xs text-slate-400 ml-1.5">surat</span>
          </div>
          <div className="mt-1 sm:mt-2 text-[10px] sm:text-[11px] text-slate-400 truncate">
            Status NEED_REVIEW
          </div>
        </div>
      </div>

      {/* Main Section: Recent Letters / Empty State */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Arsip Surat Terbaru</h3>
            <p className="text-xs text-slate-500">Pencatatan surat masuk dan surat keluar terkini</p>
          </div>
          <button
            onClick={() => onNavigate('semua-arsip')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>Lihat Semua Arsip</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentLetters.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Database Berada Dalam Kondisi Kosong</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Belum ada surat masuk maupun surat keluar yang dicatat. Sesuai ketentuan, sistem tidak membuat data tiruan/dummy. Data hanya terisi saat petugas Tata Usaha melakukan pencatatan resmi.
            </p>
            {canManageLetters && (
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  onClick={() => onOpenCreateLetter('INCOMING')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Catat Surat Masuk Pertama
                </button>
                <button
                  onClick={() => onOpenCreateLetter('OUTGOING')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Catat Surat Keluar Pertama
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Card List (Khusus HP) */}
            <div className="md:hidden divide-y divide-slate-100">
              {recentLetters.map((letter) => (
                <div
                  key={`mobile-${letter.id}`}
                  onClick={() => {
                    window.location.hash = `surat/${letter.id}`;
                  }}
                  className="p-3.5 hover:bg-slate-50 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        letter.letter_type === 'INCOMING'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {letter.letter_type === 'INCOMING' ? 'Masuk' : 'Keluar'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 font-semibold">
                      {letter.letter_date}
                    </span>
                  </div>
                  <p className="font-mono font-bold text-xs text-slate-900">
                    {safeString(letter.letter_number, '(Tanpa Nomor)')}
                  </p>
                  <p className="text-xs text-slate-600 line-clamp-1">
                    {safeString(letter.subject, '(Tanpa Perihal)')}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="truncate max-w-[200px]">
                      {safeString(
                        letter.letter_type === 'INCOMING' ? letter.sender : letter.recipient,
                        '-'
                      )}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                      {letter.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3">Jenis</th>
                    <th className="px-5 py-3">Nomor Surat</th>
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Perihal</th>
                    <th className="px-5 py-3">Pengirim / Tujuan</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentLetters.map((letter) => (
                    <tr
                      key={letter.id}
                      onClick={() => {
                        window.location.hash = `surat/${letter.id}`;
                      }}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                    >
                      <td className="px-5 py-3 font-medium">
                        {letter.letter_type === 'INCOMING' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                            <Inbox className="w-3 h-3" />
                            Masuk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                            <Send className="w-3 h-3" />
                            Keluar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 font-mono">
                        {safeString(letter.letter_number, '(Tanpa Nomor)')}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{safeString(letter.letter_date, '-')}</td>
                      <td className="px-5 py-3 font-medium text-slate-900 max-w-xs truncate">
                        {safeString(letter.subject, '(Tanpa Perihal)')}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {safeString(letter.letter_type === 'INCOMING' ? letter.sender : letter.recipient, '-')}
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-700">
                          {letter.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Information & Architecture Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-600" />
            Identitas Lembaga
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sistem Pengarsipan Surat (SIPAS BTI) dikembangkan untuk menata administrasi persuratan resmi di SMP Bhinneka Tunggal Ika. Konfigurasi data instansi, alamat, dan pejabat Tata Usaha dapat diatur di menu Pengaturan oleh SUPER_ADMIN.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Tahap 1 Pengembangan Selesai
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Tahap 1 mencakup fondasi arsitektur, Supabase Auth, Row Level Security (RLS), Initial Admin Setup, Manajemen Role (SUPER_ADMIN, ADMIN, VIEWER), Private Storage bucket <code>letter-files</code>, serta Audit Log.
          </p>
        </div>
      </div>
    </div>
  );
};
