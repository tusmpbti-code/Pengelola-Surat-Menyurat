import React, { useState, useEffect } from 'react';
import { Letter, LetterCategory } from '../types';
import { getLetters, getCategories } from '../services/letters';
import {
  Search,
  Filter,
  Calendar,
  FileText,
  Eye,
  Inbox,
  Send,
  RefreshCw,
  Tag,
  Clock,
  Sparkles,
  X,
} from 'lucide-react';
import { LetterDetailModal } from '../components/LetterDetailModal';
import { formatIndoDate } from '../utils/pdfGenerator';

interface SearchPageProps {
  onNavigateToDetail?: (id: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onNavigateToDetail }) => {
  // Search query
  const [query, setQuery] = useState('');

  // Filters (Requirement B)
  const currentYear = new Date().getFullYear();
  const [letterType, setLetterType] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedNature, setSelectedNature] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');

  // Master categories
  const [categories, setCategories] = useState<LetterCategory[]>([]);

  // Results state
  const [results, setResults] = useState<Letter[]>([]);
  const [totalFound, setTotalFound] = useState<number>(0);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<Letter | null>(null);

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setHasSearched(true);

    try {
      const res = await getLetters({
        letter_type: letterType === 'ALL' ? undefined : (letterType as any),
        status: status === 'ALL' ? undefined : (status as any),
        category_id: selectedCategory === 'ALL' ? undefined : selectedCategory,
        nature: selectedNature === 'ALL' ? undefined : selectedNature,
        year: selectedYear === 'ALL' ? undefined : Number(selectedYear),
        month: selectedMonth === 'ALL' ? undefined : Number(selectedMonth),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        search: query.trim(),
        page_size: 150,
      });

      setResults(res.letters);
      setTotalFound(res.total);
    } catch (err) {
      console.error('Pencarian gagal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setLetterType('ALL');
    setSelectedYear('ALL');
    setSelectedMonth('ALL');
    setStartDate('');
    setEndDate('');
    setSelectedCategory('ALL');
    setSelectedNature('ALL');
    setStatus('ALL');
    setResults([]);
    setHasSearched(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
          <Search className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pencarian & Penelusuran Surat</h2>
          <p className="text-xs text-slate-500">
            Cari dokumen berdasarkan nomor surat, nomor agenda, pengirim, tujuan, perihal, ringkasan, atau kata kunci
          </p>
        </div>
      </div>

      {/* Search & Filter Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Main Search Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Kata Kunci Pencarian (Nomor Surat / Agenda / Pengirim / Tujuan / Perihal / Ringkasan)
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ketik kata kunci, nomor surat (cth: 421.3/...), nomor agenda, asal instansi, perihal..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter Grid (Requirement B) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-3">
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span>FILTER PARAMETER PERSURATAN</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {/* Jenis Surat */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Jenis Surat</label>
                <select
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="INCOMING">Surat Masuk</option>
                  <option value="OUTGOING">Surat Keluar</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Status Dokumen</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="VERIFIED">TERVERIFIKASI</option>
                  <option value="NEED_REVIEW">PERLU VERIFIKASI</option>
                  <option value="DRAFT">DRAF</option>
                  <option value="ARCHIVED">DIARSIPKAN</option>
                </select>
              </div>

              {/* Klasifikasi */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Klasifikasi</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
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
                <label className="block font-semibold text-slate-600 mb-1">Sifat Surat</label>
                <select
                  value={selectedNature}
                  onChange={(e) => setSelectedNature(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
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

              {/* Tahun */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Tahun</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="ALL">Semua Tahun</option>
                  {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
                    <option key={y} value={y}>
                      Tahun {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bulan */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Bulan</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                >
                  <option value="ALL">Semua Bulan</option>
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
              </div>

              {/* Periode Dari */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Dari Tanggal</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                />
              </div>

              {/* Periode Sampai */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
            >
              Atur Ulang Filter
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-emerald-400" />
              <span>{loading ? 'Mencari...' : 'Cari Berkas Surat'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Results View */}
      {hasSearched && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>
              Ditemukan <strong className="text-slate-900">{totalFound}</strong> dokumen arsip surat
            </span>
            <span className="text-[11px] text-slate-400">
              Pencarian waktu nyata dari pangkalan data
            </span>
          </div>

          {results.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada surat yang sesuai dengan kata kunci atau filter ini.
              </p>
              <p className="text-[11px] text-slate-400">
                Coba ubah kata kunci pencarian atau bersihkan rentang filter tanggal.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((l) => (
                <div
                  key={l.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          l.letter_type === 'INCOMING'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {l.letter_type === 'INCOMING' ? 'SURAT MASUK' : 'SURAT KELUAR'}
                      </span>

                      {/* No Agenda Real */}
                      {l.agenda_number && (
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white">
                          Agenda #{l.agenda_number}
                        </span>
                      )}

                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {l.letter_nature || 'Biasa'}
                      </span>

                      {l.category?.name && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {l.category.name}
                        </span>
                      )}

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          l.status === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : l.status === 'NEED_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {l.subject}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span>
                        No. Surat: <strong className="font-mono text-slate-900">{l.letter_number}</strong>
                      </span>
                      <span>
                        {l.letter_type === 'INCOMING' ? 'Dari:' : 'Kepada:'}{' '}
                        <strong>{l.letter_type === 'INCOMING' ? l.sender : l.recipient}</strong>
                      </span>
                      <span>
                        Tgl Surat: <strong>{formatIndoDate(l.letter_date)}</strong>
                      </span>
                      {l.letter_type === 'INCOMING' && l.received_date && (
                        <span>
                          Diterima: <strong>{formatIndoDate(l.received_date)}</strong>
                        </span>
                      )}
                    </div>

                    {l.summary && (
                      <p className="text-xs text-slate-500 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-700">Ringkasan:</span> {l.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => setSelectedLetter(l)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 shadow-2xs transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>Detail</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedLetter && (
        <LetterDetailModal
          letter={selectedLetter}
          isOpen={true}
          onClose={() => setSelectedLetter(null)}
          onRefresh={() => handleSearch()}
        />
      )}
    </div>
  );
};
