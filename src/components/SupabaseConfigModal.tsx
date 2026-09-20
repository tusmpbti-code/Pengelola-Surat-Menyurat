import React, { useState } from 'react';
import {
  getActiveSupabaseConfig,
  saveCustomSupabaseConfig,
  clearCustomSupabaseConfig,
  isSupabaseConfigured,
} from '../services/supabase';
import { Database, Key, CheckCircle, AlertTriangle, Copy, Check, ExternalLink, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseConfigModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const activeConfig = getActiveSupabaseConfig();
  const [url, setUrl] = useState(activeConfig.url || '');
  const [anonKey, setAnonKey] = useState(activeConfig.anonKey || '');
  const [copiedSql, setCopiedSql] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const isConfig = isSupabaseConfigured();

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      alert('Harap isi URL dan Anon Key Supabase.');
      return;
    }
    saveCustomSupabaseConfig(url, anonKey);
    setSaveSuccess(true);
  };

  const handleReset = () => {
    if (confirm('Hapus konfigurasi Supabase kustom dari browser ini?')) {
      clearCustomSupabaseConfig();
    }
  };

  const copySqlNotice = () => {
    setCopiedSql(true);
    navigator.clipboard.writeText(
      `-- Silakan jalankan file migrasi di Supabase SQL Editor:
-- /supabase/migrations/20260920000001_sipas_bti_schema.sql`
    );
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base tracking-tight">Koneksi Database Supabase — SIPAS BTI</h3>
              <p className="text-xs text-slate-400">SMP Bhinneka Tunggal Ika (Tahap 1)</p>
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
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Status Alert */}
          {isConfig ? (
            <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-sm">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Kredensial Supabase Terdeteksi Aktif</p>
                <p className="text-xs text-emerald-700 mt-1">
                  Aplikasi telah terhubung ke host Supabase. Pastikan file migrasi SQL telah dijalankan di Supabase SQL Editor.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Supabase Belum Dikonfigurasi</p>
                <p className="text-xs text-amber-800 mt-1">
                  Untuk memulai production SIPAS BTI, masukkan <strong>Project URL</strong> dan <strong>Anon Public Key</strong> dari dashboard Supabase Anda, atau isi di file environment <code>.env</code>.
                </p>
              </div>
            </div>
          )}

          {/* Form Credentials */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                VITE_SUPABASE_URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Dapat ditemukan di Supabase Dashboard &rarr; Project Settings &rarr; API &rarr; Project URL
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                VITE_SUPABASE_ANON_KEY
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Anon / Public API Key dari Supabase Project Settings. JANGAN gunakan Service Role Key di client.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium underline"
              >
                Reset ke Default
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition"
                >
                  {saveSuccess ? 'Tersimpan & Memuat...' : 'Simpan & Terapkan'}
                </button>
              </div>
            </div>
          </form>

          {/* Migration File Reference */}
          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>File Migrasi Database (PostgreSQL / Supabase)</span>
              <button
                onClick={copySqlNotice}
                className="text-[11px] font-normal text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSql ? 'Tersalin' : 'Salin Path'}
              </button>
            </h4>
            <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono">
              /supabase/migrations/20260920000001_sipas_bti_schema.sql
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Jalankan file SQL tersebut di <strong>Supabase SQL Editor</strong> untuk membuat seluruh tabel (<code>profiles</code>, <code>letters</code>, <code>letter_files</code>, <code>letter_categories</code>, <code>letter_logs</code>, <code>system_settings</code>), Row Level Security (RLS), dan bucket storage privat <code>letter-files</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
