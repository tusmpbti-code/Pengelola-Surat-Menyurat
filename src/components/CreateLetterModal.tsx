import React, { useState, useEffect } from 'react';
import { LetterType, LetterStatus, LetterCategory, Letter, LetterAIExtraction } from '../types';
import { createLetter, getCategories, checkDuplicateLetterNumber } from '../services/letters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';
import { AIVerificationModal } from './AIVerificationModal';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  X,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Hash,
  Sparkles,
  Camera,
  Image,
  Edit3,
} from 'lucide-react';
import {
  sanitizeDate,
  sanitizeNullableString,
  extractSequenceFromLetterNumber,
} from '../utils/stringUtils';

interface CreateLetterModalProps {
  isOpen: boolean;
  initialType: LetterType;
  onClose: () => void;
  onSuccess: (newLetter?: Letter) => void;
  onViewExisting?: (letter: Letter) => void;
  startWithAI?: boolean;
}

export const CreateLetterModal: React.FC<CreateLetterModalProps> = ({
  isOpen,
  initialType,
  onClose,
  onSuccess,
  onViewExisting,
  startWithAI = false,
}) => {
  const { user } = useAuth();
  const { success, error: showToastError } = useToast();
  const [categories, setCategories] = useState<LetterCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI Modal State
  const [showAIModal, setShowAIModal] = useState(startWithAI);

  // Form states
  const [letterType, setLetterType] = useState<LetterType>(initialType);
  const [agendaNumber, setAgendaNumber] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [receivedDate, setReceivedDate] = useState(
    initialType === 'INCOMING' ? new Date().toISOString().split('T')[0] : ''
  );
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [letterNature, setLetterNature] = useState('Biasa');
  const [attachment, setAttachment] = useState('');
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryPosition, setSignatoryPosition] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [activityLocation, setActivityLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<LetterStatus>('NEED_REVIEW');

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // Duplicate Check
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateExistingLetter, setDuplicateExistingLetter] = useState<Letter | undefined>(undefined);

  useEffect(() => {
    setLetterType(initialType);
    if (initialType === 'INCOMING') {
      setReceivedDate(new Date().toISOString().split('T')[0]);
      setRecipient('SMP Bhinneka Tunggal Ika');
      setSender('');
    } else {
      setReceivedDate('');
      setSender('SMP Bhinneka Tunggal Ika');
      setRecipient('');
    }
  }, [initialType, isOpen]);

  useEffect(() => {
    if (isOpen) {
      getCategories().then(setCategories);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setAgendaNumber('');
    setLetterNumber('');
    setLetterDate(new Date().toISOString().split('T')[0]);
    setReceivedDate(letterType === 'INCOMING' ? new Date().toISOString().split('T')[0] : '');
    setSender(letterType === 'OUTGOING' ? 'SMP Bhinneka Tunggal Ika' : '');
    setRecipient(letterType === 'INCOMING' ? 'SMP Bhinneka Tunggal Ika' : '');
    setSubject('');
    setLetterNature('Biasa');
    setAttachment('');
    setSignatoryName('');
    setSignatoryPosition('');
    setSummary('');
    setCategoryId('');
    setActivityDate('');
    setActivityLocation('');
    setNotes('');
    setStatus('NEED_REVIEW');
    setSelectedFile(null);
    setErrorMsg(null);
  };

  const executeSave = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await createLetter(
        {
          letter_type: letterType,
          agenda_number: sanitizeNullableString(agendaNumber),
          letter_number: letterNumber.trim(),
          letter_date: sanitizeDate(letterDate) || new Date().toISOString().split('T')[0],
          received_date: letterType === 'INCOMING' ? sanitizeDate(receivedDate) : null,
          sender: sender.trim(),
          recipient: recipient.trim(),
          subject: subject.trim(),
          letter_nature: sanitizeNullableString(letterNature) || 'Biasa',
          attachment: sanitizeNullableString(attachment),
          signatory_name: sanitizeNullableString(signatoryName),
          signatory_position: sanitizeNullableString(signatoryPosition),
          summary: sanitizeNullableString(summary),
          category_id: sanitizeNullableString(categoryId),
          activity_date: sanitizeDate(activityDate),
          activity_location: sanitizeNullableString(activityLocation),
          notes: sanitizeNullableString(notes),
          status,
        },
        selectedFile,
        user?.id || null
      );

      if (res.error) {
        setErrorMsg(res.error);
        showToastError(res.error);
      } else {
        success(`Berhasil mencatat ${letterType === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'}.`);
        resetForm();
        onSuccess(res.data || undefined);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan surat.';
      setErrorMsg(msg);
      showToastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const syncAgendaFromLetterNumber = () => {
    const seq = extractSequenceFromLetterNumber(letterNumber);
    if (seq) {
      setAgendaNumber(seq);
      success(`Nomor agenda diisi #${seq} sesuai nomor urut surat.`);
    } else {
      showToastError('Format nomor surat belum memuat nomor urut yang dapat diekstrak.');
    }
  };

  const handleLetterNumberChange = (val: string) => {
    setLetterNumber(val);
    if (!agendaNumber.trim()) {
      const seq = extractSequenceFromLetterNumber(val);
      if (seq) {
        setAgendaNumber(seq);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!letterNumber.trim() || !letterDate || !sender.trim() || !recipient.trim() || !subject.trim()) {
      setErrorMsg('Harap isi kolom wajib: Nomor Surat, Tanggal Surat, Pengirim, Penerima, dan Perihal.');
      return;
    }

    // Validasi ukuran berkas
    if (selectedFile && selectedFile.size > 20 * 1024 * 1024) {
      setErrorMsg('Ukuran berkas melebihi batas maksimal 20 MB.');
      return;
    }

    // Cek duplikasi nomor surat (Requirement K)
    const dupCheck = await checkDuplicateLetterNumber(letterNumber);
    if (dupCheck.exists) {
      setDuplicateExistingLetter(dupCheck.letter);
      setShowDuplicateDialog(true);
      return;
    }

    await executeSave();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-xs">
        <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-2xl rounded-none bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">
                  Catat {letterType === 'INCOMING' ? 'Surat Masuk' : 'Surat Keluar'} Baru
                </h3>
                <p className="text-xs text-slate-400">
                  Tata Usaha SMP Bhinneka Tunggal Ika &bull; Tahap 2
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
            {/* Mode Selector: Scan & Pindai AI (Otomatis) vs Mode Input Manual */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="flex-1 py-2 px-3 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer min-h-[38px]"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan & Pindai AI (Otomatis)</span>
                <span className="text-[10px] bg-emerald-800/60 px-1.5 py-0.5 rounded font-normal hidden sm:inline">Google Gemini</span>
              </button>
              <div className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg text-slate-800 bg-white shadow-2xs flex items-center justify-center gap-1.5 min-h-[38px] border border-slate-200">
                <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Mode Input Manual</span>
              </div>
            </div>

            {/* AI Assistant Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500 text-white rounded-lg shadow-xs">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-emerald-950 text-xs flex items-center gap-1.5">
                    <span>Fitur Scan & Pindai Dokumen AI</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-800">
                      Google Gemini
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Pindai via kamera HP atau unggah berkas PDF/Word untuk ekstraksi nomor, tanggal, asal, tujuan, dan perihal surat otomatis.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAIModal(true)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer min-h-[38px]"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Buka Scan & Pindai AI</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Type, Agenda Number, Nature */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Jenis Surat *
                </label>
                <select
                  value={letterType}
                  onChange={(e) => {
                    const newType = e.target.value as LetterType;
                    setLetterType(newType);
                    if (newType === 'INCOMING') {
                      setReceivedDate(new Date().toISOString().split('T')[0]);
                      setRecipient('SMP Bhinneka Tunggal Ika');
                      if (sender === 'SMP Bhinneka Tunggal Ika') setSender('');
                    } else {
                      setReceivedDate('');
                      setSender('SMP Bhinneka Tunggal Ika');
                      if (recipient === 'SMP Bhinneka Tunggal Ika') setRecipient('');
                    }
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none font-medium"
                >
                  <option value="INCOMING">Surat Masuk</option>
                  <option value="OUTGOING">Surat Keluar</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 text-[11px]">
                    Nomor Agenda
                  </label>
                  {letterNumber.trim() && (
                    <button
                      type="button"
                      onClick={syncAgendaFromLetterNumber}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1 transition"
                      title="Sinkronkan nomor agenda dari nomor urut surat"
                    >
                      <Sparkles className="w-3 h-3 text-blue-500" />
                      <span>⚡ Sinkron No. Surat</span>
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Otomatis (001...) jika kosong"
                    value={agendaNumber}
                    onChange={(e) => setAgendaNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">
                    <Hash className="w-3.5 h-3.5" />
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Diurutkan otomatis sesuai nomor surat untuk tertib administrasi.
                </span>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Sifat Surat
                </label>
                <select
                  value={letterNature}
                  onChange={(e) => setLetterNature(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                >
                  <option value="Biasa">Biasa</option>
                  <option value="Penting">Penting</option>
                  <option value="Segera">Segera</option>
                  <option value="Rahasia">Rahasia</option>
                  <option value="Sangat Rahasia">Sangat Rahasia</option>
                  <option value="Kilat">Kilat</option>
                </select>
              </div>
            </div>

            {/* Letter Number & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Nomor Surat Resmi *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    letterType === 'INCOMING'
                      ? 'Contoh: 421.3/120/Disdik/2026'
                      : 'Contoh: 421.3/085/SMP-BTI/2026'
                  }
                  value={letterNumber}
                  onChange={(e) => handleLetterNumberChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none font-mono font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tanggal Surat *
                </label>
                <input
                  type="date"
                  required
                  value={letterDate}
                  onChange={(e) => setLetterDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              {letterType === 'INCOMING' ? (
                <div>
                  <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                    Tanggal Diterima *
                  </label>
                  <input
                    type="date"
                    required
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                    Keterangan Lampiran
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 1 Berkas / 2 Lembar"
                    value={attachment}
                    onChange={(e) => setAttachment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Sender & Recipient */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Pengirim (Asal Surat) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={letterType === 'INCOMING' ? 'Contoh: Dinas Pendidikan Wilayah II' : 'SMP Bhinneka Tunggal Ika'}
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tujuan (Penerima Surat) *
                </label>
                <input
                  type="text"
                  required
                  placeholder={letterType === 'INCOMING' ? 'Kepala SMP Bhinneka Tunggal Ika' : 'Contoh: Kepala Dinas Pendidikan / Orang Tua Siswa'}
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Subject & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Perihal Surat *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Undangan Rapat Evaluasi Kurikulum Merdeka"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Klasifikasi / Kategori
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                >
                  <option value="">-- Pilih Kategori --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Signatory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Nama Penandatangan
                </label>
                <input
                  type="text"
                  placeholder="Nama pejabat penandatangan"
                  value={signatoryName}
                  onChange={(e) => setSignatoryName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Jabatan Penandatangan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kepala Sekolah / Kepala Tata Usaha"
                  value={signatoryPosition}
                  onChange={(e) => setSignatoryPosition(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Activity Date & Location (optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tanggal Kegiatan (Jika Ada)
                </label>
                <input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tempat Kegiatan (Jika Ada)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Gedung Serbaguna SMP Bhinneka Tunggal Ika"
                  value={activityLocation}
                  onChange={(e) => setActivityLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Summary & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Ringkasan Isi Surat
                </label>
                <textarea
                  rows={2}
                  placeholder="Ringkasan singkat isi surat"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Keterangan Tambahan / Disposisi
                </label>
                <textarea
                  rows={2}
                  placeholder="Instruksi pimpinan atau catatan arsip"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none resize-none"
                />
              </div>
            </div>

            {/* File Upload (Hanya untuk membaca isi surat via AI / Ekstraksi dokumen, tidak disimpan ke server) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-semibold uppercase tracking-wider text-slate-600 text-xs">
                  Unggah Dokumen / Foto Surat (Hanya Untuk Membaca Isi Surat)
                </label>
                {selectedFile && (
                  <button
                    type="button"
                    onClick={() => setShowAIModal(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    <span>Ekstraksi AI</span>
                  </button>
                )}
              </div>

              {/* Pilihan Metode: Pilih Berkas atau Ambil dari Kamera HP */}
              <input
                type="file"
                id="create-letter-file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {selectedFile ? (
                <div className="p-3.5 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                      {selectedFile.type.startsWith('image/') ? (
                        <Image className="w-5 h-5 text-blue-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; Siap dibaca AI (file tidak akan disimpan ke server)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setShowAIModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition"
                      title="Ekstrak data surat otomatis dari berkas ini menggunakan Google Gemini"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Baca dengan AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                      title="Foto ulang menggunakan kamera HP"
                    >
                      <Camera className="w-3.5 h-3.5 text-blue-600" />
                      <span className="hidden sm:inline">Foto Ulang</span>
                    </button>
                    <label
                      htmlFor="create-letter-file"
                      className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition"
                    >
                      <span>Ganti File</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Hapus file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-2xl bg-slate-50/70 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload className="w-6 h-6" />
                      <span className="text-xs font-medium text-slate-400">atau</span>
                      <Camera className="w-6 h-6 text-blue-500" />
                    </div>

                    <p className="text-xs font-semibold text-slate-700">
                      Pilih berkas dokumen atau potret fisik surat untuk dibaca oleh AI
                    </p>
                    <p className="text-[10px] text-slate-500 max-w-sm">
                      Mendukung PDF, Word (DOC/DOCX), atau foto fisik (JPG, PNG). File hanya diproses di memori untuk membaca isi surat dan tidak akan disimpan ke server.
                    </p>

                    <div className="flex items-center gap-2.5 mt-2">
                      <label
                        htmlFor="create-letter-file"
                        className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition"
                      >
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pilih Berkas</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowCameraModal(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />
                        <span>Kamera HP</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Footer */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <label className="font-semibold uppercase tracking-wider text-slate-600 text-[10px] shrink-0">
                  Status:
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LetterStatus)}
                  className="w-full sm:w-auto rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                >
                  <option value="NEED_REVIEW">NEED_REVIEW (Perlu Verifikasi)</option>
                  <option value="DRAFT">DRAFT (Konsep)</option>
                  <option value="VERIFIED">VERIFIED (Terverifikasi)</option>
                  <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  {isSubmitting ? (
                    <span>Menyimpan ke Database...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Simpan Arsip Surat</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate warning dialog (Requirement K) */}
      <DuplicateWarningDialog
        isOpen={showDuplicateDialog}
        letterNumber={letterNumber}
        existingLetter={duplicateExistingLetter}
        onViewArchive={(ex) => {
          setShowDuplicateDialog(false);
          onClose();
          if (onViewExisting) {
            onViewExisting(ex);
          }
        }}
        onProceed={() => {
          setShowDuplicateDialog(false);
          executeSave();
        }}
        onCancel={() => setShowDuplicateDialog(false)}
      />

      {/* AI Split-Screen Verification Modal (Tahap 3) */}
      {showAIModal && (
        <AIVerificationModal
          isOpen={showAIModal}
          initialFile={selectedFile}
          initialType={letterType}
          onClose={() => setShowAIModal(false)}
          onSuccess={(saved) => {
            setShowAIModal(false);
            onSuccess(saved);
            onClose();
          }}
          onSwitchToManual={(switchedFile, partialData) => {
            setShowAIModal(false);
            if (switchedFile) setSelectedFile(switchedFile);
            if (partialData?.nomor_surat) setLetterNumber(sanitizeNullableString(partialData.nomor_surat) || '');
            if (partialData?.perihal) setSubject(sanitizeNullableString(partialData.perihal) || '');
            if (partialData?.asal_surat) setSender(sanitizeNullableString(partialData.asal_surat) || '');
            if (partialData?.tujuan_surat) setRecipient(sanitizeNullableString(partialData.tujuan_surat) || '');
            if (partialData?.jenis_surat) setLetterType(partialData.jenis_surat);
            const validTanggalSurat = sanitizeDate(partialData?.tanggal_surat);
            if (validTanggalSurat) setLetterDate(validTanggalSurat);
            const validTanggalDiterima = sanitizeDate(partialData?.tanggal_diterima);
            if (validTanggalDiterima) setReceivedDate(validTanggalDiterima);
            if (partialData?.sifat_surat) setLetterNature(sanitizeNullableString(partialData.sifat_surat) || 'Biasa');
            if (partialData?.lampiran) setAttachment(sanitizeNullableString(partialData.lampiran) || '');
            if (partialData?.penandatangan) setSignatoryName(sanitizeNullableString(partialData.penandatangan) || '');
            if (partialData?.jabatan_penandatangan) setSignatoryPosition(sanitizeNullableString(partialData.jabatan_penandatangan) || '');
            if (partialData?.ringkasan) setSummary(sanitizeNullableString(partialData.ringkasan) || '');
            const validTanggalKegiatan = sanitizeDate(partialData?.tanggal_kegiatan);
            if (validTanggalKegiatan) setActivityDate(validTanggalKegiatan);
            if (partialData?.tempat_kegiatan) setActivityLocation(sanitizeNullableString(partialData.tempat_kegiatan) || '');
          }}
          onViewExisting={onViewExisting}
        />
      )}

      {/* Modal Kamera HP Langsung */}
      {showCameraModal && (
        <CameraCaptureModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={(capturedFile) => {
            setSelectedFile(capturedFile);
          }}
          title="Foto Surat Fisik via Kamera HP"
        />
      )}
    </>
  );
};
