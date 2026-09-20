import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { sendPasswordReset } from '../services/auth';
import { Lock, Mail, Building2, LogIn, AlertCircle, CheckCircle2, Shield, Settings } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase';
import { SupabaseConfigModal } from '../components/SupabaseConfigModal';

interface Props {
  onGoToSetup: () => void;
  onSuccess: () => void;
}

export const LoginPage: React.FC<Props> = ({ onGoToSetup, onSuccess }) => {
  const { signIn, isSetupRequired } = useAuth();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  const configured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccess(null);

    if (!configured) {
      setErrorMsg('Supabase belum terkonfigurasi. Silakan lengkapi URL dan Anon Key di modal konfigurasi.');
      return;
    }

    if (!email.trim() || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk ke sistem.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setResetLoading(true);
    try {
      const res = await sendPasswordReset(resetEmail.trim());
      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setResetSuccess('Tautan pemulihan kata sandi telah dikirim ke email Anda.');
        setShowResetModal(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email reset.';
      setErrorMsg(msg);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {settings?.school_logo ? (
            <div className="w-20 h-20 rounded-2xl bg-white p-2 shadow-lg border border-slate-200 flex items-center justify-center overflow-hidden">
              <img
                src={settings.school_logo}
                alt="Logo Sekolah"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg border border-slate-800">
              <Building2 className="w-7 h-7" />
            </div>
          )}
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          SIPAS BTI
        </h2>
        <p className="text-center text-xs font-semibold text-slate-600 uppercase tracking-wider mt-0.5">
          Sistem Pengarsipan Surat
        </p>
        <p className="text-center text-xs text-slate-500">
          {settings?.school_name || 'SMP Bhinneka Tunggal Ika'}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          {/* Setup Alert Banner if no users exist */}
          {isSetupRequired && (
            <div className="mb-6 p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
              <div className="flex items-start gap-2.5">
                <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Sistem Belum Memiliki Administrator</p>
                  <p className="mt-1 text-purple-700">
                    Silakan lakukan inisialisasi akun administrator pertama (SUPER_ADMIN).
                  </p>
                  <button
                    type="button"
                    onClick={onGoToSetup}
                    className="mt-2 text-xs font-bold text-purple-800 hover:text-purple-950 underline"
                  >
                    Buka Initial Admin Setup &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {!configured && (
            <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Koneksi Supabase Belum Dikonfigurasi</p>
                <p className="mt-1">
                  Kredensial <code>VITE_SUPABASE_URL</code> dan <code>VITE_SUPABASE_ANON_KEY</code> belum tersedia di environment.
                </p>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(true)}
                  className="mt-1.5 font-bold text-amber-900 underline block"
                >
                  Buka Pengaturan Supabase & Migrasi SQL
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

          {resetSuccess && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{resetSuccess}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="nama@sekolah.sch.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowResetModal(true);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  <span>Memeriksa Akses...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 text-emerald-400" />
                    <span>Masuk ke SIPAS BTI</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer actions */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col gap-2.5 text-center">
            <button
              type="button"
              onClick={onGoToSetup}
              className="text-xs text-purple-700 hover:text-purple-900 font-semibold"
            >
              Belum ada Admin? Buka Initial Admin Setup &rarr;
            </button>
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Pengaturan Koneksi & Migrasi SQL Supabase</span>
            </button>
          </div>
        </div>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-slate-200 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Reset Kata Sandi</h3>
            <p className="text-xs text-slate-500 mt-1">
              Masukkan email akun Anda. Supabase Auth akan mengirimkan instruksi pemulihan kata sandi.
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Terdaftar</label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:border-blue-600 outline-none"
                  placeholder="nama@sekolah.sch.id"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {resetLoading ? 'Mengirim...' : 'Kirim Tautan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
};
