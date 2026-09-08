"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera, CameraOff, RefreshCw, AlertCircle, Scan, Keyboard,
  Sparkles, Loader2, ImageIcon, X, Upload, Check, Flashlight,
} from "lucide-react";

interface ScannerProps {
  onScan: (decodedText: string, format: string) => void;
  onAiIdentify?: (details: AiDetails, imageDataUrl: string) => void;
  enabled?: boolean;
}

export interface AiDetails {
  name: string;
  brand: string;
  category: string;
  description: string;
  specs: string[];
  estimatedPriceClp: number;
  confidence: string;
}

const PREFERRED_FORMATS = [
  "qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128",
  "code_39", "code_93", "itf", "codabar", "data_matrix", "pdf417", "aztec",
];

const NATIVE_SCAN_INTERVAL_MS = 95;
const SAME_CODE_DEDUPE_MS = 900;
type Tab = "codigo" | "foto";

export default function Scanner({ onScan, onAiIdentify, enabled = true }: ScannerProps) {
  const [tab, setTab] = useState<Tab>("codigo");
  const [isRunning, setIsRunning] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCamera, setSelectedCamera] = useState("");
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState("");
  const [lastFormat, setLastFormat] = useState("");
  const [method, setMethod] = useState("");
  const [scanCount, setScanCount] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [aiPreview, setAiPreview] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDetails, setAiDetails] = useState<AiDetails | null>(null);
  const [aiError, setAiError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const html5ScannerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const detectingRef = useRef(false);
  const lastDetectAtRef = useRef(0);

  const stopAll = useCallback(async () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    detectorRef.current = null;
    detectingRef.current = false;
    lastDetectAtRef.current = 0;

    if (html5ScannerRef.current) {
      try { await html5ScannerRef.current.stop(); } catch {}
      try { html5ScannerRef.current.clear(); } catch {}
      html5ScannerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setTorchAvailable(false);
    setTorchOn(false);
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    navigator.mediaDevices?.enumerateDevices?.()
      .then((devices) => {
        const vids = devices.filter((d) => d.kind === "videoinput");
        setCameras(vids.map((d) => ({ id: d.deviceId, label: d.label || `Cámara ${d.deviceId.slice(0, 6)}` })));
        if (vids.length > 0) {
          const back = vids.find((d) => /back|rear|environment|world|trasera/i.test(d.label));
          setSelectedCamera(back?.deviceId || vids[vids.length - 1].deviceId);
        }
      })
      .catch(() => setError("No se pudieron listar las cámaras"));
    return () => { void stopAll(); };
  }, [enabled, stopAll]);

  const emitCode = useCallback((rawCode: string, fmt: string) => {
    const code = String(rawCode || "").trim();
    if (!code) return;
    const now = Date.now();
    const last = lastSeenRef.current.get(code) || 0;
    if (now - last < SAME_CODE_DEDUPE_MS) return;
    lastSeenRef.current.set(code, now);

    if (lastSeenRef.current.size > 80) {
      for (const [key, seenAt] of lastSeenRef.current) {
        if (now - seenAt > 15000) lastSeenRef.current.delete(key);
      }
    }

    setLastResult(code);
    setLastFormat(fmt);
    setScanCount((count) => count + 1);
    try { navigator.vibrate?.(55); } catch {}
    onScan(code, fmt);
  }, [onScan]);

  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!/image\/(jpeg|png|webp|heic|heif)/i.test(file.type)) {
      setAiError("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 6_000_000) {
      setAiError("Imagen muy grande (máx. 6 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => downscaleAndIdentify(String(reader.result));
    reader.readAsDataURL(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const identifySmall = useCallback(async (dataUrl: string) => {
    setAiError("");
    setAiDetails(null);
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setAiError(data.error || "No se pudo identificar el producto");
        return;
      }
      setAiDetails(data.details);
      onAiIdentify?.(data.details, dataUrl);
    } catch (err: any) {
      setAiError(err?.message?.slice(0, 200) || "Error de conexión con la IA");
    } finally {
      setAiLoading(false);
    }
  }, [onAiIdentify]);

  const downscaleAndIdentify = useCallback((dataUrl: string) => {
    const img = new Image();
    img.onload = () => {
      const max = 768;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      if (scale < 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const small = canvas.toDataURL("image/jpeg", 0.82);
        setAiPreview(small);
        void identifySmall(small);
      } else {
        setAiPreview(dataUrl);
        void identifySmall(dataUrl);
      }
    };
    img.onerror = () => setAiError("No se pudo leer la imagen");
    img.src = dataUrl;
  }, [identifySmall]);

  const captureFromVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const max = 768;
    const scale = Math.min(1, max / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setAiPreview(dataUrl);
    await identifySmall(dataUrl);
  }, [identifySmall]);

  const scheduleNativeScan = useCallback((video: HTMLVideoElement) => {
    animFrameRef.current = requestAnimationFrame(() => { void scanNative(video); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanNative = async (video: HTMLVideoElement) => {
    if (!detectorRef.current || !video.isConnected || !video.videoWidth) {
      if (streamRef.current) scheduleNativeScan(video);
      return;
    }

    const now = performance.now();
    if (detectingRef.current || now - lastDetectAtRef.current < NATIVE_SCAN_INTERVAL_MS) {
      scheduleNativeScan(video);
      return;
    }

    detectingRef.current = true;
    lastDetectAtRef.current = now;
    try {
      const barcodes = await detectorRef.current.detect(video);
      for (const barcode of barcodes.slice(0, 3)) {
        emitCode(barcode.rawValue, barcode.format || "barcode");
      }
    } catch {
      /* Un frame borroso no debe detener el scanner. */
    } finally {
      detectingRef.current = false;
      if (streamRef.current) scheduleNativeScan(video);
    }
  };

  const startHtml5Fallback = async (cameraId: string) => {
    if (!scannerContainerRef.current) return;
    scannerContainerRef.current.innerHTML = "";
    const nativeContainer = document.getElementById("native-scanner-container");
    if (nativeContainer) nativeContainer.style.display = "none";
    scannerContainerRef.current.style.display = "block";

    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode(scannerContainerRef.current.id);
    html5ScannerRef.current = scanner;
    await scanner.start(
      cameraId || { facingMode: "environment" },
      { fps: 10, qrbox: { width: 300, height: 160 }, aspectRatio: 1.55 },
      (text: string, result: any) => emitCode(text, result?.result?.format?.formatName || "barcode"),
      () => {},
    );
    setMethod("Compatibilidad html5-qrcode · 10 fps");
  };

  const startNativeScan = async (cameraId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraId ? { exact: cameraId } : undefined,
        facingMode: { ideal: "environment" },
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
      },
      audio: false,
    });
    streamRef.current = stream;

    const track = stream.getVideoTracks()[0];
    try {
      const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
      setTorchAvailable(Boolean(capabilities?.torch));
      const focusModes = capabilities?.focusMode || [];
      if (focusModes.includes("continuous")) {
        await track.applyConstraints({ advanced: [{ focusMode: "continuous" } as any] });
      }
    } catch {}

    const container = document.getElementById("native-scanner-container");
    if (!container) throw new Error("No se encontró el visor del scanner");
    container.innerHTML = "";

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.className = "w-full h-full object-cover";
    container.appendChild(video);
    videoRef.current = video;
    await video.play();

    if ("BarcodeDetector" in window) {
      let formats: string[] = [];
      try {
        const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats?.() || [];
        formats = PREFERRED_FORMATS.filter((format) => supported.includes(format));
        if (formats.length === 0) formats = supported;
      } catch {}
      detectorRef.current = new (window as any).BarcodeDetector(formats.length ? { formats } : undefined);
      setMethod(`Detector nativo · ${formats.length || "multi"} formatos · ~10 fps`);
      scheduleNativeScan(video);
    } else {
      stream.getTracks().forEach((item) => item.stop());
      streamRef.current = null;
      await startHtml5Fallback(cameraId);
    }
  };

  const startScanner = async (cameraId?: string) => {
    setError("");
    await stopAll();
    const camId = cameraId || selectedCamera;
    try {
      await startNativeScan(camId);
      setIsRunning(true);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/NotAllowed|Permission/i.test(msg)) setError("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
      else if (/NotFound|Devices/i.test(msg)) setError("No se encontró una cámara disponible.");
      else if (/NotReadable|Track/i.test(msg)) setError("La cámara está siendo usada por otra aplicación.");
      else setError(`No se pudo abrir la cámara: ${msg.slice(0, 180)}`);
      setIsRunning(false);
    }
  };

  const switchCamera = async (id: string) => {
    setSelectedCamera(id);
    if (!isRunning) return;
    await stopAll();
    window.setTimeout(() => { void startScanner(id); }, 180);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track || !torchAvailable) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 p-1 bg-card2 rounded-xl border border-card">
        <button type="button" onClick={() => setTab("codigo")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "codigo" ? "bg-accent-soft text-accent" : "text-muted hover:text-main"}`}>
          <Scan className="w-4 h-4" /> Código / QR
        </button>
        <button type="button" onClick={() => setTab("foto")} className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === "foto" ? "bg-accent-soft text-accent" : "text-muted hover:text-main"}`}>
          <Sparkles className="w-4 h-4" /> Foto con IA
        </button>
      </div>

      {tab === "codigo" && (
        <>
          <div className="relative">
            <div id="native-scanner-container" className="w-full rounded-2xl overflow-hidden bg-black border border-card" style={{ display: isRunning ? "block" : "none", height: "min(56vw, 340px)", minHeight: "230px" }} />
            <div ref={scannerContainerRef} id="html5-scanner-container" className="w-full rounded-2xl overflow-hidden bg-black border border-card" style={{ display: "none", minHeight: "230px", maxHeight: "340px" }} />
            {isRunning && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
                <div className="absolute inset-x-[10%] top-1/2 -translate-y-1/2 h-[43%] border border-[#F97316]/70 rounded-2xl shadow-[0_0_0_999px_rgba(0,0,0,0.18)]">
                  <span className="absolute left-[-1px] top-[-1px] w-9 h-9 border-l-4 border-t-4 border-[#F97316] rounded-tl-xl" />
                  <span className="absolute right-[-1px] top-[-1px] w-9 h-9 border-r-4 border-t-4 border-[#F97316] rounded-tr-xl" />
                  <span className="absolute left-[-1px] bottom-[-1px] w-9 h-9 border-l-4 border-b-4 border-[#F97316] rounded-bl-xl" />
                  <span className="absolute right-[-1px] bottom-[-1px] w-9 h-9 border-r-4 border-b-4 border-[#F97316] rounded-br-xl" />
                  <div className="absolute left-3 right-3 top-1/2 h-px bg-[#F97316] shadow-[0_0_12px_#F97316] animate-pulse" />
                </div>
                <p className="absolute bottom-3 inset-x-3 text-center text-[11px] font-semibold text-white/90 drop-shadow">Centra el código dentro del marco naranja</p>
              </div>
            )}
          </div>

          {isRunning ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-2.5 rounded-xl flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
                <span className="truncate">Cámara activa {method && `· ${method}`}</span>
              </div>
              {torchAvailable && (
                <button type="button" onClick={toggleTorch} className={`p-2.5 rounded-xl transition-colors ${torchOn ? "bg-[#F97316] text-black" : "bg-accent-soft text-accent"}`} title="Linterna">
                  <Flashlight className="w-5 h-5" />
                </button>
              )}
              {cameras.length > 1 && (
                <button type="button" onClick={() => { const idx = cameras.findIndex((c) => c.id === selectedCamera); void switchCamera(cameras[(idx + 1) % cameras.length].id); }} className="p-2.5 bg-accent-soft rounded-xl text-accent" title="Cambiar cámara">
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
              <button type="button" onClick={() => void stopAll()} className="p-2.5 bg-red-500/10 rounded-xl text-red-400" title="Detener cámara">
                <CameraOff className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cameras.length > 1 && (
                <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)} className="input-theme w-full px-3 py-3 border border-soft rounded-xl text-sm text-main focus-mdc">
                  {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.label}</option>)}
                </select>
              )}
              <button type="button" onClick={() => void startScanner()} className="w-full inline-flex items-center justify-center rounded-xl font-semibold px-4 py-3.5 bg-[#F97316] text-[#0d0d0d] hover:bg-[#fb8b3c] transition-all active:scale-[0.99]">
                <Camera className="w-5 h-5 mr-2" /> Abrir cámara para escanear
              </button>
              <p className="text-xs text-dim text-center">EAN-13, EAN-8, UPC, Code128, QR, Data Matrix y más</p>
            </div>
          )}

          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{error}</span></div>}

          {lastResult && (
            <div className="bg-accent-soft border border-[rgba(249,115,22,0.35)] rounded-xl p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-accent font-medium flex items-center gap-1"><Keyboard className="w-3 h-3" /> Último código {lastFormat && `· ${lastFormat}`}</p>
                <span className="text-xs text-dim">{scanCount} lectura{scanCount === 1 ? "" : "s"}</span>
              </div>
              <p className="font-mono text-base text-main break-all">{lastResult}</p>
            </div>
          )}
        </>
      )}

      {tab === "foto" && (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          {aiPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-card bg-black">
              <img src={aiPreview} alt="Producto" className="w-full max-h-72 object-contain" />
              {aiLoading && <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2"><Loader2 className="w-8 h-8 text-[#F97316] animate-spin" /><p className="text-sm text-soft">Identificando producto con IA...</p></div>}
              <button type="button" onClick={() => { setAiPreview(""); setAiDetails(null); setAiError(""); }} className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white/80"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-soft rounded-xl py-10 flex flex-col items-center gap-2 hover:border-[#F97316] transition-colors group">
              <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center"><ImageIcon className="w-6 h-6 text-[#F97316]" /></div>
              <p className="text-sm font-medium text-soft">Toma o sube una foto del producto</p>
              <p className="text-xs text-dim">La IA genera una ficha editable antes de guardar</p>
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2.5 bg-accent-soft text-accent text-sm"><Upload className="w-4 h-4" /> Elegir foto</button>
            {isRunning && <button type="button" onClick={() => void captureFromVideo()} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2.5 bg-[#F97316] text-[#0d0d0d] text-sm"><Camera className="w-4 h-4" /> Capturar</button>}
          </div>
          {!isRunning && <button type="button" onClick={() => void startScanner()} className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2 text-xs text-muted hover:text-accent"><Camera className="w-3.5 h-3.5" /> Abrir cámara para capturar</button>}
          {aiError && <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><span>{aiError}</span></div>}
          {aiDetails && (
            <div className="bg-accent-soft border border-[rgba(249,115,22,0.35)] rounded-xl p-4 space-y-2">
              <p className="text-xs text-accent font-semibold flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Producto identificado · confianza {aiDetails.confidence}</p>
              <p className="font-semibold text-main">{aiDetails.name}</p>
              <p className="text-xs text-muted">{aiDetails.brand} · {aiDetails.category}</p>
              {aiDetails.description && <p className="text-sm text-soft">{aiDetails.description}</p>}
              {aiDetails.specs.length > 0 && <ul className="text-xs text-muted space-y-0.5">{aiDetails.specs.map((spec, index) => <li key={index}>• {spec}</li>)}</ul>}
              {aiDetails.estimatedPriceClp > 0 && <p className="text-sm text-accent font-semibold">Precio estimado: ${aiDetails.estimatedPriceClp.toLocaleString("es-CL")}</p>}
              <p className="text-xs text-dim flex items-center gap-1 pt-1 border-t border-[rgba(249,115,22,0.2)]"><Check className="w-3 h-3 text-green-400" /> Pasa a la cola para revisar y guardar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
