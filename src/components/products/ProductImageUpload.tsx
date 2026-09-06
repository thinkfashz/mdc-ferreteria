"use client";

import { useRef, useState } from "react";
import { ImageIcon, UploadCloud, X } from "lucide-react";

interface ProductImageUploadProps {
  value: string;
  onChange: (url: string) => void;
}

export default function ProductImageUpload({ value, onChange }: ProductImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const uploadFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setUploading(true);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo subir la imagen");
      }

      onChange(String(data.url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-gray-700">Imagen del producto</label>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" /> Quitar
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative w-full min-h-44 overflow-hidden rounded-2xl border border-dashed border-gray-300 bg-gray-50 hover:border-[#F97316] hover:bg-orange-50/30 transition-all disabled:opacity-60"
      >
        {value ? (
          <img src={value} alt="Vista previa del producto" className="h-52 w-full object-contain p-4" />
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center gap-2 px-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              {uploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#F97316] border-t-transparent" />
              ) : (
                <ImageIcon className="h-5 w-5 text-[#F97316]" />
              )}
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {uploading ? "Subiendo imagen…" : "Subir imagen del producto"}
            </p>
            <p className="text-xs text-gray-500">JPG, PNG, WebP o AVIF · máximo 8 MB</p>
          </div>
        )}

        {value && !uploading && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-xl bg-black/75 px-3 py-2 text-xs font-semibold text-white backdrop-blur">
            <UploadCloud className="h-3.5 w-3.5" /> Cambiar
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(event) => uploadFile(event.target.files?.[0])}
      />

      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
