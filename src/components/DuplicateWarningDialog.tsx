import React from 'react';
import { AlertCircle, Eye, ArrowRight, X } from 'lucide-react';
import { Letter } from '../types';

interface DuplicateWarningDialogProps {
  isOpen: boolean;
  letterNumber: string;
  existingLetter?: Letter;
  onViewArchive: (letter: Letter) => void;
  onProceed: () => void;
  onCancel: () => void;
}

export const DuplicateWarningDialog: React.FC<DuplicateWarningDialogProps> = ({
  isOpen,
  letterNumber,
  existingLetter,
  onViewArchive,
  onProceed,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-amber-200 overflow-hidden">
        <div className="bg-amber-500 px-5 py-3.5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-100" />
            <h3 className="font-bold text-sm">Peringatan Duplikasi Nomor Surat</h3>
          </div>
          <button onClick={onCancel} className="text-amber-100 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-700 leading-relaxed">
            Nomor surat tersebut sudah terdapat dalam arsip:
          </p>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs space-y-1.5">
            <div className="font-mono font-bold text-amber-900">{letterNumber}</div>
            {existingLetter && (
              <>
                <div className="text-slate-700">
                  <span className="font-semibold">Perihal:</span> {existingLetter.subject}
                </div>
                <div className="text-slate-500 text-[11px]">
                  <span>Jenis:</span>{' '}
                  {existingLetter.letter_type === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'} &bull;{' '}
                  <span>Tanggal:</span> {existingLetter.letter_date} &bull;{' '}
                  <span>Status:</span> {existingLetter.status}
                </div>
              </>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            Apakah Anda ingin memeriksa arsip yang sudah ada atau tetap melanjutkan penyimpanan data baru ini?
          </p>
        </div>

        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            Batal
          </button>

          <div className="flex items-center gap-2">
            {existingLetter && (
              <button
                type="button"
                onClick={() => onViewArchive(existingLetter)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Lihat Arsip</span>
              </button>
            )}

            <button
              type="button"
              onClick={onProceed}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition"
            >
              <span>Lanjutkan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
