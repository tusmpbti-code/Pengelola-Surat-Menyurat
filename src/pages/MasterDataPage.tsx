import React, { useState, useEffect } from 'react';
import { getCategories, createCategory } from '../services/letters';
import { LetterCategory } from '../types';
import { usePermissions } from '../hooks/useAuth';
import { Layers, Plus, CheckCircle2, AlertCircle, RefreshCw, FolderPlus } from 'lucide-react';

export const MasterDataPage: React.FC = () => {
  const { canManageMasterData } = usePermissions();
  const [categories, setCategories] = useState<LetterCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Gagal memuat kategori:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg('Nama kategori wajib diisi.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await createCategory({
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        is_active: true,
      });

      if (res.error) {
        setErrorMsg(res.error);
      } else {
        setName('');
        setCode('');
        setDescription('');
        setShowAddModal(false);
        loadCategories();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah kategori.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Master Data Kategori Surat</h2>
            <p className="text-xs text-slate-500">
              Klasifikasi dan kode klasifikasi arsip surat SMP Bhinneka Tunggal Ika
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadCategories}
            disabled={loading}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Kategori"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canManageMasterData && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>Tambah Kategori Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Categories List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Memuat kategori...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <FolderPlus className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">Belum Ada Kategori Surat</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Sesuai aturan data, pangkalan data dimulai dalam kondisi kosong tanpa data dummy. Silakan tambahkan kategori resmi yang digunakan di Tata Usaha sekolah (misalnya: Dinas, Kesiswaan, Kepegawaian, Sarana Prasarana).
            </p>
            {canManageMasterData && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                Tambah Kategori Sekarang
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Kode</th>
                  <th className="px-5 py-3">Nama Kategori</th>
                  <th className="px-5 py-3">Deskripsi</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Dibuat Pada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="px-5 py-3 font-mono font-bold text-slate-800">{c.code || '-'}</td>
                    <td className="px-5 py-3 font-semibold text-slate-900">{c.name}</td>
                    <td className="px-5 py-3 text-slate-600">{c.description || '-'}</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {c.is_active ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-200 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Tambah Kategori Surat</h3>
            <p className="text-xs text-slate-500 mt-1">
              Buat kategori klasifikasi surat resmi untuk SMP Bhinneka Tunggal Ika.
            </p>

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Surat Edaran Dinas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Klasifikasi</label>
                <input
                  type="text"
                  placeholder="Contoh: 421.3 atau ED/01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi Kategori</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan penggunaan kategori"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 focus:border-blue-600 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Kategori'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
