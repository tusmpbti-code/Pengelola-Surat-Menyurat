import React, { useState, useEffect } from 'react';
import { Letter, LetterType, LetterStatus, LetterCategory } from '../types';
import {
  getLetters,
  getCategories,
  verifyLetter,
  archiveLetter,
  softDeleteLetter,
  restoreLetter,
} from '../services/letters';
import { usePermissions } from '../hooks/useAuth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditLetterModal } from '../components/EditLetterModal';
import {
  Inbox,
  Send,
  Archive,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Eye,
  FileText,
  Edit,
  CheckCircle2,
  Trash2,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  Paperclip,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { safeString, compareLetterNumbers } from '../utils/stringUtils';
import { AIVerificationModal } from '../components/AIVerificationModal';

interface LettersPageProps {
  pageType: 'INCOMING' | 'OUTGOING' | 'ALL';
  onOpenCreate: (type: LetterType) => void;
  onNavigateToDetail: (letterId: string) => void;
}

export const LettersPage: React.FC<LettersPageProps> = ({
  pageType,
  onOpenCreate,
  onNavigateToDetail,
}) => {
  const { user } = useAuth();
  const { canVerifyLetters, canManageLetters } = usePermissions();
  const { success, error: showToastError } = useToast();

  const [letters, setLetters] = useState<Letter[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<LetterCategory[]>([]);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [natureFilter, setNatureFilter] = useState<string>('ALL');
  const [yearFilter, setYearFilter] = useState<number | undefined>(undefined);
  const [monthFilter, setMonthFilter] = useState<number | undefined>(undefined);
  const [showTrash, setShowTrash] = useState(false);

  // Sorting: Urut berdasarkan nomor surat (letter_number) secara default
  const [sortBy, setSortBy] = useState<
    'agenda_number' | 'letter_date' | 'received_date' | 'letter_number' | 'created_at' | 'subject'
  >('letter_number');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals & Dialogs
  const [selectedForEdit, setSelectedForEdit] = useState<Letter | null>(null);
  const [showAIModal, setShowAIModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'VERIFY' | 'ARCHIVE' | 'DELETE' | 'RESTORE';
    letter: Letter;
    title: string;
    message: string;
    confirmText: string;
    variant: 'success' | 'info' | 'danger';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const letterType: LetterType | undefined =
    pageType === 'INCOMING' ? 'INCOMING' : pageType === 'OUTGOING' ? 'OUTGOING' : undefined;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPageNum(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  const loadLetters = async () => {
    setLoading(true);
    try {
      const res = await getLetters({
        letter_type: letterType,
        status: showTrash ? undefined : statusFilter === 'ALL' ? undefined : (statusFilter as LetterStatus),
        category_id: categoryFilter === 'ALL' ? undefined : categoryFilter,
        nature: natureFilter === 'ALL' ? undefined : natureFilter,
        year: yearFilter,
        month: monthFilter,
        search: debouncedSearch,
        sort_by: sortBy,
        sort_direction: sortDirection,
        page: currentPageNum,
        page_size: pageSize,
        include_trash: showTrash,
      });

      const fetchedLetters = [...res.letters];
      if (sortBy === 'letter_number') {
        fetchedLetters.sort((a, b) => compareLetterNumbers(a.letter_number, b.letter_number, sortDirection));
      } else if (sortBy === 'agenda_number') {
        fetchedLetters.sort((a, b) => compareLetterNumbers(a.agenda_number, b.agenda_number, sortDirection));
      }

      setLetters(fetchedLetters);
      setTotalCount(res.total);
    } catch (err) {
      console.error('Gagal memuat arsip surat:', err);
      showToastError('Gagal memuat daftar surat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLetters();
  }, [
    pageType,
    statusFilter,
    categoryFilter,
    natureFilter,
    yearFilter,
    monthFilter,
    debouncedSearch,
    sortBy,
    sortDirection,
    currentPageNum,
    pageSize,
    showTrash,
  ]);

  const handleSort = (
    column: 'agenda_number' | 'letter_date' | 'received_date' | 'letter_number' | 'created_at' | 'subject'
  ) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  const handleExecuteAction = async () => {
    if (!confirmDialog || !user?.id) return;
    setActionLoading(true);

    try {
      const { type, letter } = confirmDialog;
      if (type === 'VERIFY') {
        const res = await verifyLetter(letter.id, user.id);
        if (res.success) {
          success(`Surat nomor ${letter.letter_number} berhasil diverifikasi.`);
          loadLetters();
        } else {
          showToastError(res.error || 'Gagal memverifikasi surat.');
        }
      } else if (type === 'ARCHIVE') {
        const res = await archiveLetter(letter.id, user.id);
        if (res.success) {
          success(`Surat nomor ${letter.letter_number} berhasil diarsipkan.`);
          loadLetters();
        } else {
          showToastError(res.error || 'Gagal mengarsipkan surat.');
        }
      } else if (type === 'DELETE') {
        const res = await softDeleteLetter(letter.id, user.id);
        if (res.success) {
          success(`Surat nomor ${letter.letter_number} dipindahkan ke tempat sampah.`);
          loadLetters();
        } else {
          showToastError(res.error || 'Gagal menghapus surat.');
        }
      } else if (type === 'RESTORE') {
        const res = await restoreLetter(letter.id, user.id);
        if (res.success) {
          success(`Surat nomor ${letter.letter_number} berhasil dipulihkan.`);
          loadLetters();
        } else {
          showToastError(res.error || 'Gagal memulihkan surat.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operasi gagal.';
      showToastError(msg);
    } finally {
      setActionLoading(false);
      setConfirmDialog(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const getTitle = () => {
    if (showTrash) return 'Tempat Sampah (Surat Terhapus)';
    if (pageType === 'INCOMING') return 'Arsip Surat Masuk';
    if (pageType === 'OUTGOING') return 'Arsip Surat Keluar';
    return 'Semua Arsip Surat';
  };

  const getSubtitle = () => {
    if (showTrash) return 'Daftar surat yang dipindahkan ke tempat sampah (soft delete)';
    if (pageType === 'INCOMING') return 'Daftar surat resmi yang diterima oleh SMP Bhinneka Tunggal Ika';
    if (pageType === 'OUTGOING') return 'Daftar surat resmi yang diterbitkan oleh SMP Bhinneka Tunggal Ika';
    return 'Seluruh arsip persuratan SMP Bhinneka Tunggal Ika';
  };

  const getStatusBadge = (st: LetterStatus) => {
    switch (st) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            VERIFIED
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Archive className="w-3 h-3" />
            ARCHIVED
          </span>
        );
      case 'NEED_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3" />
            NEED_REVIEW
          </span>
        );
      case 'TRASH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <Trash2 className="w-3 h-3" />
            TRASH
          </span>
        );
      default:
        return (
          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            DRAFT
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl shadow-xs">
              {showTrash ? (
                <Trash2 className="w-5 h-5 text-rose-400" />
              ) : pageType === 'INCOMING' ? (
                <Inbox className="w-5 h-5" />
              ) : pageType === 'OUTGOING' ? (
                <Send className="w-5 h-5" />
              ) : (
                <Archive className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">{getTitle()}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-semibold">
                  {totalCount} Data
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{getSubtitle()}</p>
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Trash / Recycle Bin */}
          <button
            onClick={() => {
              setShowTrash(!showTrash);
              setCurrentPageNum(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition ${
              showTrash
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{showTrash ? 'Kembali ke Arsip Aktif' : 'Tempat Sampah'}</span>
          </button>

          <button
            onClick={loadLetters}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Muat ulang data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Baca dengan AI (Google Gemini) */}
          {canManageLetters && !showTrash && (
            <button
              onClick={() => setShowAIModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition cursor-pointer"
              title="Ekstrak data surat otomatis dari dokumen fisik menggunakan Google Gemini"
            >
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Baca dengan AI</span>
            </button>
          )}

          {canManageLetters && !showTrash && pageType !== 'ALL' && (
            <button
              onClick={() => onOpenCreate(pageType)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Tambah {pageType === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'}</span>
            </button>
          )}

          {canManageLetters && !showTrash && pageType === 'ALL' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenCreate('INCOMING')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Surat Masuk</span>
              </button>
              <button
                onClick={() => onOpenCreate('OUTGOING')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-xs transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Surat Keluar</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search box */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari no. surat, perihal, asal/tujuan, no. agenda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 outline-none"
            />
          </div>

          {/* Status filter */}
          {!showTrash && (
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPageNum(1);
                }}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-600 outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="NEED_REVIEW">NEED_REVIEW</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="ARCHIVED">ARCHIVED</option>
                <option value="DRAFT">DRAFT</option>
              </select>
            </div>
          )}

          {/* Category filter */}
          <div className="md:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPageNum(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-600 outline-none"
            >
              <option value="ALL">Semua Klasifikasi</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name} {cat.code ? `(${cat.code})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sifat filter */}
          <div className="md:col-span-2">
            <select
              value={natureFilter}
              onChange={(e) => {
                setNatureFilter(e.target.value);
                setCurrentPageNum(1);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-700 focus:border-blue-600 outline-none"
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

        {/* Second row: Year & Month Filter & PageSize */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </div>

            {/* Year */}
            <select
              value={yearFilter || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                setYearFilter(val);
                setCurrentPageNum(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-600 outline-none"
            >
              <option value="">Semua Tahun</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
              <option value="2023">2023</option>
            </select>

            {/* Month */}
            <select
              value={monthFilter || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value, 10) : undefined;
                setMonthFilter(val);
                setCurrentPageNum(1);
              }}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-600 outline-none"
            >
              <option value="">Semua Bulan</option>
              <option value="1">Januari</option>
              <option value="2">Februari</option>
              <option value="3">Maret</option>
              <option value="4">April</option>
              <option value="5">Mei</option>
              <option value="6">Juni</option>
              <option value="7">Juli</option>
              <option value="8">Agustus</option>
              <option value="9">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>

            {(statusFilter !== 'ALL' || categoryFilter !== 'ALL' || natureFilter !== 'ALL' || yearFilter || monthFilter || searchTerm) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setCategoryFilter('ALL');
                  setNatureFilter('ALL');
                  setYearFilter(undefined);
                  setMonthFilter(undefined);
                  setSearchTerm('');
                  setCurrentPageNum(1);
                }}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-800"
              >
                Reset Filter
              </button>
            )}
          </div>

          {/* Page size selector */}
          <div className="flex items-center gap-2 text-slate-500">
            <span>Tampilkan:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPageNum(1);
              }}
              className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:border-blue-600 outline-none"
            >
              <option value="10">10 baris</option>
              <option value="15">15 baris</option>
              <option value="25">25 baris</option>
              <option value="50">50 baris</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Letters Table (Requirements A & B) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
            <p>Memuat arsip surat dari pangkalan data...</p>
          </div>
        ) : letters.length === 0 ? (
          /* Empty State (Requirement O) */
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Belum ada surat yang diarsipkan.</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Pangkalan data saat ini tidak memuat data surat untuk kriteria ini. Sesuai prinsip keaslian data sistem, tidak ada data contoh atau surat rekayasa.
            </p>
            {canManageLetters && !showTrash && (
              <div className="pt-2">
                <button
                  onClick={() => onOpenCreate(pageType === 'OUTGOING' ? 'OUTGOING' : 'INCOMING')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Catat Surat Baru</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">No</th>
                  <th
                    className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                      sortBy === 'agenda_number' ? 'text-blue-600 bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleSort('agenda_number')}
                  >
                    <div className="flex items-center gap-1">
                      <span>No. Agenda</span>
                      {sortBy === 'agenda_number' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Surat Masuk: Tanggal Diterima */}
                  {pageType === 'INCOMING' && (
                    <th
                      className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                        sortBy === 'received_date' ? 'text-blue-600 bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleSort('received_date')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Tanggal Diterima</span>
                        {sortBy === 'received_date' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* Surat Keluar atau Semua: Tanggal Surat */}
                  {(pageType === 'OUTGOING' || pageType === 'ALL') && (
                    <th
                      className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                        sortBy === 'letter_date' ? 'text-blue-600 bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleSort('letter_date')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Tanggal Surat</span>
                        {sortBy === 'letter_date' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                  )}

                  <th
                    className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                      sortBy === 'letter_number' ? 'text-blue-600 bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleSort('letter_number')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Nomor Surat</span>
                      {sortBy === 'letter_number' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Surat Masuk: Tanggal Surat */}
                  {pageType === 'INCOMING' && (
                    <th
                      className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                        sortBy === 'letter_date' ? 'text-blue-600 bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleSort('letter_date')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Tanggal Surat</span>
                        {sortBy === 'letter_date' ? (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                  )}

                  {/* Asal Surat (INCOMING) / Tujuan Surat (OUTGOING) */}
                  <th className="px-4 py-3.5">
                    {pageType === 'INCOMING'
                      ? 'Asal Surat'
                      : pageType === 'OUTGOING'
                      ? 'Tujuan Surat'
                      : 'Pengirim / Tujuan'}
                  </th>

                  <th
                    className={`px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 transition ${
                      sortBy === 'subject' ? 'text-blue-600 bg-blue-50/50' : ''
                    }`}
                    onClick={() => handleSort('subject')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Perihal</span>
                      {sortBy === 'subject' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="px-4 py-3.5">Klasifikasi</th>
                  <th className="px-4 py-3.5">Sifat</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right w-44">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {letters.map((letter, idx) => {
                  const rowNumber = (currentPageNum - 1) * pageSize + idx + 1;
                  const hasAttachment = letter.files && letter.files.length > 0;

                  return (
                    <tr
                      key={letter.id}
                      onClick={() => onNavigateToDetail(letter.id)}
                      className="hover:bg-slate-50/90 transition cursor-pointer group"
                    >
                      {/* No */}
                      <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">
                        {rowNumber}
                      </td>

                      {/* No. Agenda (Atomic Permanent) */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 text-[11px]">
                        {safeString(letter.agenda_number, '-')}
                      </td>

                      {/* Tanggal Diterima (Surat Masuk) */}
                      {pageType === 'INCOMING' && (
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {safeString(letter.received_date, '-')}
                        </td>
                      )}

                      {/* Tanggal Surat (Surat Keluar / Semua) */}
                      {(pageType === 'OUTGOING' || pageType === 'ALL') && (
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {safeString(letter.letter_date, '-')}
                        </td>
                      )}

                      {/* Nomor Surat */}
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span>{safeString(letter.letter_number, '(Tanpa Nomor)')}</span>
                          {hasAttachment && (
                            <span title={`${letter.files?.length} berkas fisik terlampir`}>
                              <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tanggal Surat (Surat Masuk) */}
                      {pageType === 'INCOMING' && (
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {safeString(letter.letter_date, '-')}
                        </td>
                      )}

                      {/* Asal Surat / Tujuan Surat */}
                      <td className="px-4 py-3 text-slate-800 font-medium max-w-xs truncate">
                        {safeString(pageType === 'INCOMING' ? letter.sender : letter.recipient, '-')}
                      </td>

                      {/* Perihal */}
                      <td className="px-4 py-3 text-slate-900 max-w-sm truncate font-medium">
                        {safeString(letter.subject, '(Tanpa Perihal)')}
                      </td>

                      {/* Klasifikasi */}
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {letter.category ? (
                          <span className="inline-flex items-center gap-1 text-[11px]">
                            <Tag className="w-3 h-3 text-slate-400" />
                            {safeString(letter.category.code || letter.category.name, '-')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      {/* Sifat */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap text-[11px]">
                        {safeString(letter.letter_nature, 'Biasa')}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">{getStatusBadge(letter.status)}</td>

                      {/* Aksi (Detail, Edit, Verifikasi, Arsip, Hapus) */}
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* Detail */}
                          <button
                            onClick={() => onNavigateToDetail(letter.id)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Lihat Detail Surat (/surat/:id)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit */}
                          {canManageLetters && letter.status !== 'TRASH' && (
                            <button
                              onClick={() => setSelectedForEdit(letter)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition"
                              title="Edit Surat"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Verifikasi */}
                          {canVerifyLetters &&
                            ['DRAFT', 'NEED_REVIEW'].includes(letter.status) &&
                            letter.status !== 'TRASH' && (
                              <button
                                onClick={() =>
                                  setConfirmDialog({
                                    type: 'VERIFY',
                                    letter,
                                    title: 'Verifikasi Surat',
                                    message: `Verifikasi surat nomor ${letter.letter_number}?`,
                                    confirmText: 'Verifikasi',
                                    variant: 'success',
                                  })
                                }
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                title="Verifikasi Surat"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                          {/* Arsip */}
                          {canManageLetters &&
                            letter.status === 'VERIFIED' && (
                              <button
                                onClick={() =>
                                  setConfirmDialog({
                                    type: 'ARCHIVE',
                                    letter,
                                    title: 'Arsipkan Surat',
                                    message: `Arsipkan surat nomor ${letter.letter_number} secara permanen?`,
                                    confirmText: 'Arsipkan',
                                    variant: 'info',
                                  })
                                }
                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                                title="Pindahkan ke Status Arsip"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                          {/* Hapus (Soft delete to TRASH) */}
                          {canManageLetters && letter.status !== 'TRASH' && (
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                    type: 'DELETE',
                                    letter,
                                    title: 'Pindahkan ke Tempat Sampah',
                                    message: `Pindahkan surat nomor ${letter.letter_number} ke tempat sampah (soft delete)?`,
                                    confirmText: 'Hapus ke Sampah',
                                    variant: 'danger',
                                })
                              }
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                              title="Pindahkan ke Tempat Sampah"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Restore if TRASH */}
                          {canManageLetters && letter.status === 'TRASH' && (
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  type: 'RESTORE',
                                  letter,
                                  title: 'Pulihkan Surat',
                                  message: `Pulihkan surat nomor ${letter.letter_number} dari tempat sampah?`,
                                  confirmText: 'Pulihkan',
                                  variant: 'info',
                                })
                              }
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                              title="Pulihkan Surat dari Sampah"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar (Requirement A & B) */}
        {!loading && totalCount > 0 && (
          <div className="p-4 bg-slate-50/70 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Menampilkan{' '}
              <span className="font-semibold text-slate-800">
                {(currentPageNum - 1) * pageSize + 1}
              </span>{' '}
              -{' '}
              <span className="font-semibold text-slate-800">
                {Math.min(currentPageNum * pageSize, totalCount)}
              </span>{' '}
              dari <span className="font-semibold text-slate-800">{totalCount}</span> arsip
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                disabled={currentPageNum === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPageNum) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  return (
                    <React.Fragment key={p}>
                      {prev && p - prev > 1 && <span className="px-1 text-slate-400">&hellip;</span>}
                      <button
                        onClick={() => setCurrentPageNum(p)}
                        className={`min-w-[28px] h-7 px-2 rounded-lg font-semibold transition ${
                          currentPageNum === p
                            ? 'bg-slate-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                disabled={currentPageNum === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition"
                title="Halaman Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Letter Modal */}
      <EditLetterModal
        letter={selectedForEdit}
        isOpen={Boolean(selectedForEdit)}
        onClose={() => setSelectedForEdit(null)}
        onSuccess={() => {
          setSelectedForEdit(null);
          loadLetters();
        }}
        onViewExisting={(ex) => {
          setSelectedForEdit(null);
          onNavigateToDetail(ex.id);
        }}
      />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={Boolean(confirmDialog)}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          variant={confirmDialog.variant}
          isLoading={actionLoading}
          onConfirm={handleExecuteAction}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* AI Document Extraction & Split-Screen Verification Modal (Tahap 3) */}
      {showAIModal && (
        <AIVerificationModal
          isOpen={showAIModal}
          initialType={pageType === 'OUTGOING' ? 'OUTGOING' : 'INCOMING'}
          onClose={() => setShowAIModal(false)}
          onSuccess={(saved) => {
            setShowAIModal(false);
            loadLetters();
            onNavigateToDetail(saved.id);
          }}
          onSwitchToManual={(_file) => {
            setShowAIModal(false);
            onOpenCreate(pageType === 'OUTGOING' ? 'OUTGOING' : 'INCOMING');
          }}
          onViewExisting={(ex) => {
            setShowAIModal(false);
            onNavigateToDetail(ex.id);
          }}
        />
      )}
    </div>
  );
};
