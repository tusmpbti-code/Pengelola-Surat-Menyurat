import React, { useState, useEffect } from 'react';
import { Letter, LetterLog, LetterStatus, LetterAIResult } from '../types';
import {
  getLetterById,
  getLetterHistory,
  verifyLetter,
  archiveLetter,
  submitForReviewLetter,
  softDeleteLetter,
  restoreLetter,
} from '../services/letters';
import { getLetterAIResult } from '../services/aiService';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { DocumentPreview } from '../components/DocumentPreview';
import { EditLetterModal } from '../components/EditLetterModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  ArrowLeft,
  Inbox,
  Send,
  Calendar,
  Building,
  User,
  Tag,
  FileText,
  CheckCircle2,
  Archive,
  Trash2,
  Edit,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  History,
  Download,
  Eye,
  Hash,
  Share2,
  Sparkles,
  Bot,
} from 'lucide-react';

interface LetterDetailPageProps {
  letterId: string;
  onBack: () => void;
  onNavigateToLetter?: (id: string) => void;
}

export const LetterDetailPage: React.FC<LetterDetailPageProps> = ({
  letterId,
  onBack,
  onNavigateToLetter,
}) => {
  const { user } = useAuth();
  const { canVerifyLetters, canManageLetters, isSuperAdmin } = usePermissions();
  const { success, error: showToastError } = useToast();

  const [letter, setLetter] = useState<Letter | null>(null);
  const [logs, setLogs] = useState<LetterLog[]>([]);
  const [aiResult, setAiResult] = useState<LetterAIResult | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals & Dialogs
  const [showEditModal, setShowEditModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'VERIFY' | 'ARCHIVE' | 'DELETE' | 'RESTORE' | 'SUBMIT_REVIEW';
    title: string;
    message: string;
    confirmText: string;
    variant: 'success' | 'warning' | 'danger' | 'info';
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedLetter, fetchedLogs, fetchedAi] = await Promise.all([
        getLetterById(letterId),
        getLetterHistory(letterId),
        getLetterAIResult(letterId),
      ]);
      setLetter(fetchedLetter);
      setLogs(fetchedLogs);
      setAiResult(fetchedAi);
    } catch (err) {
      console.error('Gagal memuat detail surat:', err);
      showToastError('Gagal memuat data surat.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [letterId]);

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500 space-y-3">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
        <p>Memuat rincian arsip surat dari pangkalan data...</p>
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-4 max-w-lg mx-auto">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">Surat Tidak Ditemukan</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Dokumen surat dengan identitas ID tersebut tidak ditemukan di pangkalan data atau telah dihapus secara permanen.
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Daftar Surat</span>
        </button>
      </div>
    );
  }

  const handleExecuteConfirm = async () => {
    if (!confirmAction || !user?.id) return;
    setActionLoading(true);

    try {
      if (confirmAction.type === 'VERIFY') {
        const res = await verifyLetter(letter.id, user.id);
        if (res.success) {
          success('Surat resmi berhasil diverifikasi.');
          await loadData();
        } else {
          showToastError(res.error || 'Gagal memverifikasi surat.');
        }
      } else if (confirmAction.type === 'ARCHIVE') {
        const res = await archiveLetter(letter.id, user.id);
        if (res.success) {
          success('Surat berhasil dipindahkan ke status arsip permanen.');
          await loadData();
        } else {
          showToastError(res.error || 'Gagal mengarsipkan surat.');
        }
      } else if (confirmAction.type === 'SUBMIT_REVIEW') {
        const res = await submitForReviewLetter(letter.id, user.id);
        if (res.success) {
          success('Surat diajukan untuk peninjauan verifikasi.');
          await loadData();
        } else {
          showToastError(res.error || 'Gagal mengajukan surat.');
        }
      } else if (confirmAction.type === 'DELETE') {
        const res = await softDeleteLetter(letter.id, user.id);
        if (res.success) {
          success('Surat dipindahkan ke tempat sampah (soft delete).');
          await loadData();
        } else {
          showToastError(res.error || 'Gagal menghapus surat.');
        }
      } else if (confirmAction.type === 'RESTORE') {
        const res = await restoreLetter(letter.id, user.id);
        if (res.success) {
          success('Surat berhasil dipulihkan dari tempat sampah.');
          await loadData();
        } else {
          showToastError(res.error || 'Gagal memulihkan surat.');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operasi gagal dijalankan.';
      showToastError(msg);
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const getStatusBadge = (st: LetterStatus) => {
    switch (st) {
      case 'VERIFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            TERVERIFIKASI
          </span>
        );
      case 'ARCHIVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Archive className="w-3.5 h-3.5 text-blue-600" />
            DIARSIPKAN
          </span>
        );
      case 'NEED_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            PERLU VERIFIKASI
          </span>
        );
      case 'TRASH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            TEMPAT SAMPAH
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            KONSEP (DRAFT)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
            title="Kembali"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                {letter.letter_type === 'INCOMING' ? 'Arsip Surat Masuk' : 'Arsip Surat Keluar'}
              </span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-xs font-mono font-bold text-slate-700">
                Agenda: {letter.agenda_number || '-'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 font-mono tracking-tight">
              {letter.letter_number}
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge(letter.status)}

          {/* Edit button */}
          {canManageLetters && letter.status !== 'TRASH' && (
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl transition shadow-2xs"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}

          {/* Submit for Review button */}
          {canManageLetters && letter.status === 'DRAFT' && (
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'SUBMIT_REVIEW',
                  title: 'Ajukan Surat untuk Peninjauan',
                  message:
                    'Apakah Anda yakin ingin mengajukan surat ini untuk diverifikasi oleh Pejabat / Admin Tata Usaha?',
                  confirmText: 'Ajukan Review',
                  variant: 'info',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ajukan Review</span>
            </button>
          )}

          {/* Verify button */}
          {canVerifyLetters && ['DRAFT', 'NEED_REVIEW'].includes(letter.status) && (
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'VERIFY',
                  title: 'Verifikasi Surat Resmi',
                  message: `Anda akan memverifikasi surat nomor "${letter.letter_number}". Nama dan waktu verifikasi Anda akan disimpan secara permanen pada audit log.`,
                  confirmText: 'Verifikasi Surat',
                  variant: 'success',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verifikasi</span>
            </button>
          )}

          {/* Archive button */}
          {canManageLetters && letter.status === 'VERIFIED' && (
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'ARCHIVE',
                  title: 'Arsipkan Surat',
                  message: `Pindahkan surat nomor "${letter.letter_number}" ke arsip permanen sekolah?`,
                  confirmText: 'Arsipkan',
                  variant: 'info',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Arsipkan</span>
            </button>
          )}

          {/* Soft delete button */}
          {canManageLetters && letter.status !== 'TRASH' && (
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'DELETE',
                  title: 'Pindahkan ke Tempat Sampah',
                  message: `Surat nomor "${letter.letter_number}" akan dipindahkan ke tempat sampah (soft delete). Data tidak langsung dihapus permanen.`,
                  confirmText: 'Pindahkan ke Sampah',
                  variant: 'danger',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
          )}

          {/* Restore button */}
          {canManageLetters && letter.status === 'TRASH' && (
            <button
              onClick={() =>
                setConfirmAction({
                  type: 'RESTORE',
                  title: 'Pulihkan Surat dari Sampah',
                  message: `Kembalikan surat nomor "${letter.letter_number}" ke status aktif?`,
                  confirmText: 'Pulihkan',
                  variant: 'info',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Pulihkan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Left Metadata & Right Document Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Metadata & Verification Info */}
        <div className="lg:col-span-6 space-y-5">
          {/* Main Subject Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Perihal Surat
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                {letter.subject}
              </h3>
            </div>

            {letter.summary && (
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Ringkasan Isi Dokumen
                </span>
                <p className="text-xs text-slate-700 leading-relaxed italic">
                  &ldquo;{letter.summary}&rdquo;
                </p>
              </div>
            )}

            {letter.notes && (
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <span className="text-[10px] font-bold uppercase text-amber-700 block mb-1">
                  Catatan Tambahan / Disposisi
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">{letter.notes}</p>
              </div>
            )}
          </div>

          {/* Structured Metadata Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
              Metadata Dokumen
            </h4>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Nomor Agenda
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {letter.agenda_number || '-'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Sifat Surat
                </span>
                <span className="font-medium text-slate-800">
                  {letter.letter_nature || 'Biasa'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Tanggal Surat
                </span>
                <span className="font-medium text-slate-800">{letter.letter_date}</span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Tanggal Diterima
                </span>
                <span className="font-medium text-slate-800">
                  {letter.received_date || '-'}
                </span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Pengirim (Asal Surat)
                </span>
                <span className="font-semibold text-slate-900">{letter.sender}</span>
              </div>

              <div className="col-span-2">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Tujuan (Penerima)
                </span>
                <span className="font-semibold text-slate-900">{letter.recipient}</span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Klasifikasi / Kategori
                </span>
                <span className="font-medium text-slate-800">
                  {letter.category ? (
                    <span className="inline-flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      {letter.category.name} {letter.category.code ? `(${letter.category.code})` : ''}
                    </span>
                  ) : (
                    '-'
                  )}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Keterangan Lampiran
                </span>
                <span className="font-medium text-slate-800">{letter.attachment || '-'}</span>
              </div>

              {/* Signatory */}
              {(letter.signatory_name || letter.signatory_position) && (
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-0.5">
                    Penandatangan Dokumen
                  </span>
                  <p className="font-semibold text-slate-900">
                    {letter.signatory_name || '-'}
                    {letter.signatory_position && (
                      <span className="text-xs font-normal text-slate-600">
                        {' '}
                        &bull; {letter.signatory_position}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Activity Details if present */}
              {(letter.activity_date || letter.activity_location) && (
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">
                    Detail Kegiatan Terkait
                  </span>
                  {letter.activity_date && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Tanggal:</span> {letter.activity_date}
                    </p>
                  )}
                  {letter.activity_location && (
                    <p className="text-slate-700">
                      <span className="font-semibold">Tempat:</span> {letter.activity_location}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Verification Information Card (Requirement G & H) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Informasi Verifikasi & Pencatatan
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    Status Verifikasi
                  </span>
                  <span className="font-semibold text-slate-800">
                    {letter.status === 'VERIFIED' || letter.status === 'ARCHIVED'
                      ? 'Dokumen Sah & Terverifikasi'
                      : 'Belum Diverifikasi'}
                  </span>
                </div>
                {letter.verified_at && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Waktu Verifikasi
                    </span>
                    <span className="font-medium text-slate-700">
                      {new Date(letter.verified_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              {letter.verifier && (
                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-slate-800">
                  <span className="text-[10px] text-emerald-800 font-bold uppercase block mb-0.5">
                    Diverifikasi Oleh
                  </span>
                  <p className="font-bold text-slate-900">{letter.verifier.full_name}</p>
                  <p className="text-[11px] text-slate-600">
                    {letter.verifier.email} &bull; {letter.verifier.role}
                  </p>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  Dicatat oleh:{' '}
                  <span className="font-semibold text-slate-700">
                    {letter.creator?.full_name || 'Petugas Tata Usaha'}
                  </span>
                </span>
                <span>{new Date(letter.created_at).toLocaleDateString('id-ID')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Document Preview & Audit Trail History */}
        <div className="lg:col-span-6 space-y-5">
          {/* AI Extraction Result Card (Tahap 3) */}
          {aiResult && (
            <div className="bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500 text-white rounded-lg shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Hasil Ekstraksi AI &bull; Google Gemini
                    </h4>
                    <span className="text-[10px] text-emerald-800">
                      Model: {aiResult.model_name} &bull; {aiResult.processing_time ? `${aiResult.processing_time} detik` : 'Otomatis'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {aiResult.prompt_version}
                </span>
              </div>

              {aiResult.structured_response && (
                <div className="space-y-2 text-xs">
                  {aiResult.structured_response.ringkasan && (
                    <div className="p-2.5 rounded-xl bg-white border border-emerald-100/80 text-slate-700 leading-relaxed text-[11px]">
                      <span className="font-semibold text-emerald-900 block mb-0.5">Ringkasan AI:</span>
                      {aiResult.structured_response.ringkasan}
                    </div>
                  )}

                  {aiResult.structured_response.kata_kunci && aiResult.structured_response.kata_kunci.length > 0 && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Kata Kunci Terdeteksi:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {aiResult.structured_response.kata_kunci.map((tag: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100/70 text-emerald-800 border border-emerald-200 font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <details className="pt-1 text-[11px] text-slate-500">
                    <summary className="cursor-pointer text-emerald-700 hover:text-emerald-900 font-semibold">
                      Lihat Raw JSON Response Gemini
                    </summary>
                    <pre className="mt-2 p-2.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] overflow-x-auto max-h-48">
                      {JSON.stringify(aiResult.structured_response, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}

          {/* Document Preview (Requirement F) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Berkas Fisik Terlampir ({letter.files ? letter.files.length : 0})</span>
              <span className="text-[10px] text-slate-400 lowercase font-normal">
                storage privat: letter-files
              </span>
            </h4>

            {!letter.files || letter.files.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">Tidak ada berkas fisik terlampir.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Anda dapat mengunggah berkas scan atau PDF melalui menu Edit Surat.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {letter.files.map((file) => (
                  <DocumentPreview key={file.id} file={file} letter={letter} />
                ))}
              </div>
            )}
          </div>

          {/* Audit Trail History (Requirement G, I, H) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Riwayat Perubahan & Audit Aktivitas
                </h4>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {logs.length} catatan
              </span>
            </div>

            {logs.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 italic">
                Belum ada catatan riwayat aktivitas untuk surat ini.
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 text-xs">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            log.action === 'AI_PROCESSING'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : log.action === 'CREATE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'VERIFY'
                              ? 'bg-purple-100 text-purple-800'
                              : log.action === 'ARCHIVE'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'DELETE'
                              ? 'bg-rose-100 text-rose-800'
                              : log.action === 'RESTORE'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="font-semibold text-slate-800 text-[11px]">
                          {log.user?.full_name || 'Petugas'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <p className="text-slate-700 leading-relaxed text-xs">{log.description}</p>

                    {/* Jika ada old_data vs new_data (Requirement I) */}
                    {log.old_data && log.new_data && (
                      <details className="mt-1 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                          Lihat Perbandingan Data Perubahan
                        </summary>
                        <div className="mt-1.5 grid grid-cols-2 gap-2 p-2 bg-white rounded-lg border border-slate-200 font-mono text-[10px]">
                          <div>
                            <span className="font-bold text-rose-600 block">Data Lama:</span>
                            <pre className="overflow-x-auto whitespace-pre-wrap max-h-24">
                              {JSON.stringify(log.old_data, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <span className="font-bold text-emerald-600 block">Data Baru:</span>
                            <pre className="overflow-x-auto whitespace-pre-wrap max-h-24">
                              {JSON.stringify(log.new_data, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Letter Modal */}
      <EditLetterModal
        letter={letter}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={(updated) => {
          setLetter(updated);
          loadData();
        }}
        onViewExisting={(ex) => {
          if (onNavigateToLetter) {
            onNavigateToLetter(ex.id);
          }
        }}
      />

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={Boolean(confirmAction)}
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          variant={confirmAction.variant}
          isLoading={actionLoading}
          onConfirm={handleExecuteConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};
