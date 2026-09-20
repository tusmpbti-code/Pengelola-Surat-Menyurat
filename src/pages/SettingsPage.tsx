import React, { useState, useEffect, useRef } from 'react';
import { getSystemSettings, saveSystemSettings } from '../services/settings';
import { SystemSettings } from '../types';
import { usePermissions } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';
import {
  Settings,
  Building2,
  Save,
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  ShieldAlert,
  Upload,
  Trash2,
  Image as ImageIcon,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';

export const SettingsPage: React.FC = () => {
  const { isSuperAdmin } = usePermissions();
  const { refreshSettings, updateSettingsState } = useSettings();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form states (all start null/empty unless entered)
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolPhone, setSchoolPhone] = useState('');
  const [schoolEmail, setSchoolEmail] = useState('');
  const [schoolWebsite, setSchoolWebsite] = useState('');
  const [schoolLogo, setSchoolLogo] = useState('');
  const [headOfTuName, setHeadOfTuName] = useState('');
  const [headOfTuPosition, setHeadOfTuPosition] = useState('');
  const [logoFileSize, setLogoFileSize] = useState<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await getSystemSettings();
      if (data) {
        setSettings(data);
        setSchoolName(data.school_name || '');
        setSchoolAddress(data.school_address || '');
        setSchoolPhone(data.school_phone || '');
        setSchoolEmail(data.school_email || '');
        setSchoolWebsite(data.school_website || '');
        setSchoolLogo(data.school_logo || '');
        setHeadOfTuName(data.head_of_tu_name || '');
        setHeadOfTuPosition(data.head_of_tu_position || '');
      }
    } catch (err) {
      console.error('Gagal memuat pengaturan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  /**
   * Helper untuk mengompres & mengonversi gambar ke Base64 Data URL optimal
   */
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (!result) {
          reject(new Error('Gagal membaca berkas gambar.'));
          return;
        }

        // Jika SVG, simpan langsung
        if (file.type === 'image/svg+xml') {
          resolve(result);
          return;
        }

        const img = new Image();
        img.onload = () => {
          const maxDim = 512;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          // Export as PNG untuk transparansi logo
          const optimizedDataUrl = canvas.toDataURL('image/png', 0.9);
          resolve(optimizedDataUrl);
        };
        img.onerror = () => reject(new Error('Gagal memproses dimensi gambar logo.'));
        img.src = result;
      };
      reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isSuperAdmin) {
      setErrorMsg('Hanya SUPER_ADMIN yang dapat mengubah logo sekolah.');
      return;
    }

    // Validasi tipe
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Format berkas tidak didukung. Harap pilih gambar PNG, JPG, WEBP, atau SVG.');
      return;
    }

    // Validasi ukuran maks 5MB
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Ukuran berkas melebihi 5 MB. Harap gunakan logo dengan ukuran yang lebih kecil.');
      return;
    }

    try {
      setUploadingLogo(true);
      setErrorMsg(null);
      const dataUrl = await processImageFile(file);
      setSchoolLogo(dataUrl);

      // Hitung perkiraan ukuran
      const approxKb = Math.round((dataUrl.length * 3) / 4 / 1024);
      setLogoFileSize(`${approxKb} KB`);
      setSuccessMsg(`Logo berhasil dimuat (${approxKb} KB). Klik "Simpan Pengaturan" untuk menerapkan secara permanen.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memproses gambar logo.';
      setErrorMsg(msg);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    if (!isSuperAdmin) {
      setErrorMsg('Hanya SUPER_ADMIN yang dapat menghapus logo sekolah.');
      return;
    }
    setSchoolLogo('');
    setLogoFileSize(null);
    setSuccessMsg('Logo sekolah dihapus dari draf. Klik "Simpan Pengaturan" untuk memperbarui database.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      setErrorMsg('Hanya SUPER_ADMIN yang memiliki izin untuk memperbarui pengaturan sistem.');
      return;
    }

    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await saveSystemSettings({
        school_name: schoolName.trim() || null,
        school_address: schoolAddress.trim() || null,
        school_phone: schoolPhone.trim() || null,
        school_email: schoolEmail.trim() || null,
        school_website: schoolWebsite.trim() || null,
        school_logo: schoolLogo.trim() || null,
        head_of_tu_name: headOfTuName.trim() || null,
        head_of_tu_position: headOfTuPosition.trim() || null,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setSuccessMsg('Pengaturan identitas sekolah dan logo resmi berhasil disimpan.');
        if (res.data) {
          setSettings(res.data);
          updateSettingsState(res.data);
        }
        // Refresh context secara global agar semua komponen langsung bereaksi
        await refreshSettings();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.';
      setErrorMsg(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Pengaturan Sistem — SIPAS BTI</h2>
            <p className="text-xs text-slate-500">
              Konfigurasi identitas SMP Bhinneka Tunggal Ika, logo resmi, dan Pejabat Tata Usaha
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowConfigModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs"
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Konfigurasi Supabase & SQL</span>
        </button>
      </div>

      {!isSuperAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Anda sedang melihat pengaturan dalam mode hanya-baca. Hanya SUPER_ADMIN yang dapat mengubah data.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-6 text-xs">
        {/* SECTION 1: UPLOAD LOGO SEKOLAH RESMI */}
        <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-600" />
                Logo Resmi Sekolah
              </h3>
              <p className="text-slate-500 text-xs mt-1 max-w-xl">
                Logo ini akan otomatis tampil di <strong>Halaman Login</strong>, <strong>Dashboard Pengarsipan</strong>, <strong>Kop Dokumen & Jurnal Resmi (Print & PDF)</strong>, serta <strong>Bilah Navigasi Utama</strong>.
              </p>
            </div>
            {schoolLogo && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Logo Terpasang {logoFileSize ? `(${logoFileSize})` : ''}
              </span>
            )}
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Logo Preview Box */}
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center p-2.5 shadow-2xs overflow-hidden transition group-hover:border-emerald-500">
                {schoolLogo ? (
                  <img
                    src={schoolLogo}
                    alt="Logo Sekolah"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 text-center p-2">
                    <Building2 className="w-10 h-10 mb-1 text-slate-300" />
                    <span className="text-[10px] font-medium leading-tight">Belum ada logo</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons & Info */}
            <div className="flex-1 space-y-3 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleFileChange}
                  disabled={!isSuperAdmin || uploadingLogo}
                  className="hidden"
                  id="school-logo-input"
                />

                <label
                  htmlFor={isSuperAdmin && !uploadingLogo ? 'school-logo-input' : undefined}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition ${
                    isSuperAdmin && !uploadingLogo
                      ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {uploadingLogo ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>{schoolLogo ? 'Ganti Logo' : 'Unggah Logo Sekolah'}</span>
                </label>

                {schoolLogo && isSuperAdmin && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs transition"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Hapus Logo</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] text-slate-500 space-y-1">
                <p>
                  &bull; Format yang didukung: <strong>PNG, JPG, JPEG, WEBP, SVG</strong> (Maksimal 5 MB).
                </p>
                <p>
                  &bull; Disarankan menggunakan logo dengan latar belakang transparan (PNG) untuk hasil cetak dan tampilan terbaik.
                </p>
                <p>
                  &bull; Sistem secara otomatis mengoptimalkan resolusi logo agar ringan saat dimuat dan tajam saat dicetak dalam berkas PDF.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: IDENTITAS SEKOLAH */}
        <div>
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            Identitas Sekolah
          </h3>
          <p className="text-slate-500 text-xs mb-4">
            Data ini digunakan untuk kop surat resmi dan metadata dokumen. Semua nilai awal kosong hingga diisi oleh administrator.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Sekolah Resmi</label>
              <input
                type="text"
                placeholder="Contoh: SMP Bhinneka Tunggal Ika"
                value={schoolName}
                disabled={!isSuperAdmin}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon Sekolah</label>
              <input
                type="text"
                placeholder="Nomor telepon resmi TU sekolah"
                value={schoolPhone}
                disabled={!isSuperAdmin}
                onChange={(e) => setSchoolPhone(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Alamat Lengkap Sekolah</label>
              <textarea
                rows={2}
                placeholder="Alamat jalan, kelurahan, kecamatan, kota/kabupaten, kode pos"
                value={schoolAddress}
                disabled={!isSuperAdmin}
                onChange={(e) => setSchoolAddress(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none resize-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Alamat Email Resmi</label>
              <input
                type="email"
                placeholder="email@sekolah.sch.id"
                value={schoolEmail}
                disabled={!isSuperAdmin}
                onChange={(e) => setSchoolEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Website Sekolah</label>
              <input
                type="url"
                placeholder="https://smpbti.sch.id"
                value={schoolWebsite}
                disabled={!isSuperAdmin}
                onChange={(e) => setSchoolWebsite(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: PEJABAT TATA USAHA */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 mb-1">
            Pejabat Tata Usaha
          </h3>
          <p className="text-slate-500 text-xs mb-4">
            Penanggung jawab administrasi persuratan dan pengarsipan sekolah.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nama Kepala Tata Usaha</label>
              <input
                type="text"
                placeholder="Nama lengkap beserta gelar Kepala TU"
                value={headOfTuName}
                disabled={!isSuperAdmin}
                onChange={(e) => setHeadOfTuName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Jabatan Resmi Kepala TU</label>
              <input
                type="text"
                placeholder="Contoh: Kepala Tata Usaha SMP Bhinneka Tunggal Ika"
                value={headOfTuPosition}
                disabled={!isSuperAdmin}
                onChange={(e) => setHeadOfTuPosition(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none disabled:bg-slate-50"
              />
            </div>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
            </button>
          </div>
        )}
      </form>

      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};

