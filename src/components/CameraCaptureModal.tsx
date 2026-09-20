import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  RotateCcw,
  X,
  Check,
  RefreshCw,
  AlertCircle,
  Smartphone,
  Sparkles,
} from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  title = 'Foto Surat Fisik via Kamera HP',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nativeFileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Periksa apakah perangkat memiliki beberapa kamera (depan & belakang)
  useEffect(() => {
    if (!isOpen) return;

    if (navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      }).catch(() => {
        // Abaikan jika tidak diizinkan enumerate
      });
    }
  }, [isOpen]);

  // Mulai kamera saat modal terbuka atau saat facingMode berubah
  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      setCapturedDataUrl(null);
      setError(null);
      return;
    }

    startCamera();

    return () => {
      stopCameraStream();
    };
  }, [isOpen, facingMode]);

  const stopCameraStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    stopCameraStream();
    setError(null);
    setIsStartingCamera(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(
          'Browser ini tidak mendukung akses kamera langsung. Silakan gunakan tombol "Buka Kamera Bawaan HP".'
        );
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err: unknown) {
      console.warn('Gagal mengakses kamera via getUserMedia:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Izin kamera belum diberikan atau perangkat tidak memiliki kamera aktif.';

      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setError(
          'Izin kamera tidak diizinkan oleh browser. Anda dapat mengaktifkannya di pengaturan browser, atau gunakan tombol "Kamera Bawaan HP" di bawah.'
        );
      } else {
        setError(
          'Kamera langsung belum dapat diakses pada browser ini. Silakan gunakan tombol "Kamera Bawaan HP" di bawah untuk langsung memotret dokumen surat.'
        );
      }
    } finally {
      setIsStartingCamera(false);
    }
  };

  // Switch kamera depan/belakang
  const handleToggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Jepret foto dari video stream
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Jika kamera depan, balik secara horizontal agar seperti cermin
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedDataUrl(dataUrl);
    stopCameraStream();
  };

  // Ulangi pengambilan foto
  const handleRetake = () => {
    setCapturedDataUrl(null);
    startCamera();
  };

  // Gunakan foto hasil jepretan
  const handleConfirmPhoto = () => {
    if (!capturedDataUrl) return;

    try {
      // Konversi Data URL ke File object
      const arr = capturedDataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      const now = new Date();
      const timestamp = now
        .toISOString()
        .replace(/[-:T]/g, '')
        .slice(0, 14);
      const fileName = `surat_kamera_${timestamp}.jpg`;

      const file = new File([u8arr], fileName, { type: mime });
      onCapture(file);
      onClose();
    } catch (e) {
      console.error('Gagal mengonversi foto:', e);
      setError('Gagal memproses foto.');
    }
  };

  // Tangani hasil tangkapan dari native camera file input
  const handleNativeCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(file);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 text-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]">
        {/* Header Modal */}
        <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-wide">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400">
                Posisikan surat fisik pada bidang kamera dengan pencahayaan cukup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden Canvas & Native Camera Input */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={nativeFileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraCapture}
          className="hidden"
        />

        {/* Viewport Kamera / Pratinjau Foto */}
        <div className="relative bg-black flex-1 min-h-[360px] sm:min-h-[420px] flex items-center justify-center overflow-hidden">
          {capturedDataUrl ? (
            /* Tampilan Foto yang Berhasil Diambil */
            <div className="relative w-full h-full flex items-center justify-center">
              <img
                src={capturedDataUrl}
                alt="Hasil Tangkapan Surat"
                className="max-h-[500px] w-auto max-w-full object-contain"
              />
              <div className="absolute top-3 left-3 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 backdrop-blur-xs">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>Foto Berhasil Diambil</span>
              </div>
            </div>
          ) : error ? (
            /* Tampilan Jika Kamera Web Terkendala / Izin Ditolak */
            <div className="p-6 text-center max-w-sm mx-auto space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
              <h4 className="text-xs sm:text-sm font-bold text-slate-200">
                Akses Kamera Langsung Terkendala
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {error}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => nativeFileInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition shadow-md"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Buka Kamera Bawaan HP</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Camera Stream Viewfinder */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover max-h-[500px]"
              />

              {/* Overlay Frame Dokumen Surat */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="w-full max-w-[340px] aspect-[1/1.38] border-2 border-dashed border-white/50 rounded-2xl relative shadow-2xl">
                  {/* Sudut-sudut bidik */}
                  <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

                  {/* Teks bantuan di dalam frame */}
                  <div className="absolute inset-x-0 bottom-3 text-center">
                    <span className="bg-slate-950/75 text-slate-200 text-[10px] font-medium px-2.5 py-1 rounded-full backdrop-blur-xs border border-white/10">
                      Posisikan dokumen surat di dalam kotak
                    </span>
                  </div>
                </div>
              </div>

              {/* Tombol Ganti Kamera (Depan/Belakang) */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Ganti Kamera Depan / Belakang"
                  className="absolute top-4 right-4 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 transition backdrop-blur-xs shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {isStartingCamera && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="text-center text-xs text-slate-300">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-400 mb-2" />
                    <span>Menghubungkan ke kamera...</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Kontrol Shutter / Aksi Bawah */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          {capturedDataUrl ? (
            /* Aksi setelah foto diambil */
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Foto Ulang</span>
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md"
              >
                <Check className="w-4 h-4" />
                <span>Gunakan Foto Ini</span>
              </button>
            </div>
          ) : (
            /* Aksi Shutter saat kamera aktif */
            <div className="flex items-center justify-between gap-3">
              {/* Opsi Kamera Bawaan HP (Native Intent) */}
              <button
                type="button"
                onClick={() => nativeFileInputRef.current?.click()}
                title="Buka aplikasi kamera bawaan HP untuk resolusi maksimal"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-[11px] font-medium transition border border-slate-800"
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Kamera Bawaan HP</span>
                <span className="sm:hidden">Kamera Asli</span>
              </button>

              {/* Shutter Button Utama */}
              <button
                type="button"
                onClick={handleSnapPhoto}
                disabled={isStartingCamera || !!error}
                title="Ambil Foto Surat"
                className="w-14 h-14 rounded-full bg-white text-slate-900 hover:bg-slate-100 active:scale-95 transition flex items-center justify-center shadow-lg disabled:opacity-40"
              >
                <div className="w-11 h-11 rounded-full border-2 border-slate-900 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-red-600 active:bg-red-700 transition" />
                </div>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 text-[11px] font-medium transition"
              >
                Batal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
