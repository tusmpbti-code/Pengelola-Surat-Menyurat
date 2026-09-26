import React, { useState, useEffect } from 'react';
import { Letter, LetterStatus, LetterType, LetterCategory } from '../types';
import { updateLetter, getCategories, checkDuplicateLetterNumber } from '../services/letters';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DuplicateWarningDialog } from './DuplicateWarningDialog';
import { CameraCaptureModal } from './CameraCaptureModal';
import {
  X,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Save,
  Trash2,
  Camera,
  Image,
} from 'lucide-react';
import { sanitizeDate, sanitizeNullableString } from '../utils/stringUtils';

interface EditLetterModalProps {
  letter: Letter | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedLetter: Letter) => void;
  onViewExisting?: (letter: Letter) => void;
}

export const EditLetterModal: React.FC<EditLetterModalProps> = ({
  letter,
  isOpen,
  onClose,
  onSuccess,
  onViewExisting,
}) => {
  const { user } = useAuth();
  const { success, error: showToastError } = useToast();
  const [categories, setCategories] = useState<LetterCategory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [letterType, setLetterType] = useState<LetterType>('INCOMING');
  const [agendaNumber, setAgendaNumber] = useState('');
  const [letterNumber, setLetterNumber] = useState('');
  const [letterDate, setLetterDate] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
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

  // Duplicate Check Dialog
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateExistingLetter, setDuplicateExistingLetter] = useState<Letter | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      getCategories().then(setCategories);
    }
  }, [isOpen]);

  useEffect(() => {
    if (letter) {
      setLetterType(letter.letter_type);
      setAgendaNumber(sanitizeNullableString(letter.agenda_number) || '');
      setLetterNumber(letter.letter_number || '');
      setLetterDate(sanitizeDate(letter.letter_date) || '');
      setReceivedDate(sanitizeDate(letter.received_date) || '');
      setSender(sanitizeNullableString(letter.sender) || '');
      setRecipient(sanitizeNullableString(letter.recipient) || '');
      setSubject(sanitizeNullableString(letter.subject) || '');
      setLetterNature(sanitizeNullableString(letter.letter_nature) || 'Biasa');
      setAttachment(sanitizeNullableString(letter.attachment) || '');
      setSignatoryName(sanitizeNullableString(letter.signatory_name) || '');
      setSignatoryPosition(sanitizeNullableString(letter.signatory_position) || '');
      setSummary(sanitizeNullableString(letter.summary) || '');
      setCategoryId(sanitizeNullableString(letter.category_id) || '');
      setActivityDate(sanitizeDate(letter.activity_date) || '');
      setActivityLocation(sanitizeNullableString(letter.activity_location) || '');
      setNotes(sanitizeNullableString(letter.notes) || '');
      setStatus(letter.status);
      setSelectedFile(null);
      setErrorMsg(null);
    }
  }, [letter, isOpen]);

  if (!isOpen || !letter) return null;

  const executeSave = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await updateLetter(
        letter.id,
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

      if (!res.success) {
        setErrorMsg(res.error || 'Gagal memperbarui data surat.');
        showToastError(res.error || 'Gagal memperbarui data surat.');
      } else {
        success('Data surat berhasil diperbarui dan dicatat dalam audit log.');
        if (res.letter) {
          onSuccess(res.letter);
        }
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui surat.';
      setErrorMsg(msg);
      showToastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!letterNumber.trim() || !letterDate || !sender.trim() || !recipient.trim() || !subject.trim()) {
      setErrorMsg('Harap isi kolom wajib: Nomor Surat, Tanggal Surat, Pengirim, Penerima, dan Perihal.');
      return;
    }

    // Cek Duplikasi nomor surat jika nomor diubah
    if (letterNumber.trim().toLowerCase() !== letter.letter_number.trim().toLowerCase()) {
      const dupCheck = await checkDuplicateLetterNumber(letterNumber, letter.id);
      if (dupCheck.exists) {
        setDuplicateExistingLetter(dupCheck.letter);
        setShowDuplicateDialog(true);
        return;
      }
    }

    await executeSave();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-slate-800 rounded-lg text-emerald-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-base">Edit Data Surat</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {letter.letter_number} &bull; No. Agenda: {letter.agenda_number || '-'}
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

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Row 1: Jenis, Nomor Agenda, Sifat */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Jenis Surat *
                </label>
                <select
                  value={letterType}
                  onChange={(e) => setLetterType(e.target.value as LetterType)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                >
                  <option value="INCOMING">Surat Masuk</option>
                  <option value="OUTGOING">Surat Keluar</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Nomor Agenda (Permanen)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 001"
                  value={agendaNumber}
                  onChange={(e) => setAgendaNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none font-mono"
                />
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

            {/* Row 2: Nomor Surat & Tanggal */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Nomor Surat Resmi *
                </label>
                <input
                  type="text"
                  required
                  value={letterNumber}
                  onChange={(e) => setLetterNumber(e.target.value)}
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
                    Tanggal Diterima
                  </label>
                  <input
                    type="date"
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
                    placeholder="Contoh: 1 Berkas"
                    value={attachment}
                    onChange={(e) => setAttachment(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                  />
                </div>
              )}
            </div>

            {/* Row 3: Pengirim & Tujuan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Pengirim (Asal Surat) *
                </label>
                <input
                  type="text"
                  required
                  value={sender}
                  onChange={(e) => setSender(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tujuan (Penerima) *
                </label>
                <input
                  type="text"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Row 4: Perihal & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Perihal Surat *
                </label>
                <input
                  type="text"
                  required
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

            {/* Row 5: Penandatangan & Jabatan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Nama Penandatangan
                </label>
                <input
                  type="text"
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
                  value={signatoryPosition}
                  onChange={(e) => setSignatoryPosition(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Row 6: Kegiatan (Optional) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Tanggal Kegiatan (Jika ada)
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
                  Tempat Kegiatan (Jika ada)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ruang Rapat Aula SMP Bhinneka Tunggal Ika"
                  value={activityLocation}
                  onChange={(e) => setActivityLocation(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>
            </div>

            {/* Row 7: Ringkasan & Keterangan */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Ringkasan Isi Surat
                </label>
                <textarea
                  rows={2}
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
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 outline-none resize-none"
                />
              </div>
            </div>

            {/* Row 8: Unggah File (Hanya untuk referensi baca, tidak disimpan ke server) */}
            <div>
              <label className="block font-semibold uppercase tracking-wider mb-1.5 text-slate-600 text-xs">
                Dokumen / Foto Surat (Hanya Untuk Membaca Isi Surat)
              </label>

              <input
                type="file"
                id="edit-file-input"
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
                    <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                      {selectedFile.type.startsWith('image/') ? (
                        <Image className="w-4 h-4 text-blue-600" />
                      ) : (
                        <FileText className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[10px] text-emerald-700 font-medium">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB &bull; File tidak akan disimpan ke server
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
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
                      htmlFor="edit-file-input"
                      className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition"
                    >
                      <span>Ganti File</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Batal"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 border-2 border-dashed border-slate-300 hover:border-slate-400 rounded-xl bg-slate-50/70 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Upload className="w-4 h-4" />
                      <span className="text-[11px] text-slate-400">atau</span>
                      <Camera className="w-4 h-4 text-blue-500" />
                    </div>

                    <p className="text-xs font-semibold text-slate-700">
                      Pilih berkas baru atau foto fisik surat dengan kamera HP
                    </p>
                    <p className="text-[10px] text-slate-500">
                      File diunggah hanya untuk pembacaan isi surat dan tidak akan disimpan ke server.
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      <label
                        htmlFor="edit-file-input"
                        className="cursor-pointer inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition"
                      >
                        <Upload className="w-3 h-3 text-slate-500" />
                        <span>Pilih Berkas</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => setShowCameraModal(true)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition active:scale-95"
                      >
                        <Camera className="w-3 h-3 text-white" />
                        <span>Kamera HP</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <label className="block font-semibold uppercase tracking-wider mb-1 text-slate-600">
                  Status Surat
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LetterStatus)}
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 outline-none"
                >
                  <option value="DRAFT">DRAFT (Konsep)</option>
                  <option value="NEED_REVIEW">NEED_REVIEW (Perlu Verifikasi)</option>
                  <option value="VERIFIED">VERIFIED (Terverifikasi)</option>
                  <option value="ARCHIVED">ARCHIVED (Diarsipkan)</option>
                  <option value="TRASH">TRASH (Tempat Sampah)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSubmitting ? 'Menyimpan Perubahan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Duplicate warning popup */}
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
