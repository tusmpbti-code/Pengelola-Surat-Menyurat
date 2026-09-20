import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import * as mammoth from 'mammoth';
import {
  FileText,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileCode,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

// Inisialisasi Worker PDF.js
try {
  // Gunakan worker CDN yang kompatibel dengan versi pdfjsLib
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch (workerErr) {
  console.warn('PDF.js worker init warning:', workerErr);
}

export interface UnifiedDocumentViewerProps {
  // Sumber dokumen bisa berupa File object (baru dipilih) atau URL yang sudah ada
  file?: File | null;
  fileUrl?: string | null;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  className?: string;
  maxHeight?: string;
}

export const UnifiedDocumentViewer: React.FC<UnifiedDocumentViewerProps> = ({
  file,
  fileUrl,
  fileName = 'Dokumen Surat',
  fileSize,
  mimeType = '',
  className = '',
  maxHeight = '600px',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  // PDF specific states
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [isRenderingPdf, setIsRenderingPdf] = useState<boolean>(false);

  // Word specific states
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [wordRawText, setWordRawText] = useState<string | null>(null);
  const [wordViewMode, setWordViewMode] = useState<'html' | 'text'>('html');

  // Deteksi nama file dan ekstensi
  const resolvedFileName = file ? file.name : fileName;
  const resolvedMime = (file?.type || mimeType || '').toLowerCase();
  const lowerName = resolvedFileName.toLowerCase();

  const isPdf =
    resolvedMime.includes('pdf') || lowerName.endsWith('.pdf');

  const isDocx =
    resolvedMime.includes('wordprocessingml') ||
    lowerName.endsWith('.docx');

  const isDoc =
    resolvedMime.includes('msword') ||
    (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx'));

  const isWord = isDocx || isDoc;

  const isImage =
    resolvedMime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp'].some((ext) => lowerName.endsWith(`.${ext}`));

  const resolvedSizeMb = file
    ? (file.size / (1024 * 1024)).toFixed(2)
    : fileSize
    ? (fileSize / (1024 * 1024)).toFixed(2)
    : null;

  // Persiapkan URL berkas (Blob URL jika File object, atau fileUrl)
  useEffect(() => {
    let objectUrl: string | null = null;
    if (file) {
      objectUrl = URL.createObjectURL(file);
      setActiveUrl(objectUrl);
    } else if (fileUrl) {
      setActiveUrl(fileUrl);
    } else {
      setActiveUrl(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, fileUrl]);

  // Load dan proses dokumen berdasarkan tipe
  useEffect(() => {
    let isCancelled = false;

    const loadDocument = async () => {
      if (!activeUrl) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setWordHtml(null);
      setWordRawText(null);
      setPdfDoc(null);

      try {
        if (isPdf) {
          // Render PDF menggunakan PDF.js Canvas (Bebas blokir Chrome)
          const loadingTask = pdfjsLib.getDocument({
            url: activeUrl,
            cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + pdfjsLib.version + '/cmaps/',
            cMapPacked: true,
          });

          const loadedPdf = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(loadedPdf);
          setNumPages(loadedPdf.numPages);
          setPageNum(1);
          setLoading(false);
        } else if (isWord) {
          // Render Word menggunakan mammoth
          let arrayBuffer: ArrayBuffer;
          if (file) {
            arrayBuffer = await file.arrayBuffer();
          } else {
            const resp = await fetch(activeUrl);
            if (!resp.ok) throw new Error('Gagal mengunduh berkas Word.');
            arrayBuffer = await resp.arrayBuffer();
          }

          if (isCancelled) return;

          if (isDocx) {
            try {
              const [htmlResult, textResult] = await Promise.all([
                mammoth.convertToHtml({ arrayBuffer }),
                mammoth.extractRawText({ arrayBuffer }),
              ]);
              if (isCancelled) return;
              setWordHtml(htmlResult.value);
              setWordRawText(textResult.value);
            } catch (convErr) {
              console.warn('Mammoth convert warning:', convErr);
              // Fallback raw text parsing jika HTML gagal
              const textResult = await mammoth.extractRawText({ arrayBuffer }).catch(() => null);
              if (textResult?.value) {
                setWordRawText(textResult.value);
                setWordViewMode('text');
              } else {
                setWordHtml(null);
              }
            }
          }
          setLoading(false);
        } else if (isImage) {
          setLoading(false);
        } else {
          // Format umum
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isCancelled) return;
        console.error('UnifiedDocumentViewer load error:', err);
        const msg = err instanceof Error ? err.message : 'Gagal memuat pratinjau berkas.';
        setError(msg);
        setLoading(false);
      }
    };

    loadDocument();

    return () => {
      isCancelled = true;
    };
  }, [activeUrl, isPdf, isWord, isDocx, isImage, file]);

  // Render halaman PDF ke Canvas setiap kali pageNum atau scale berubah
  useEffect(() => {
    let isCancelled = false;
    let renderTask: any = null;

    const renderPdfPage = async () => {
      if (!pdfDoc || !canvasRef.current || !isPdf) return;

      setIsRenderingPdf(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Atur resolusi retina/HiDPI
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          transform: transform,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (renderErr: any) {
        if (renderErr?.name !== 'RenderingCancelledException') {
          console.warn('PDF Page render warning:', renderErr);
        }
      } finally {
        if (!isCancelled) {
          setIsRenderingPdf(false);
        }
      }
    };

    renderPdfPage();

    return () => {
      isCancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          // ignore cancel error
        }
      }
    };
  }, [pdfDoc, pageNum, scale, isPdf]);

  // Navigasi PDF
  const handlePrevPage = () => {
    if (pageNum > 1) setPageNum(pageNum - 1);
  };

  const handleNextPage = () => {
    if (pageNum < numPages) setPageNum(pageNum + 1);
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 2.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1.2);
  };

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs flex flex-col ${className}`}
    >
      {/* TOOLBAR ATAS */}
      <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs select-none">
        {/* Identitas Dokumen */}
        <div className="flex items-center gap-2 min-w-0 max-w-[280px] sm:max-w-md">
          {isWord ? (
            <div className="w-5 h-5 rounded bg-blue-700 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
              W
            </div>
          ) : isPdf ? (
            <div className="w-5 h-5 rounded bg-rose-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
              PDF
            </div>
          ) : (
            <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          )}

          <span className="font-semibold truncate text-slate-100" title={resolvedFileName}>
            {resolvedFileName}
          </span>
          {resolvedSizeMb && (
            <span className="text-[10px] text-slate-400 shrink-0">
              ({resolvedSizeMb} MB)
            </span>
          )}
        </div>

        {/* Kontrol Interaktif Sesuai Tipe */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Kontrol Khusus PDF */}
          {isPdf && pdfDoc && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-800/80 px-2 py-1 rounded-lg text-slate-300 text-[11px] border border-slate-700/60">
              <button
                onClick={handlePrevPage}
                disabled={pageNum <= 1 || isRenderingPdf}
                title="Halaman Sebelumnya"
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-medium px-1">
                {pageNum} / {numPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={pageNum >= numPages || isRenderingPdf}
                title="Halaman Selanjutnya"
                className="p-1 rounded hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="h-3 w-px bg-slate-700 mx-1" />

              <button
                onClick={handleZoomOut}
                title="Perkecil"
                className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] w-9 text-center font-mono">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                title="Perbesar"
                className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                title="Reset Ukuran"
                className="p-1 rounded hover:bg-slate-700 text-slate-300 transition"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Kontrol Khusus Word */}
          {isWord && wordRawText && wordHtml && (
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setWordViewMode('html')}
                className={`px-2 py-0.5 rounded-md font-medium transition ${
                  wordViewMode === 'html'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dokumen
              </button>
              <button
                type="button"
                onClick={() => setWordViewMode('text')}
                className={`px-2 py-0.5 rounded-md font-medium transition ${
                  wordViewMode === 'text'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Teks Mentah
              </button>
            </div>
          )}

          {/* Aksi Buka & Unduh */}
          {activeUrl && (
            <div className="flex items-center gap-1.5">
              <a
                href={activeUrl}
                target="_blank"
                rel="noreferrer"
                title="Buka dokumen di tab browser baru"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="hidden sm:inline">Tab Baru</span>
              </a>
              <a
                href={activeUrl}
                download={resolvedFileName}
                title="Unduh berkas fisik ke komputer"
                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs"
              >
                <Download className="w-3 h-3" />
                <span className="hidden sm:inline">Unduh</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* CONTAINER PRATINJAU DOKUMEN */}
      <div
        ref={containerRef}
        style={{ maxHeight }}
        className="p-4 bg-slate-100 flex-1 flex flex-col items-center justify-start overflow-auto relative min-h-[360px]"
      >
        {loading ? (
          <div className="my-auto text-center p-8 text-slate-500 text-xs">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-slate-400 mb-2.5" />
            <p className="font-semibold text-slate-700">Mempersiapkan pratinjau dokumen...</p>
            <p className="text-[11px] text-slate-400 mt-1">Memproses berkas tanpa pembatasan browser</p>
          </div>
        ) : error ? (
          <div className="my-auto text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
              Pratinjau Langsung Tidak Tersedia
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 mb-4 leading-relaxed">
              {error}
            </p>
            {activeUrl && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <a
                  href={activeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl transition shadow-2xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru</span>
                </a>
                <a
                  href={activeUrl}
                  download={resolvedFileName}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl transition shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Dokumen</span>
                </a>
              </div>
            )}
          </div>
        ) : isPdf ? (
          /* PDF CANVAS VIEWER (Anti-Block Chrome) */
          <div className="flex flex-col items-center justify-center w-full py-2">
            <div className="relative shadow-md rounded-lg overflow-hidden border border-slate-300 bg-white">
              {isRenderingPdf && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-2xs flex items-center justify-center z-10">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                </div>
              )}
              <canvas ref={canvasRef} className="block max-w-full" />
            </div>

            {/* Navigasi Mobile Bar Bawah */}
            {numPages > 1 && (
              <div className="mt-3 sm:hidden flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs text-xs text-slate-700 font-medium">
                <button
                  onClick={handlePrevPage}
                  disabled={pageNum <= 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span>
                  Halaman {pageNum} dari {numPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={pageNum >= numPages}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : isWord ? (
          /* MICROSOFT WORD VIEWER (.docx / .doc) */
          <div className="w-full max-w-3xl py-2">
            {isDocx && wordHtml && wordViewMode === 'html' ? (
              <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6 sm:p-10 font-serif text-slate-900 leading-relaxed text-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs font-sans text-slate-500">
                  <span className="flex items-center gap-1.5 font-semibold text-blue-700">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                    Pratinjau Dokumen Microsoft Word (.docx)
                  </span>
                  <span>{resolvedFileName}</span>
                </div>
                {/* Render HTML hasil konversi mammoth */}
                <div
                  className="word-rendered-content prose prose-slate max-w-none text-slate-800"
                  dangerouslySetInnerHTML={{ __html: wordHtml }}
                />
              </div>
            ) : isDocx && wordRawText && wordViewMode === 'text' ? (
              <div className="bg-white rounded-xl border border-slate-300 shadow-md p-6 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-auto">
                {wordRawText}
              </div>
            ) : (
              /* Kartu Dokumen Word (Jika .doc biner lama atau parsing visual selesai) */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center max-w-md mx-auto space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center mx-auto shadow-2xs">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 mb-1.5">
                    Microsoft Word {isDocx ? '(.docx)' : '(.doc)'}
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{resolvedFileName}</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {resolvedSizeMb ? `Ukuran: ${resolvedSizeMb} MB` : 'Berkas resmi surat'}
                  </p>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed max-w-xs mx-auto">
                  Berkas surat Microsoft Word telah terhubung aman dengan sistem SIPAS BTI. Klik tombol di bawah untuk membuka atau mengunduhnya.
                </p>
                {activeUrl && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                    <a
                      href={activeUrl}
                      download={resolvedFileName}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Unduh Dokumen Word</span>
                    </a>
                    <a
                      href={activeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-300 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Tab Baru</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : isImage && activeUrl ? (
          /* GAMBAR (PNG, JPG, WEBP) */
          <div className="my-auto flex items-center justify-center p-2">
            <img
              src={activeUrl}
              alt={resolvedFileName}
              referrerPolicy="no-referrer"
              className="max-h-[500px] max-w-full object-contain rounded-xl shadow-md border border-slate-300 bg-white"
            />
          </div>
        ) : (
          /* FORMAT LAINNYA */
          <div className="my-auto text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-800 text-xs sm:text-sm">
              Berkas {resolvedFileName}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 mb-4 leading-relaxed">
              Berkas tersimpan aman di arsip surat. Klik unduh untuk membuka berkas dengan aplikasi di perangkat Anda.
            </p>
            {activeUrl && (
              <a
                href={activeUrl}
                download={resolvedFileName}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 rounded-xl shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Berkas ({resolvedFileName})</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
