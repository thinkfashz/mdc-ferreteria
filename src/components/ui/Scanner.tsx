"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Camera, CameraOff, RefreshCw, AlertCircle, Scan, Keyboard,
  Sparkles, Loader2, ImageIcon, X, Upload, Check,
} from "lucide-react";

interface ScannerProps {
  onScan: (decodedText: string, format: string) => void;
  /** Se dispara cuando la IA identifica un producto desde foto */
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

/* Formatos que soporta una ferretería: QR + códigos de barras comerciales */
const PREFERRED_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "itf",
  "codabar",
  "data_matrix",
  "pdf417",
  "aztec",
];

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

  /* estado foto IA */
  const [aiPreview, setAiPreview] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDetails, setAiDetails] = useState<AiDetails | null>(null);
  const [aiError, setAiError] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const lastCodeRef = useRef("");
  const lastTimeRef = useRef(0);
  const cooldownRef = useRef(false);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const html5ScannerRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const videoShotRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    navigator.mediaDevices?.enumerateDevices?.()
      .then(devices => {
        const vids = devices.filter(d => d.kind === "videoinput");
        setCameras(vids.map(d => ({ id: d.deviceId, label: d.label || `Cam ${d.deviceId.slice(0, 6)}` })));
        if (vids.length > 0) {
          const back = vids.find(d => /back|rear|environment|world/i.test(d.label));
          setSelectedCamera(back?.deviceId || vids[vids.length - 1].deviceId);
        }
      })
      .catch(() => setError("No se pudieron listar cámaras"));

    return () => { stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const stopAll = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    detectorRef.current = null;
    if (html5ScannerRef.current) {
      try { await html5ScannerRef.current.stop(); } catch {}
      try { html5ScannerRef.current.clear(); } catch {}
      html5ScannerRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    if (videoShotRef.current) {
      videoShotRef.current.srcObject = null;
      videoShotRef.current = null;
    }
    setIsRunning(false);
  }, []);

  /* Emite un código con dedupe: mismo código no se emite 2 veces en <2.5s */
  const emitCode = useCallback((code: string, fmt: string) => {
    const now = Date.now();
    if (cooldownRef.current) return;
    if (code === lastCodeRef.current && now - lastTimeRef.current < 2500) return;
    lastCodeRef.current = code;
    lastTimeRef.current = now;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 1200);
    setLastResult(code);
    setLastFormat(fmt);
    setScanCount(c => c + 1);
    if ("vibrate" in navigator) navigator.vibrate([120, 60, 120]);
    onScan(code, fmt);
  }, [onScan]);

  /* ---------- foto → Ollama ---------- */
  const handleFile = useCallback((file: File | undefined | null) => {
    if (!file) return;
    if (!/image\/(jpeg|png|webp|heic|heif)/i.test(file.type)) {
      setAiError("Formato no soportado. Usa JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 6_000_000) {
      setAiError("Imagen muy grande (máx 6MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      downscaleAndIdentify(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  /* downscale para que Ollama lo procese rápido */
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
        identifySmall(small);
      } else {
        setAiPreview(dataUrl);
        identifySmall(dataUrl);
      }
    };
    img.onerror = () => setAiError("No se pudo leer la imagen");
    img.src = dataUrl;
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

  /* captura desde cámara abierta → IA */
  const captureFromVideo = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const max = 768;
    const scale = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setAiPreview(dataUrl);
    await identifySmall(dataUrl);
  }, []);

  const startNativeScan = async (cameraId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: cameraId ? { exact: cameraId } : undefined,
        facingMode: "environment",
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });

    streamRef.current = stream;

    const container = document.getElementById("native-scanner-container");
    if (!container) throw new Error("Container not found");
    container.innerHTML = "";

    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = "100%";
    video.style.maxHeight = "340px";
    video.style.borderRadius = "12px";
    video.style.objectFit = "cover";
    video.style.background = "#000";
    container.appendChild(video);
    videoRef.current = video;

    await video.play();

    if ("BarcodeDetector" in window) {
      let formats: string[] = [];
      try {
        const supported: string[] = await (window as any).BarcodeDetector.getSupportedFormats?.() || [];
        formats = PREFERRED_FORMATS.filter(f => supported.includes(f));
        if (formats.length === 0) formats = supported;
      } catch {
        formats = [];
      }
      detectorRef.current = new (window as any).BarcodeDetector(
        formats.length > 0 ? { formats } : undefined
      );
      setMethod(`Detector nativo · ${formats.length} formatos`);
      scanNative(video);
    } else {
      setMethod("html5-qrcode (compatibilidad)");
      await startHtml5Fallback(cameraId);
    }
  };

  const scanNative = async (video: HTMLVideoElement) => {
    if (!detectorRef.current || !video.videoWidth) {
      animFrameRef.current = requestAnimationFrame(() => scanNative(video));
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(video);
      if (barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        const fmt = barcodes[0].format || "QR";
        emitCode(code, fmt);
      }
    } catch {}

    animFrameRef.current = requestAnimationFrame(() => scanNative(video));
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
      { fps: 15, qrbox: { width: 280, height: 150 }, aspectRatio: 1.4 },
      (text: string, result: any) => {
        const fmt = result?.result?.format?.formatName || "QR";
        emitCode(text, fmt);
      },
      () => {}
    );

    setTimeout(() => {
      const v = scannerContainerRef.current?.querySelector("video");
      if (v) {
        v.style.width = "100%";
        v.style.maxHeight = "340px";
        v.style.borderRadius = "12px";
      }
    }, 500);
  };

  const startScanner = async (cameraId?: string) => {
    setError("");
    await stopAll();

    const camId = cameraId || selectedCamera;
    if (!camId && cameras.length === 0) {
      setError("No hay cámaras disponibles");
      return;
    }

    try {
      await startNativeScan(camId);
      setIsRunning(true);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (/NotAllowed|Permission/.test(msg)) {
        setError("Permiso de cámara denegado. Habilítalo en la configuración del navegador.");
      } else if (/NotFound|Devices/.test(msg)) {
        setError("No se encontró cámara.");
      } else if (/NotReadable|Track/.test(msg)) {
        setError("Cámara en uso por otra app.");
      } else {
        setError(`Error: ${msg.slice(0, 200)}`);
      }
      setIsRunning(false);
    }
  };

  const switchCamera = async (id: string) => {
    setSelectedCamera(id);
    if (isRunning) {
      await stopAll();
      setTimeout(() => startScanner(id), 300);
    }
  };

  return (
    <div className="space-y-3">
      {/* tabs */}
      <div className="flex gap-1 p-1 bg-card2 rounded-xl border border-card">
        <button
          onClick={() => setTab("codigo")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "codigo" ? "bg-accent-soft text-accent" : "text-muted hover:text-main"
          }`}
        >
          <Scan className="w-4 h-4" />
          Código / QR
        </button>
        <button
          onClick={() => setTab("foto")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "foto" ? "bg-accent-soft text-accent" : "text-muted hover:text-main"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Foto con IA
        </button>
      </div>

      {/* ---------- TAB CÓDIGO ---------- */}
      {tab === "codigo" && (
        <>
          <div
            id="native-scanner-container"
            className="w-full rounded-xl overflow-hidden bg-black border border-card"
            style={{ display: isRunning ? "block" : "none", minHeight: "200px", maxHeight: "340px" }}
          />

          <div
            ref={scannerContainerRef}
            id="html5-scanner-container"
            className="w-full rounded-xl overflow-hidden bg-black border border-card"
            style={{ display: "none", minHeight: "200px", maxHeight: "340px" }}
          />

          {isRunning && (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Cámara activa {method && <span className="text-dim">· {method}</span>}
              </div>
              {cameras.length > 1 && (
                <button
                  onClick={() => {
                    const idx = cameras.findIndex(c => c.id === selectedCamera);
                    switchCamera(cameras[(idx + 1) % cameras.length].id);
                  }}
                  className="p-2 bg-accent-soft rounded-lg hover:bg-[#F97316] hover:text-[#0d0d0d] text-accent transition-colors"
                  title="Cambiar cámara"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={stopAll}
                className="p-2 bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                title="Detener"
              >
                <CameraOff className="w-4 h-4" />
              </button>
            </div>
          )}

          {!isRunning && (
            <div className="space-y-3">
              {cameras.length > 1 && (
                <select
                  value={selectedCamera}
                  onChange={e => setSelectedCamera(e.target.value)}
                  className="input-theme w-full px-3 py-2 border border-soft rounded-lg text-sm text-main focus-mdc"
                >
                  {cameras.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
              <button
                onClick={() => startScanner()}
                className="w-full inline-flex items-center justify-center rounded-lg font-semibold px-4 py-3 bg-[#F97316] text-[#0d0d0d] hover:bg-[#fb8b3c] transition-all active:scale-[0.99]"
              >
                <Camera className="w-4 h-4 mr-2" />
                {cameras.length > 0 ? "Abrir Cámara para Escanear" : "Habilitar Cámara"}
              </button>
              <p className="text-xs text-dim flex items-center justify-center gap-1.5">
                <Scan className="w-3.5 h-3.5" />
                QR, EAN-13, UPC, Code128 y más · detección automática
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {lastResult && (
            <div className="bg-accent-soft border border-[rgba(249,115,22,0.35)] rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-accent font-medium flex items-center gap-1">
                  <Keyboard className="w-3 h-3" />
                  Último código detectado {lastFormat && `· ${lastFormat}`}
                </p>
                {scanCount > 1 && <span className="text-xs text-dim">{scanCount} escaneos</span>}
              </div>
              <p className="font-mono text-sm text-main break-all">{lastResult}</p>
            </div>
          )}
        </>
      )}

      {/* ---------- TAB FOTO IA ---------- */}
      {tab === "foto" && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {aiPreview ? (
            <div className="relative rounded-xl overflow-hidden border border-card bg-black">
              <img src={aiPreview} alt="Producto" className="w-full max-h-72 object-contain" />
              {aiLoading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-[#F97316] animate-spin" />
                  <p className="text-sm text-soft">Identificando producto con IA...</p>
                  <p className="text-xs text-dim">puede tardar hasta 90 segundos</p>
                </div>
              )}
              <button
                onClick={() => { setAiPreview(""); setAiDetails(null); setAiError(""); }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-lg text-white/80 hover:text-white"
                title="Quitar imagen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-soft rounded-xl py-10 flex flex-col items-center gap-2 hover:border-[#F97316] transition-colors group"
            >
              <div className="w-12 h-12 rounded-xl bg-accent-soft flex items-center justify-center group-hover:scale-105 transition-transform">
                <ImageIcon className="w-6 h-6 text-[#F97316]" />
              </div>
              <p className="text-sm font-medium text-soft">Toma o sube una foto del producto</p>
              <p className="text-xs text-dim">La IA (Ollama) lo identifica y genera los detalles</p>
            </button>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2.5 bg-accent-soft text-accent hover:bg-[#F97316] hover:text-[#0d0d0d] transition-all text-sm"
            >
              <Upload className="w-4 h-4" />
              Elegir foto
            </button>
            {isRunning && (
              <button
                onClick={captureFromVideo}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2.5 bg-[#F97316] text-[#0d0d0d] hover:bg-[#fb8b3c] transition-all text-sm"
              >
                <Camera className="w-4 h-4" />
                Capturar de cámara
              </button>
            )}
          </div>

          {!isRunning && (
            <button
              onClick={async () => { await startScanner(); }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg font-medium px-4 py-2 text-xs text-muted hover:text-accent transition-colors"
            >
              <Camera className="w-3.5 h-3.5" />
              Abrir cámara para capturar
            </button>
          )}

          {aiError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          {aiDetails && (
            <div className="bg-accent-soft border border-[rgba(249,115,22,0.35)] rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-accent font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Producto identificado · confianza {aiDetails.confidence}
                </p>
              </div>
              <p className="font-semibold text-main">{aiDetails.name}</p>
              <p className="text-xs text-muted">{aiDetails.brand} · {aiDetails.category}</p>
              {aiDetails.description && <p className="text-sm text-soft">{aiDetails.description}</p>}
              {aiDetails.specs.length > 0 && (
                <ul className="text-xs text-muted space-y-0.5">
                  {aiDetails.specs.map((s, i) => <li key={i}>• {s}</li>)}
                </ul>
              )}
              {aiDetails.estimatedPriceClp > 0 && (
                <p className="text-sm text-accent font-semibold">
                  Precio estimado: ${aiDetails.estimatedPriceClp.toLocaleString("es-CL")}
                </p>
              )}
              <p className="text-xs text-dim flex items-center gap-1 pt-1 border-t border-[rgba(249,115,22,0.2)]">
                <Check className="w-3 h-3 text-green-400" />
                Pasa a la cola para revisar y guardar
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}