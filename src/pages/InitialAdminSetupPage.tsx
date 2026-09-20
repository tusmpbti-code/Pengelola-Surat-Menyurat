import React, { useState } from 'react';
import { signUpInitialSuperAdmin } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, Mail, User, CheckCircle2, AlertCircle, Building2, KeyRound } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';

interface Props {
  onSuccess: () => void;
  onGoToLogin: () => void;
}

export const InitialAdminSetupPage: React.FC<Props> = ({ onSuccess, onGoToLogin }) => {
  const { checkSetupStatus } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const configured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!configured) {
      setErrorMsg('Koneksi Supabase belum terkonfigurasi. Buka pengaturan koneksi untuk melengkapi URL dan Anon Key.');
      return;
    }

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMsg('Semua kolom wajib diisi dengan benar.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Kata sandi dan konfirmasi kata sandi tidak cocok.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal terdiri dari 6 karakter.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await signUpInitialSuperAdmin(fullName.trim(), email.trim(), password);

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        await checkSetupStatus();
        onSuccess();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg border border-slate-800">
            <Building2 className="w-7 h-7" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          SIPAS BTI
        </h2>
        <p className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider mt-0.5">
          SMP Bhinneka Tunggal Ika
        </p>
        <div className="mt-2 text-center">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            INITIAL ADMIN SETUP (SUPER_ADMIN)
          </span>
        </div>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-base font-semibold text-slate-900">Pembuatan Akun Administrator Pertama</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Sistem mendeteksi bahwa belum ada administrator pada pangkalan data SIPAS BTI. Pengguna pertama yang didaftarkan di sini akan secara otomatis mendapatkan peran <strong>SUPER_ADMIN</strong>.
            </p>
          </div>

          {!configured && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Koneksi Supabase Belum Terhubung</p>
                <p className="mt-1 text-amber-800">
                  Pastikan Anda telah memasukkan URL dan Anon Key dari proyek Supabase Anda.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="mt-2 text-xs font-semibold text-blue-700 hover:text-blue-900 underline block"
                >
                  Konfigurasi Supabase Sekarang &rarr;
                </button>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Lengkap
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Masukkan nama lengkap Administrator"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Administrator
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="contoh: tusmpbti@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Konfirmasi Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="Ulangi kata sandi"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Mendaftarkan Administrator...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Buat Akun SUPER_ADMIN</span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              onClick={onGoToLogin}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Sudah memiliki akun? Beralih ke Halaman Login &rarr;
            </button>
          </div>
        </div>
      </div>

      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
