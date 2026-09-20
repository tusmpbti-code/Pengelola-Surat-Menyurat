import React, { useState, useEffect } from 'react';
import { LetterFile, Letter } from '../types';
import { getSignedFileUrl } from '../services/supabase';
import { usePermissions } from '../hooks/useAuth';
import { UnifiedDocumentViewer } from './UnifiedDocumentViewer';
import {
  Loader2,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface DocumentPreviewProps {
  file: LetterFile;
  letter: Letter;
  onDownload?: () => void;
  className?: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  file,
  letter,
  className = '',
}) => {
  const { isSuperAdmin, isAdmin } = usePermissions();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission check: Viewer can only view VERIFIED or ARCHIVED letters
  const hasPermission =
    isSuperAdmin ||
    isAdmin ||
    ['VERIFIED', 'ARCHIVED'].includes(letter.status);

  const fetchUrl = async () => {
    if (!hasPermission) {
      setError('Anda tidak memiliki izin untuk melihat pratinjau dokumen ini. Dokumen belum diverifikasi atau diarsipkan.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = await getSignedFileUrl(file.file_path, 3600);
      if (url) {
        setSignedUrl(url);
      } else {
        setError('Gagal membuat URL aman untuk pratinjau dokumen.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat berkas.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrl();
  }, [file.file_path, letter.status, hasPermission]);

  if (!hasPermission) {
    return (
      <div className={`p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2 ${className}`}>
        <Lock className="w-8 h-8 text-slate-400 mx-auto" />
        <h4 className="text-xs font-bold text-slate-700">Akses Pratinjau Terbatas</h4>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
          Sebagai Viewer, Anda hanya dapat mengakses berkas surat yang telah berstatus <span className="font-semibold text-emerald-600">VERIFIED</span> atau <span className="font-semibold text-blue-600">ARCHIVED</span>.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 text-xs shadow-2xs ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400 mb-2" />
        <p className="font-semibold text-slate-700">Menghasilkan URL aman berkas arsip...</p>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className={`rounded-2xl border border-rose-200 bg-rose-50/50 p-6 text-center text-xs shadow-2xs ${className}`}>
        <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
        <p className="font-semibold text-rose-700 mb-1">Gagal Memuat Berkas</p>
        <p className="text-[11px] text-slate-500 leading-relaxed mb-3">{error || 'URL berkas tidak tersedia.'}</p>
        <button
          onClick={fetchUrl}
          className="px-3.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-700 shadow-2xs"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <UnifiedDocumentViewer
      fileUrl={signedUrl}
      fileName={file.file_name}
      fileSize={file.file_size}
      mimeType={file.file_type}
      className={className}
      maxHeight="580px"
    />
  );
};
