import React, { useState, useEffect } from 'react';
import { Letter } from '../types';
import { getSignedFileUrl } from '../services/supabase';
import { verifyLetter, archiveLetter } from '../services/letters';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/useAuth';
import {
  X,
  FileText,
  Calendar,
  Building,
  User,
  Tag,
  Download,
  ExternalLink,
  CheckCircle,
  Archive,
  Inbox,
  Send,
  Eye,
  Clock
} from 'lucide-react';

interface Props {
  letter: Letter | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const LetterDetailModal: React.FC<Props> = ({
  letter,
  isOpen,
  onClose,
  onRefresh,
}) => {
  const { user } = useAuth();
  const { canVerifyLetters, canManageLetters } = usePermissions();

  const [signedUrls, setSignedUrls] = useState<{ [fileId: string]: string }>({});
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (letter && letter.files && letter.files.length > 0) {
      letter.files.forEach(async (f) => {
        const url = await getSignedFileUrl(f.file_path, 3600);
        if (url) {
          setSignedUrls((prev) => ({ ...prev, [f.id]: url }));
        }
      });
    }
  }, [letter]);

  if (!isOpen || !letter) return null;

  const handleVerify = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await verifyLetter(letter.id, user.id);
      if (res.success) {
        onRefresh();
        onClose();
      } else {
        alert(res.error || 'Gagal memverifikasi surat');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      const res = await archiveLetter(letter.id, user.id);
      if (res.success) {
        onRefresh();
        onClose();
      } else {
        alert(res.error || 'Gagal mengarsipkan surat');
      }
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
              {letter.letter_type === 'INCOMING' ? (
                <Inbox className="w-5 h-5" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold text-slate-400">
                  {letter.letter_type === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-emerald-300">
                  {letter.status}
                </span>
              </div>
              <h3 className="font-semibold text-base tracking-tight font-mono">
                {letter.letter_number}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
          {/* Main Subject */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
              Perihal Surat
            </span>
            <p className="text-sm font-bold text-slate-900 leading-snug">
              {letter.subject}
            </p>
            {letter.summary && (
              <p className="text-xs text-slate-600 mt-2 italic border-t border-slate-200/60 pt-2">
                &ldquo;{letter.summary}&rdquo;
              </p>
            )}
          </div>

          {/* Key details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Pengirim</span>
                <p className="font-semibold text-slate-900">{letter.sender}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tujuan / Penerima</span>
                <p className="font-semibold text-slate-900">{letter.recipient}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Nomor Agenda</span>
                <p className="font-mono text-slate-800">{letter.agenda_number || '-'}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tanggal Surat</span>
                <p className="text-slate-800">{letter.letter_date}</p>
              </div>
              {letter.received_date && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tanggal Diterima</span>
                  <p className="text-slate-800">{letter.received_date}</p>
                </div>
              )}
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Sifat Surat</span>
                <p className="text-slate-800">{letter.letter_nature || 'Biasa'}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Kategori</span>
                <p className="text-slate-800">
                  {letter.category ? letter.category.name : 'Tidak Terkategori'}
                </p>
              </div>
            </div>
          </div>

          {/* Signatory info if available */}
          {(letter.signatory_name || letter.signatory_position) && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Penandatangan Dokumen
              </span>
              <p className="font-semibold text-slate-900">
                {letter.signatory_name || '-'}
                {letter.signatory_position ? ` (${letter.signatory_position})` : ''}
              </p>
            </div>
          )}

          {/* Attached Files (Supabase Private Storage) */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Berkas Fisik Terlampir (Private Storage)
            </h4>
            {!letter.files || letter.files.length === 0 ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center text-xs">
                Tidak ada berkas fisik yang dilampirkan pada surat ini.
              </div>
            ) : (
              <div className="space-y-2">
                {letter.files.map((file) => {
                  const signedUrl = signedUrls[file.id];
                  return (
                    <div
                      key={file.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                        <div className="truncate">
                          <p className="font-semibold text-slate-900 truncate">{file.file_name}</p>
                          <p className="text-[10px] text-slate-500">
                            {(file.file_size / 1024).toFixed(1)} KB &bull; {file.storage_bucket}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {signedUrl ? (
                          <>
                            <a
                              href={signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Lihat
                            </a>
                            <a
                              href={signedUrl}
                              download={file.file_name}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-200/70 hover:bg-slate-200 rounded-lg transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Unduh
                            </a>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400">Membuat Signed URL...</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Dicatat pada {new Date(letter.created_at).toLocaleDateString('id-ID')}
          </div>

          <div className="flex items-center gap-2">
            {canVerifyLetters && letter.status === 'NEED_REVIEW' && (
              <button
                onClick={handleVerify}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Verifikasi Surat</span>
              </button>
            )}

            {canManageLetters && letter.status !== 'ARCHIVED' && (
              <button
                onClick={handleArchive}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50"
              >
                <Archive className="w-3.5 h-3.5" />
                <span>Arsipkan Surat</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
