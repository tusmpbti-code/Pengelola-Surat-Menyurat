import React, { useState, useEffect } from 'react';
import { getLetterLogs } from '../services/letters';
import { LetterLog } from '../types';
import { ScrollText, RefreshCw, Clock, User, ShieldCheck, ArrowRight } from 'lucide-react';

interface AuditLogPageProps {
  onNavigateToDetail?: (id: string) => void;
}

export const AuditLogPage: React.FC<AuditLogPageProps> = ({ onNavigateToDetail }) => {
  const [logs, setLogs] = useState<LetterLog[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await getLetterLogs(100);
      setLogs(data);
    } catch (err) {
      console.error('Gagal memuat audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-slate-900 text-emerald-400 rounded-xl">
            <ScrollText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Audit Log Aktivitas Persuratan</h2>
            <p className="text-xs text-slate-500">
              Riwayat jejak audit (CREATE, UPDATE, VERIFY, ARCHIVE, DELETE, RESTORE) di SIPAS BTI
            </p>
          </div>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Log</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Rekaman Aktivitas Sistem
          </h3>
          <span className="text-xs text-slate-400">Total entri log: {logs.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500">Memuat rekam aktivitas...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Belum ada aktivitas persuratan yang tercatat di tabel log.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-5 py-3">Aksi</th>
                  <th className="px-5 py-3">Pengguna</th>
                  <th className="px-5 py-3">Deskripsi Aktivitas</th>
                  <th className="px-5 py-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`hover:bg-slate-50/70 transition ${
                      log.letter_id ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => {
                      if (log.letter_id && onNavigateToDetail) {
                        onNavigateToDetail(log.letter_id);
                      }
                    }}
                  >
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
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
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {log.action === 'AI_PROCESSING' ? '✨ AI_PROCESSING' : log.action}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-800 font-medium">
                      {log.user ? log.user.full_name || log.user.email : 'Sistem'}
                    </td>
                    <td className="px-5 py-3 text-slate-900">{log.description}</td>
                    <td className="px-5 py-3 text-right">
                      {log.letter_id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToDetail) {
                              onNavigateToDetail(log.letter_id!);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-[11px]"
                        >
                          <span>Buka Surat</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
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
