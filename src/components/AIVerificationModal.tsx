import React, { useState, useEffect } from 'react';
import {
  LetterType,
  LetterStatus,
  LetterCategory,
  Letter,
  LetterAIExtraction,
} from '../types';
import {
  extractLetterWithGemini,
  saveLetterAIResult,
  AIProgressStep,
  ExtractWithGeminiResponse,
} from '../services/aiService';
import {
  createLetter,
  getCategories,
  checkDuplicateLetterNumber,
  verifyLetter,
} from '../services/letters';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { UnifiedDocumentViewer } from './UnifiedDocumentViewer';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  X,
  Sparkles,
  FileText,
  CheckCircle2,
  AlertCircle,
  Upload,
  Camera,
  RefreshCw,
  Edit3,
  Save,
  ShieldCheck,
  Eye,
  Loader2,
  Calendar,
  Building,
  UserCheck,
  Tag,
  Hash,
  ArrowRight,
} from 'lucide-react';
import { sanitizeDate, sanitizeNullableString } from '../utils/stringUtils';

interface AIVerificationModalProps {
  isOpen: boolean;
  initialFile?: File | null;
  initialType?: LetterType;
  onClose: () => void;
  onSuccess: (letter: Letter) => void;
  onSwitchToManual: (file?: File, partialData?: Partial<LetterAIExtraction>) => void;
  onViewExisting?: (letter: Letter) => void;
}

export const AIVerificationModal: React.FC<AIVerificationModalProps> = ({
  isOpen,
  initialFile,
  initialType = 'INCOMING',
  onClose,
  onSuccess,
  onSwitchToManual,
  onViewExisting,
}) => {
  const { user } = useAuth();
  const { canVerifyLetters } = usePermissions();
  const { success, error: showToastError } = useToast();

  // Categories master data
  const [categories, setCategories] = useState<LetterCategory[]>([]);

  // File state & object URL for preview
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);

  // AI Extraction Progress State
  const [aiStep, setAiStep] = useState<AIProgressStep>('IDLE');
  const [aiMessage, setAiMessage] = useState<string>('');
  const [isProcessingAI, setIsProcessingAI] = useState<boolean>(false);
  const [aiResponseMetadata, setAiResponseMetadata] = useState<ExtractWithGeminiResponse | null>(null);

  // Editable Extracted Fields
  const [letterType, setLetterType] = useState<LetterType>(initialType);
  const [agendaNumber, setAgendaNumber] = useState('');
  const [nomorSurat, setNomorSurat] = useState('');
  const [tanggalSurat, setTanggalSurat] = useState('');
  const [tanggalDiterima, setTanggalDiterima] = useState('');
  const [asalSurat, setAsalSurat] = useState('');
  const [tujuanSurat, setTujuanSurat] = useState('');
  const [perihal, setPerihal] = useState('');
  const [sifatSurat, setSifatSurat] = useState('Biasa');
  const [lampiran, setLampiran] = useState('');
  const [penandatangan, setPenandatangan] = useState('');
  const [jabatanPenandatangan, setJabatanPenandatangan] = useState('');
  const [ringkasan, setRingkasan] = useState('');
  const [kataKunci, setKataKunci] = useState<string[]>([]);
  const [kataKunciInput, setKataKunciInput] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [tanggalKegiatan, setTanggalKegiatan] = useState('');
  const [tempatKegiatan, setTempatKegiatan] = useState('');

  // UI state: edit toggle & submitting
  const [isEditing, setIsEditing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Duplicate Check Dialog
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateLetter, setDuplicateLetter] = useState<Letter | undefined>(undefined);

  // Verify Confirm Dialog
  const [showVerifyConfirm, setShowVerifyConfirm] = useState(false);

  // Load categories
  useEffect(() => {
    if (isOpen) {
      getCategories().then((cats) => setCategories(cats));
    }
  }, [isOpen]);

  // Handle preview URL when file changes
  useEffect(() => {
    if (initialFile) {
      setFile(initialFile);
    }
  }, [initialFile]);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setFilePreviewUrl(null);
    }
  }, [file]);

  // Automatically start AI extraction if file is already provided on open
  useEffect(() => {
    if (isOpen && file && aiStep === 'IDLE') {
      runExtraction(file);
    }
  }, [isOpen, file]);

  if (!isOpen) return null;

  // Run Gemini AI extraction
  const runExtraction = async (fileToProcess: File) => {
    setIsProcessingAI(true);
    setFormError(null);
    setAiStep('UPLOADING');
    setAiMessage('Mengunggah...');

    try {
      const catNames = categories.map((c) => c.name);
      const res = await extractLetterWithGemini({
        file: fileToProcess,
        categories: catNames,
        userHintType: letterType,
        onProgress: (step, msg) => {
          setAiStep(step);
          setAiMessage(msg);
        },
      });

      setAiResponseMetadata(res);

      if (!res.success || !res.data) {
        setAiStep('ERROR');
        setAiMessage(res.error || 'Dokumen belum dapat diproses.');
        return;
      }

      const d = res.data;

      // Populate form fields with sanitization
      if (d.jenis_surat) setLetterType(d.jenis_surat);
      if (d.nomor_surat) setNomorSurat(sanitizeNullableString(d.nomor_surat) || '');
      const validTanggalSurat = sanitizeDate(d.tanggal_surat);
      if (validTanggalSurat) setTanggalSurat(validTanggalSurat);

      const validTanggalDiterima = sanitizeDate(d.tanggal_diterima);
      if (validTanggalDiterima) setTanggalDiterima(validTanggalDiterima);
      else if (d.jenis_surat === 'INCOMING' || letterType === 'INCOMING') {
        setTanggalDiterima(new Date().toISOString().split('T')[0]);
      } else {
        setTanggalDiterima('');
      }

      if (d.asal_surat) setAsalSurat(sanitizeNullableString(d.asal_surat) || '');
      if (d.tujuan_surat) setTujuanSurat(sanitizeNullableString(d.tujuan_surat) || '');
      if (d.perihal) setPerihal(sanitizeNullableString(d.perihal) || '');
      if (d.sifat_surat) setSifatSurat(sanitizeNullableString(d.sifat_surat) || 'Biasa');
      if (d.lampiran) setLampiran(sanitizeNullableString(d.lampiran) || '');
      if (d.penandatangan) setPenandatangan(sanitizeNullableString(d.penandatangan) || '');
      if (d.jabatan_penandatangan) setJabatanPenandatangan(sanitizeNullableString(d.jabatan_penandatangan) || '');
      if (d.ringkasan) setRingkasan(sanitizeNullableString(d.ringkasan) || '');
      if (Array.isArray(d.kata_kunci)) {
        setKataKunci(
          d.kata_kunci
            .map((k) => sanitizeNullableString(k))
            .filter((k): k is string => Boolean(k))
        );
      }
      setTanggalKegiatan(sanitizeDate(d.tanggal_kegiatan) || '');
      if (d.tempat_kegiatan) setTempatKegiatan(sanitizeNullableString(d.tempat_kegiatan) || '');

      // Match category
      if (d.klasifikasi && categories.length > 0) {
        const matched = categories.find(
          (c) => c.name.toLowerCase() === d.klasifikasi?.toLowerCase()
        );
        if (matched) setSelectedCategoryId(matched.id);
      }

      setAiStep('COMPLETED');
      setAiMessage('Selesai.');

      // Check duplicate letter number immediately after AI extraction (Requirement L)
      if (d.nomor_surat && d.nomor_surat.trim().length > 2) {
        const dupCheck = await checkDuplicateLetterNumber(d.nomor_surat.trim());
        if (dupCheck.exists && dupCheck.letter) {
          setDuplicateLetter(dupCheck.letter);
          setShowDuplicateDialog(true);
        }
      }
    } catch (err: any) {
      console.error('AI Extraction Error:', err);
      setAiStep('ERROR');
      setAiMessage(err.message || 'Dokumen belum dapat diproses.');
    } finally {
      setIsProcessingAI(false);
    }
  };

  const handleCapturedOrSelectedFile = (selected: File) => {
    if (selected.size > 20 * 1024 * 1024) {
      setFormError('Ukuran berkas melebihi batas maksimal 20 MB.');
      return;
    }
    setFile(selected);
    runExtraction(selected);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleCapturedOrSelectedFile(selected);
    }
  };

  const handleAddKeyword = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const val = kataKunciInput.trim();
    if (val && !kataKunci.includes(val)) {
      setKataKunci([...kataKunci, val]);
      setKataKunciInput('');
    }
  };

  const handleRemoveKeyword = (tagToRemove: string) => {
    setKataKunci(kataKunci.filter((k) => k !== tagToRemove));
  };

  // Save letter logic
  const handleSave = async (shouldVerifyImmediately: boolean = false) => {
    setFormError(null);

    if (!nomorSurat.trim() || !tanggalSurat || !asalSurat.trim() || !tujuanSurat.trim() || !perihal.trim()) {
      setFormError('Harap lengkapi kolom wajib: Nomor Surat, Tanggal Surat, Pengirim, Penerima, dan Perihal.');
      return;
    }

    // Berkas fisik bersifat opsional saat menyimpan karena berkas hanya diunggah untuk pembacaan isi surat oleh AI (tidak disimpan ke storage).
    // Jika tidak ada berkas atau pengguna hanya ingin input data, tetap diizinkan menyimpan.
    // Check duplicate
    const dupCheck = await checkDuplicateLetterNumber(nomorSurat.trim());
    if (dupCheck.exists && dupCheck.letter && !duplicateLetter) {
      setDuplicateLetter(dupCheck.letter);
      setShowDuplicateDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Letter in database
      const createRes = await createLetter(
        {
          letter_type: letterType,
          agenda_number: sanitizeNullableString(agendaNumber) || '',
          letter_number: nomorSurat.trim(),
          letter_date: sanitizeDate(tanggalSurat) || new Date().toISOString().split('T')[0],
          received_date: letterType === 'INCOMING' ? sanitizeDate(tanggalDiterima) : null,
          sender: asalSurat.trim(),
          recipient: tujuanSurat.trim(),
          subject: perihal.trim(),
          letter_nature: sanitizeNullableString(sifatSurat) || 'Biasa',
          attachment: sanitizeNullableString(lampiran),
          signatory_name: sanitizeNullableString(penandatangan),
          signatory_position: sanitizeNullableString(jabatanPenandatangan),
          category_id: sanitizeNullableString(selectedCategoryId),
          summary: sanitizeNullableString(ringkasan),
          activity_date: sanitizeDate(tanggalKegiatan),
          activity_location: sanitizeNullableString(tempatKegiatan),
          notes: kataKunci.length > 0 ? `Kata kunci AI: ${kataKunci.join(', ')}` : null,
          status: 'NEED_REVIEW',
        },
        file,
        user?.id || null
      );

      if (createRes.error || !createRes.data) {
        throw new Error(createRes.error || 'Gagal mencatat surat.');
      }

      let savedLetter = createRes.data;

      // 2. Save AI Result to letter_ai_results (Requirement K & M)
      if (aiResponseMetadata && aiResponseMetadata.data) {
        await saveLetterAIResult({
          letterId: savedLetter.id,
          modelName: aiResponseMetadata.modelName || 'gemini-3.8-flash',
          promptVersion: aiResponseMetadata.promptVersion || 'v1.0-sipas-bti',
          rawResponse: aiResponseMetadata.rawResponse,
          structuredResponse: {
            jenis_surat: letterType,
            nomor_surat: nomorSurat,
            tanggal_surat: tanggalSurat,
            tanggal_diterima: tanggalDiterima || null,
            asal_surat: asalSurat,
            tujuan_surat: tujuanSurat,
            perihal: perihal,
            sifat_surat: sifatSurat,
            lampiran: lampiran || null,
            penandatangan: penandatangan || null,
            jabatan_penandatangan: jabatanPenandatangan || null,
            ringkasan: ringkasan || null,
            kata_kunci: kataKunci,
            klasifikasi:
              categories.find((c) => c.id === selectedCategoryId)?.name || null,
            tanggal_kegiatan: tanggalKegiatan || null,
            tempat_kegiatan: tempatKegiatan || null,
          },
          processingTime: aiResponseMetadata.processingTime,
          userId: user?.id,
        });
      }

      // 3. User verification if requested
      if (shouldVerifyImmediately && canVerifyLetters && user) {
        const verifyRes = await verifyLetter(savedLetter.id, user.id);
        if (verifyRes.success) {
          savedLetter = { ...savedLetter, status: 'VERIFIED' };
          success(`Surat berhasil disimpan dan diverifikasi resmi (Status: VERIFIED).`);
        } else {
          success(`Surat berhasil disimpan (Status: NEED_REVIEW).`);
        }
      } else {
        success(`Surat berhasil disimpan dan dicatat ke arsip (Status: NEED_REVIEW).`);
      }

      onSuccess(savedLetter);
      onClose();
    } catch (err: any) {
      console.error('Error saving letter:', err);
      setFormError(err.message || 'Gagal menyimpan surat.');
      showToastError(err.message || 'Gagal menyimpan surat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isPdf =
    file?.type?.toLowerCase().includes('pdf') ||
    file?.name?.toLowerCase().endsWith('.pdf');

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-2 sm:p-4 backdrop-blur-xs overflow-hidden">
        <div className="w-full max-w-6xl h-[94vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white shrink-0 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base">
                    AI Document Extraction &bull; SIPAS BTI
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Google Gemini
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 hidden md:inline">
                    Tidak Menyimpan File
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Pembacaan dan ekstraksi otomatis isi surat oleh AI (berkas fisik tidak disimpan ke penyimpanan/database)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onSwitchToManual(file || undefined, {
                    nomor_surat: nomorSurat,
                    perihal,
                    asal_surat: asalSurat,
                    tujuan_surat: tujuanSurat,
                  })
                }
                className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors hidden sm:inline-flex items-center gap-1.5"
                title="Beralih ke pengisian formulir manual"
              >
                <span>Input Manual</span>
              </button>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white rounded-lg p-1.5 transition-colors"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* AI Stepped Status Bar (Requirement I) */}
          <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex items-center justify-between shrink-0 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Status AI:
              </span>

              {aiStep === 'IDLE' && (
                <span className="text-slate-500">Menunggu dokumen untuk dianalisis</span>
              )}

              {['UPLOADING', 'READING', 'ANALYZING', 'EXTRACTING'].includes(aiStep) && (
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                  <span className="animate-pulse">{aiMessage}</span>
                  <div className="flex items-center gap-1 ml-2 text-[11px] text-slate-400">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        aiStep === 'UPLOADING' ? 'bg-emerald-100 text-emerald-800 font-bold' : ''
                      }`}
                    >
                      1. Unggah
                    </span>
                    &rarr;
                    <span
                      className={`px-2 py-0.5 rounded ${
                        aiStep === 'READING' ? 'bg-emerald-100 text-emerald-800 font-bold' : ''
                      }`}
                    >
                      2. Baca
                    </span>
                    &rarr;
                    <span
                      className={`px-2 py-0.5 rounded ${
                        aiStep === 'ANALYZING' ? 'bg-emerald-100 text-emerald-800 font-bold' : ''
                      }`}
                    >
                      3. Analisis
                    </span>
                    &rarr;
                    <span
                      className={`px-2 py-0.5 rounded ${
                        aiStep === 'EXTRACTING' ? 'bg-emerald-100 text-emerald-800 font-bold' : ''
                      }`}
                    >
                      4. Ekstraksi
                    </span>
                  </div>
                </div>
              )}

              {aiStep === 'COMPLETED' && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Ekstraksi Selesai</span>
                  {aiResponseMetadata?.processingTime && (
                    <span className="text-[11px] text-slate-500 font-normal">
                      ({aiResponseMetadata.processingTime} detik &bull; {aiResponseMetadata.modelName})
                    </span>
                  )}
                </div>
              )}

              {aiStep === 'ERROR' && (
                <div className="flex items-start sm:items-center gap-2 text-rose-700 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                  <div className="leading-snug">
                    <span className="font-semibold block sm:inline mr-1">Kendala Pemrosesan AI:</span>
                    <span className="text-slate-700">{aiMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Error Actions (Requirement I) */}
            {aiStep === 'ERROR' && (
              <div className="flex items-center gap-2 shrink-0">
                {file && (
                  <button
                    onClick={() => runExtraction(file)}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Coba Lagi Ekstraksi</span>
                  </button>
                )}
                <button
                  onClick={() => onSwitchToManual(file || undefined)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  Lanjut Input Manual
                </button>
              </div>
            )}
          </div>

          {/* Form Error Banner if any */}
          {formError && (
            <div className="bg-rose-50 border-b border-rose-200 px-5 py-2 text-xs text-rose-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
              <button onClick={() => setFormError(null)} className="text-rose-500 hover:text-rose-700">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Split Screen Body: KIRI (Preview) vs KANAN (Hasil Ekstraksi) */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* KIRI: PREVIEW DOKUMEN (5 Cols) */}
            <div className="lg:col-span-5 flex flex-col bg-slate-100 min-h-[300px] lg:min-h-0 overflow-hidden">
              <div className="bg-slate-200/70 px-4 py-2 flex items-center justify-between border-b border-slate-200 text-xs text-slate-700 font-semibold shrink-0 gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                  <span className="truncate">{file ? file.name : 'Belum ada dokumen'}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCameraModal(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 shadow-2xs transition"
                    title="Foto dokumen fisik surat dengan kamera HP"
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Kamera HP</span>
                  </button>

                  <label className="cursor-pointer px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-300 shadow-2xs transition">
                    <span>Ganti File</span>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>

              {/* Document Display Area */}
              <div className="flex-1 p-3 flex items-center justify-center overflow-auto bg-slate-900/5 relative">
                {!file ? (
                  <div className="text-center p-6 max-w-xs">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <div className="w-11 h-11 rounded-2xl bg-white text-slate-400 flex items-center justify-center shadow-xs border border-slate-200">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-xs border border-blue-200">
                        <Camera className="w-5 h-5" />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-700">Pilih Berkas atau Foto Surat Fisik</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Mendukung PDF, Word (DOC/DOCX), atau foto surat langsung lewat kamera HP (JPG, PNG). File hanya digunakan untuk membaca isi surat dan tidak akan disimpan ke server.
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-xl cursor-pointer border border-slate-300 shadow-2xs">
                        <Upload className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pilih Berkas</span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          className="hidden"
                          onChange={handleFileSelect}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowCameraModal(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5 text-white" />
                        <span>Kamera HP</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col">
                    <UnifiedDocumentViewer
                      file={file}
                      fileName={file.name}
                      fileSize={file.size}
                      className="w-full h-full flex-1"
                      maxHeight="100%"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* KANAN: HASIL EKSTRAKSI (7 Cols, Editable) */}
            <div className="lg:col-span-7 flex flex-col bg-white overflow-hidden">
              <div className="bg-slate-50 px-5 py-2.5 flex items-center justify-between border-b border-slate-200 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Hasil Ekstraksi AI
                  </span>
                  <span className="text-[11px] text-slate-500">(Dapat diedit oleh petugas)</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      isEditing
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isEditing ? 'Mode Edit Aktif' : 'Edit'}</span>
                  </button>

                  {file && (
                    <button
                      type="button"
                      disabled={isProcessingAI}
                      onClick={() => runExtraction(file)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
                      title="Ekstrak ulang dengan AI"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${isProcessingAI ? 'animate-spin text-emerald-600' : ''}`}
                      />
                      <span>Proses Ulang AI</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Form Fields */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
                {/* Jenis Surat & Klasifikasi */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Jenis Surat <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setLetterType('INCOMING');
                          if (!tanggalDiterima) {
                            setTanggalDiterima(new Date().toISOString().split('T')[0]);
                          }
                        }}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs text-center transition ${
                          letterType === 'INCOMING'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Surat Masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLetterType('OUTGOING');
                        }}
                        className={`py-2 px-3 rounded-xl border font-semibold text-xs text-center transition ${
                          letterType === 'OUTGOING'
                            ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-400/20'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        Surat Keluar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Klasifikasi Kategori Surat
                    </label>
                    <select
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    >
                      <option value="">-- Pilih Klasifikasi Surat --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code ? `[${c.code}] ` : ''}
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Nomor Surat & Sifat Surat */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nomor Surat Resmi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={nomorSurat}
                      onChange={(e) => setNomorSurat(e.target.value)}
                      placeholder="Contoh: 421.3/085/SMP-BTI/IX/2026"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Sifat Surat
                    </label>
                    <select
                      value={sifatSurat}
                      onChange={(e) => setSifatSurat(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
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

                {/* Tanggal Surat & Tanggal Diterima */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Surat <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={tanggalSurat}
                      onChange={(e) => setTanggalSurat(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      {letterType === 'INCOMING' ? 'Tanggal Diterima (Agenda Masuk)' : 'Lampiran'}
                    </label>
                    {letterType === 'INCOMING' ? (
                      <input
                        type="date"
                        value={tanggalDiterima}
                        onChange={(e) => setTanggalDiterima(e.target.value)}
                        className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                      />
                    ) : (
                      <input
                        type="text"
                        value={lampiran}
                        onChange={(e) => setLampiran(e.target.value)}
                        placeholder="Contoh: 1 Berkas / 2 Lembar"
                        className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Asal & Tujuan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Pengirim (Asal Surat) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={asalSurat}
                      onChange={(e) => setAsalSurat(e.target.value)}
                      placeholder="Instansi / Pengirim"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Penerima (Tujuan Surat) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={tujuanSurat}
                      onChange={(e) => setTujuanSurat(e.target.value)}
                      placeholder="Penerima / Tujuan"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                      required
                    />
                  </div>
                </div>

                {/* Perihal */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Perihal Surat <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={perihal}
                    onChange={(e) => setPerihal(e.target.value)}
                    placeholder="Pokok atau perihal surat resmi"
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed"
                    required
                  />
                </div>

                {/* Penandatangan & Jabatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nama Penandatangan
                    </label>
                    <input
                      type="text"
                      value={penandatangan}
                      onChange={(e) => setPenandatangan(e.target.value)}
                      placeholder="Nama lengkap pejabat penandatangan"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Jabatan Penandatangan
                    </label>
                    <input
                      type="text"
                      value={jabatanPenandatangan}
                      onChange={(e) => setJabatanPenandatangan(e.target.value)}
                      placeholder="Contoh: Kepala Sekolah / Sekretaris Dinas"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>
                </div>

                {/* Tanggal & Tempat Kegiatan (Opsional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tanggal Kegiatan (Jika ada)
                    </label>
                    <input
                      type="date"
                      value={tanggalKegiatan}
                      onChange={(e) => setTanggalKegiatan(e.target.value)}
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Tempat / Lokasi Kegiatan
                    </label>
                    <input
                      type="text"
                      value={tempatKegiatan}
                      onChange={(e) => setTempatKegiatan(e.target.value)}
                      placeholder="Contoh: Aula SMP Bhinneka Tunggal Ika"
                      className="w-full h-9 px-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs"
                    />
                  </div>
                </div>

                {/* Ringkasan Dokumen */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Ringkasan Dokumen (AI Summary)
                  </label>
                  <textarea
                    rows={3}
                    value={ringkasan}
                    onChange={(e) => setRingkasan(e.target.value)}
                    placeholder="Ringkasan objektif mengenai isi pokok surat..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed"
                  />
                </div>

                {/* Kata Kunci / Tags */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Kata Kunci Penting (Tags)
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {kataKunci.map((k) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>{k}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(k)}
                          className="text-slate-400 hover:text-rose-600 ml-0.5"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={kataKunciInput}
                      onChange={(e) => setKataKunciInput(e.target.value)}
                      onKeyDown={handleAddKeyword}
                      placeholder="Tambah kata kunci (tekan Enter)..."
                      className="flex-1 h-8 px-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddKeyword}
                      className="px-3 h-8 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer (Requirement H: [Proses AI] [Edit] [Simpan] [Verifikasi]) */}
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {file && (
                    <button
                      type="button"
                      disabled={isProcessingAI}
                      onClick={() => runExtraction(file)}
                      className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Proses AI</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onSwitchToManual(file || undefined, {
                        nomor_surat: nomorSurat,
                        perihal,
                        asal_surat: asalSurat,
                        tujuan_surat: tujuanSurat,
                      })
                    }
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition"
                  >
                    Input Manual
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/70 rounded-xl transition"
                  >
                    Batal
                  </button>

                  {/* Tombol Simpan (Status: NEED_REVIEW) */}
                  <button
                    type="button"
                    disabled={isSubmitting || isProcessingAI}
                    onClick={() => handleSave(false)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Simpan</span>
                  </button>

                  {/* Tombol Verifikasi (Hanya Admin / Super Admin) */}
                  {canVerifyLetters && (
                    <button
                      type="button"
                      disabled={isSubmitting || isProcessingAI}
                      onClick={() => setShowVerifyConfirm(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Simpan dan segera verifikasi dokumen surat ini"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verifikasi</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Dialog (Requirement L) */}
      <DuplicateWarningDialog
        isOpen={showDuplicateDialog}
        letterNumber={nomorSurat}
        existingLetter={duplicateLetter}
        onViewArchive={(ex) => {
          setShowDuplicateDialog(false);
          onClose();
          onViewExisting?.(ex);
        }}
        onProceed={() => {
          setShowDuplicateDialog(false);
        }}
        onCancel={() => {
          setShowDuplicateDialog(false);
        }}
      />

      {/* Verification Confirm Dialog */}
      <ConfirmDialog
        isOpen={showVerifyConfirm}
        title="Verifikasi Surat Resmi"
        message={`Apakah Anda yakin telah memeriksa seluruh metadata dan pratinjau dokumen surat nomor "${nomorSurat}"? Status surat akan langsung diubah menjadi VERIFIED.`}
        confirmText="Ya, Verifikasi Sekarang"
        cancelText="Periksa Lagi"
        variant="success"
        onConfirm={() => {
          setShowVerifyConfirm(false);
          handleSave(true);
        }}
        onCancel={() => setShowVerifyConfirm(false)}
      />

      {/* Modal Kamera HP Langsung untuk AI */}
      {showCameraModal && (
        <CameraCaptureModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          onCapture={(capturedFile) => {
            handleCapturedOrSelectedFile(capturedFile);
          }}
          title="Pindai Fisik Surat via Kamera HP (AI)"
        />
      )}
    </>
  );
};
