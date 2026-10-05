import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project } from '../types';
import { showToast } from './Toast';
import { 
  Scan, X, Camera, Keyboard, AlertTriangle, CheckCircle2, 
  Search, ArrowRight, Folder, RefreshCw, Zap
} from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  onSelectProject: (projectId: string) => void;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  projects,
  onSelectProject
}: QrScannerModalProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Stop camera media tracks
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Helper to resolve project ID from raw QR text or input string
  const resolveProject = (rawText: string): Project | null => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // Check if it's a URL
    if (trimmed.includes('projectId=')) {
      try {
        const url = trimmed.startsWith('http') 
          ? new URL(trimmed) 
          : new URL('http://local?' + trimmed.replace(/^.*\?/, ''));
        const pid = url.searchParams.get('projectId');
        if (pid) {
          const match = projects.find(
            p => p.id.toLowerCase() === pid.toLowerCase() || (p.client && p.client.toLowerCase() === pid.toLowerCase())
          );
          if (match) return match;
        }
      } catch {}
    }

    const clean = trimmed.toLowerCase();

    // 1. Direct ID match
    const byId = projects.find(p => p.id.toLowerCase() === clean);
    if (byId) return byId;

    // 2. Client / Work Order match
    const byClient = projects.find(p => (p.client || '').trim().toLowerCase() === clean);
    if (byClient) return byClient;

    // 3. GA Number match
    const byGa = projects.find(p => (p.gaNumber || '').trim().toLowerCase() === clean);
    if (byGa) return byGa;

    // 4. Exact Name match
    const byName = projects.find(p => p.name.trim().toLowerCase() === clean);
    if (byName) return byName;

    // 5. Partial Name or Client match
    const partial = projects.find(p => 
      p.name.toLowerCase().includes(clean) || 
      (p.client && p.client.toLowerCase().includes(clean))
    );
    if (partial) return partial;

    return null;
  };

  // Handler when a valid QR or input is successfully recognized
  const handleSuccess = (proj: Project) => {
    setScannedFeedback(proj.name);
    stopCamera();
    showToast(`Proyek ditemukan: ${proj.name} (WO: ${proj.client || 'N/A'})`, 'success');
    setTimeout(() => {
      onSelectProject(proj.id);
      onClose();
    }, 400);
  };

  // Start Camera and Barcode Detection
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setIsCameraStarting(true);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser ini tidak mendukung akses kamera langsung. Gunakan input manual di bawah.');
      setIsCameraStarting(false);
      setMode('manual');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraStarting(false);

      // Check if native BarcodeDetector API exists
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['qr_code']
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detectedVal = barcodes[0].rawValue;
                if (detectedVal) {
                  const resolved = resolveProject(detectedVal);
                  if (resolved) {
                    handleSuccess(resolved);
                  } else {
                    showToast(`QR terdeteksi namun ID tidak cocok dengan proyek: ${detectedVal}`, 'warning');
                  }
                }
              }
            } catch {}
          }, 300);
        } catch {
          // BarcodeDetector failed to initialize, user can still use manual entry
        }
      }
    } catch (err: any) {
      setIsCameraStarting(false);
      const isPermissionDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      const msg = isPermissionDenied
        ? 'Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda, atau gunakan input manual.'
        : 'Tidak dapat mengaktifkan kamera (mungkin dibatasi oleh iframe sandbox). Gunakan input manual di bawah.';
      setCameraError(msg);
    }
  };

  useEffect(() => {
    if (isOpen && mode === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  // Live matching suggestions for manual search
  const filteredSuggestions = useMemo(() => {
    const q = manualInput.trim().toLowerCase();
    if (!q) {
      return projects.filter(p => !p.isArchived).slice(0, 5);
    }
    return projects
      .filter(p => 
        !p.isArchived && (
          p.name.toLowerCase().includes(q) ||
          (p.client && p.client.toLowerCase().includes(q)) ||
          (p.gaNumber && p.gaNumber.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
        )
      )
      .slice(0, 6);
  }, [projects, manualInput]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;

    const matched = resolveProject(manualInput);
    if (matched) {
      handleSuccess(matched);
    } else {
      showToast(`Proyek dengan WO atau ID "${manualInput}" tidak ditemukan`, 'warning');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-base-bg border-2 border-base-border w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border bg-base-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-base-accent-dim border border-base-accent/30 text-base-accent flex items-center justify-center shadow-xs">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-condensed font-black text-lg text-base-text uppercase tracking-wide">
                Scan QR Proyek
              </h3>
              <p className="text-xs text-base-muted">
                Buka panel aksi interaktif di Shop Floor
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex border-b border-base-border bg-base-surface text-xs font-condensed font-bold uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              mode === 'camera'
                ? 'border-base-accent text-base-accent bg-base-accent-dim/20'
                : 'border-transparent text-base-muted hover:text-base-text'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kamera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              mode === 'manual'
                ? 'border-base-accent text-base-accent bg-base-accent-dim/20'
                : 'border-transparent text-base-muted hover:text-base-text'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Input WO / ID Manual</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {mode === 'camera' && (
            <div className="space-y-4">
              {/* Camera Stream Viewport */}
              <div className="relative aspect-4/3 sm:aspect-video bg-black rounded-xl overflow-hidden border-2 border-base-border flex items-center justify-center shadow-inner">
                {cameraError ? (
                  <div className="p-6 text-center space-y-3 max-w-sm text-base-muted">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-base-muted leading-relaxed">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setMode('manual')}
                      className="px-4 py-2 bg-base-accent text-white font-condensed font-bold uppercase tracking-wider text-xs rounded-xl shadow-md hover:bg-base-accent/90 transition cursor-pointer"
                    >
                      Beralih ke Input Manual
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Viewfinder Target Graphic */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-48 sm:w-56 sm:h-56 border-2 border-base-accent/70 rounded-2xl relative shadow-lg">
                        {/* Corner Accents */}
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-base-accent rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-base-accent rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-base-accent rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-base-accent rounded-br-lg" />

                        {/* Animated Scanning Beam */}
                        <div className="absolute inset-x-2 h-0.5 bg-base-accent animate-pulse shadow-sm shadow-base-accent top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {isCameraStarting && (
                      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 text-white text-xs font-condensed uppercase tracking-wider">
                        <RefreshCw className="w-6 h-6 animate-spin text-base-accent" />
                        <span>Menghubungkan Kamera...</span>
                      </div>
                    )}
                  </>
                )}

                {scannedFeedback && (
                  <div className="absolute inset-0 bg-emerald-950/90 text-emerald-400 flex flex-col items-center justify-center p-4 text-center animate-in fade-in">
                    <CheckCircle2 className="w-12 h-12 mb-2" />
                    <span className="font-condensed font-black text-lg uppercase tracking-wide">
                      QR Berhasil Terdeteksi!
                    </span>
                    <span className="text-sm font-medium">{scannedFeedback}</span>
                  </div>
                )}
              </div>

              {/* Instructions and Quick Fallback Toggle */}
              <div className="flex items-center justify-between text-xs text-base-muted">
                <span>Arahkan kamera ke QR code pada drawing / unit fabrikasi</span>
                <button
                  type="button"
                  onClick={startCamera}
                  className="flex items-center gap-1 text-base-accent font-bold hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restart Kamera</span>
                </button>
              </div>

              {/* Quick Input Box under Camera */}
              <div className="pt-2 border-t border-base-border space-y-2">
                <span className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted">
                  Atau masukkan WO / ID secara langsung:
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ketik WO (mis. WO-001) atau ID..."
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleManualSubmit(e);
                    }}
                    className="flex-1 bg-base-surface border border-base-border rounded-xl px-3 py-2 text-sm text-base-text focus:outline-hidden focus:border-base-accent"
                  />
                  <button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={!manualInput.trim()}
                    className="px-4 py-2 bg-base-accent disabled:opacity-50 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>Buka</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === 'manual' && (
            <div className="space-y-4">
              {/* Form Input Manual */}
              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="block text-xs font-condensed font-bold uppercase tracking-wider text-base-text">
                  Masukkan No WO / Project ID / Paste Link QR
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-base-muted" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Contoh: WO-001, PRJ-102, atau paste URL QR..."
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      className="w-full bg-base-surface border border-base-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-base-text placeholder-base-muted/50 focus:outline-hidden focus:border-base-accent font-mono font-medium"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="px-5 py-2.5 bg-base-accent hover:bg-base-accent/90 disabled:opacity-50 text-white font-condensed font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm shrink-0"
                  >
                    <span>Buka</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>

              {/* Suggestions / Quick Pick */}
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-condensed font-bold uppercase tracking-wider text-base-muted flex items-center justify-between">
                  <span>Pilih Langsung dari Proyek Aktif:</span>
                  <span className="font-mono text-[10px]">{filteredSuggestions.length} proyek</span>
                </div>

                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {filteredSuggestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-base-muted italic bg-base-surface border border-base-border rounded-xl">
                      Tidak ada proyek yang cocok dengan kata kunci "{manualInput}".
                    </div>
                  ) : (
                    filteredSuggestions.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSuccess(p)}
                        className="p-3 bg-base-surface hover:bg-base-surface2 border border-base-border hover:border-base-accent rounded-xl transition cursor-pointer flex items-center justify-between gap-3 group"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-base-accent bg-base-accent-dim px-1.5 py-0.5 rounded">
                              {p.client ? `WO: ${p.client}` : p.id}
                            </span>
                            <span className="font-condensed font-bold text-xs uppercase text-base-text truncate">
                              {p.name}
                            </span>
                          </div>
                          <div className="text-[11px] text-base-muted truncate mt-0.5">
                            {p.customer ? `Cust: ${p.customer}` : 'Fabrikasi'} • Status: {p.status}
                          </div>
                        </div>

                        <div className="w-8 h-8 rounded-lg bg-base-surface3 group-hover:bg-base-accent group-hover:text-white text-base-muted flex items-center justify-center shrink-0 transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
