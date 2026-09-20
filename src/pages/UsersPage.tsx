import React, { useState, useEffect } from 'react';
import { getProfiles, updateProfileRole, toggleProfileActive } from '../services/users';
import { Profile, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await getProfiles();
      setProfiles(data);
    } catch (err) {
      console.error('Gagal memuat pengguna:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
      if (!confirm('Apakah Anda yakin ingin mengubah role akun Anda sendiri?')) return;
    }

    setUpdatingId(userId);
    try {
      const res = await updateProfileRole(userId, newRole);
      if (res.success) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
        );
      } else {
        alert(res.error || 'Gagal mengubah role');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    if (userId === currentUser?.id) {
      alert('Anda tidak dapat menonaktifkan akun yang sedang aktif digunakan.');
      return;
    }

    setUpdatingId(userId);
    try {
      const res = await toggleProfileActive(userId, !currentStatus);
      if (res.success) {
        setProfiles((prev) =>
          prev.map((p) => (p.id === userId ? { ...p, is_active: !currentStatus } : p))
        );
      } else {
        alert(res.error || 'Gagal mengubah status aktif user');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Manajemen Pengguna & Role</h2>
            <p className="text-xs text-slate-500">
              Hak akses RBAC (Row Level Security): SUPER_ADMIN, ADMIN, VIEWER
            </p>
          </div>
        </div>

        <button
          onClick={loadProfiles}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Pengguna</span>
        </button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-purple-700 font-bold text-xs uppercase">
            <Shield className="w-4 h-4 text-purple-600" />
            SUPER_ADMIN
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Seluruh akses: pengaturan sistem, manajemen pengguna, master data, surat, arsip, laporan, dan audit log.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-blue-700 font-bold text-xs uppercase">
            <Shield className="w-4 h-4 text-blue-600" />
            ADMIN
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Akses operasional: surat masuk, surat keluar, upload dokumen, edit, verifikasi, pencarian, dan laporan.
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase">
            <Shield className="w-4 h-4 text-slate-500" />
            VIEWER
          </div>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">
            Akses baca arsip terverifikasi, pencarian surat, preview dokumen, dan unduhan berkas.
          </p>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Daftar Pengguna SIPAS BTI
          </h3>
          <span className="text-xs text-slate-400">Total Akun: {profiles.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Memuat profil pengguna...</div>
        ) : profiles.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Belum ada akun pengguna yang terdaftar di pangkalan data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Nama Lengkap</th>
                  <th className="px-5 py-3">Email Akun</th>
                  <th className="px-5 py-3">Role Saat Ini</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Terdaftar</th>
                  <th className="px-5 py-3 text-right">Ubah Role</th>
                  <th className="px-5 py-3 text-right">Status Akun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {p.full_name || 'Tanpa Nama'}
                      {p.id === currentUser?.id && (
                        <span className="ml-2 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-normal">
                          (Anda)
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono">{p.email}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          p.role === 'SUPER_ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : p.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 text-[11px] font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          Non-aktif
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {new Date(p.created_at).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <select
                        value={p.role}
                        disabled={updatingId === p.id}
                        onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-700 focus:border-blue-600 outline-none"
                      >
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => handleToggleActive(p.id, p.is_active)}
                        disabled={updatingId === p.id || p.id === currentUser?.id}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition disabled:opacity-40 ${
                          p.is_active
                            ? 'text-rose-700 hover:bg-rose-50 border border-rose-200'
                            : 'text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
                        }`}
                      >
                        {p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
