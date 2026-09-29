import React, { useState, useEffect } from 'react';
import { LetterType } from '../types';
import {
  previewReorderAgenda,
  applyReorderAgenda,
  ReorderAgendaItem,
} from '../services/letters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  SortAsc,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  FileText,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultLetterType?: LetterType;
  onSuccess?: () => void;
}

export const ReorderAgendaModal: React.FC<Props> = ({
  isOpen,
  onClose,
  defaultLetterType = 'INCOMING',
  onSuccess,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [letterType, setLetterType] = useState<LetterType>(defaultLetterType);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<ReorderAgendaItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [changedCount, setChangedCount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setLetterType(defaultLetterType);
      loadPreview(defaultLetterType, selectedYear);
    }
  }, [isOpen, defaultLetterType]);

  const loadPreview = async (type: LetterType, year: number) => {
    setLoadingPreview(true);
    try {
      const res = await previewReorderAgenda(type, year);
      setItems(res.items);
      setTotalCount(res.totalCount);
      setChangedCount(res.changedCount);
    } catch (err) {
      console.error('Gagal memuat pratinjau penataan agenda:', err);
      showToast('Gagal memuat pratinjau penataan nomor agenda', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleTypeChange = (type: LetterType) => {
    setLetterType(type);
    loadPreview(type, selectedYear);
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    loadPreview(letterType, year);
  };

  const handleApply = async () => {
    if (changedCount === 0) {
      showToast('Semua nomor agenda sudah tertib dan berurutan sesuai nomor surat.', 'info');
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      const res = await applyReorderAgenda(letterType, selectedYear, user?.id || null);
      if (res.success) {
        showToast(res.message, 'success');
        if (onSuccess) onSuccess();
        onClose();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      console.error('Gagal menerapkan penataan agenda:', err);
      showToast('Gagal menata ulang nomor agenda: ' + (err.message || 'Terjadi kesalahan'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <SortAsc className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Tertib Administrasi: Urutkan No. Agenda Sesuai No. Surat
              </h3>
              <p className="text-xs text-slate-500">
                Menyeragamkan nomor agenda berurutan (001, 002, 003...) berdasarkan urutan nomor surat
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-xl transition min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls: Letter Type & Year */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-3 sm:items-center justify-between shrink-0">
          {/* Segmented Control Letter Type */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => handleTypeChange('INCOMING')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition min-h-[40px] ${
                letterType === 'INCOMING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Surat Masuk
            </button>
            <button
              onClick={() => handleTypeChange('OUTGOING')}
              className={`flex-1 sm:flex-none px-4 py-2 text-xs font-semibold rounded-lg transition min-h-[40px] ${
                letterType === 'OUTGOING'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Surat Keluar
            </button>
          </div>

          {/* Year selector & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tahun:</span>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white focus:border-blue-600 outline-none"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={() => loadPreview(letterType, selectedYear)}
              disabled={loadingPreview}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              title="Muat ulang pratinjau"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPreview ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Status Info Banner */}
        <div className="px-4 py-2.5 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-blue-800">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Total arsip surat: <strong className="font-semibold">{totalCount}</strong> surat &bull;{' '}
              Akan disesuaikan: <strong className="font-semibold text-blue-900">{changedCount}</strong> no. agenda
            </span>
          </div>
          {changedCount === 0 && totalCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Sudah Tertib
            </span>
          )}
        </div>

        {/* Scrollable Preview List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loadingPreview ? (
            <div className="py-16 text-center text-xs text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
              <p>Menganalisis dan menyusun urutan nomor surat...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-semibold text-slate-700">
                Tidak ada surat terdaftar untuk tahun {selectedYear}.
              </p>
              <p className="text-[11px] text-slate-400">
                Silakan pilih tahun lain atau tambah surat baru terlebih dahulu.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 w-12 text-center">Urutan</th>
                      <th className="px-3 py-2.5">Nomor Surat</th>
                      <th className="px-3 py-2.5">Perihal</th>
                      <th className="px-3 py-2.5 text-center">No. Agenda Lama</th>
                      <th className="px-3 py-2.5 text-center">No. Agenda Baru</th>
                      <th className="px-3 py-2.5 text-center w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`transition ${item.changed ? 'bg-amber-50/40 hover:bg-amber-50/70' : 'hover:bg-slate-50'}`}
                      >
                        <td className="px-3 py-2.5 text-center text-slate-400 font-mono text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                          {item.letter_number}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 max-w-xs truncate" title={item.subject}>
                          {item.subject}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-slate-500">
                          {item.current_agenda}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono font-bold text-blue-700">
                          {item.new_agenda}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.changed ? (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded">
                              Diubah
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded">
                              Sesuai
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="sm:hidden space-y-2.5">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border transition ${
                      item.changed
                        ? 'border-amber-200 bg-amber-50/30'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        #{idx + 1}
                      </span>
                      {item.changed ? (
                        <span className="px-2 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-100 rounded">
                          Diperbarui
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100 rounded">
                          Sesuai
                        </span>
                      )}
                    </div>
                    <p className="font-mono font-bold text-xs text-slate-900">
                      {item.letter_number}
                    </p>
                    <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                      {item.subject}
                    </p>
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Agenda Lama: <strong className="font-mono">{item.current_agenda}</strong>
                      </span>
                      <div className="flex items-center gap-1 font-bold text-blue-700">
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">
                          {item.new_agenda}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
          <p className="text-[11px] text-slate-500 text-center sm:text-left">
            Penataan ini aman dan otomatis memperbarui nomor urut agenda kedinasan sekolah.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition min-h-[44px]"
            >
              Batal
            </button>
            <button
              onClick={handleApply}
              disabled={submitting || items.length === 0 || changedCount === 0}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-xs transition min-h-[44px] ${
                changedCount === 0 || items.length === 0
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Penataan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Terapkan Penataan No. Agenda ({changedCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
