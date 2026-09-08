"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Package, Check, Search, ArrowDown, ArrowUp, History, Scan, X,
  Loader2, Save, Trash2, Plus, ShoppingCart, ImagePlus, AlertCircle,
  Database, Globe2, RefreshCw,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Scanner from "@/components/ui/Scanner";
import { formatDate } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/brand";
import type { Product, StockMovement, Category } from "@/types";

interface BarcodeLookup {
  found: boolean;
  source: string;
  code: string;
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  category: string;
  categoryId?: string | null;
  local: boolean;
  productId?: string | null;
  stock?: number | null;
  price?: number | null;
}

interface QueuedItem {
  id: string;
  code: string;
  labelCode: string;
  format: string;
  lookup: BarcodeLookup | null;
  loading: boolean;
  saving: boolean;
  uploadingImage: boolean;
  saved: boolean;
  error: string;
  quantity: number;
  type: "in" | "out";
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  price: string;
  categoryId: string;
  unit: string;
  savedStock?: number | null;
}

const emptyLookup = (code: string): BarcodeLookup => ({
  found: false,
  source: "none",
  code,
  name: "",
  brand: "",
  description: "",
  imageUrl: "",
  category: "",
  categoryId: null,
  local: false,
  productId: null,
  stock: null,
  price: null,
});

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [recentMoves, setRecentMoves] = useState<StockMovement[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const queueRef = useRef<QueuedItem[]>([]);

  const updateQueue = useCallback((updater: (items: QueuedItem[]) => QueuedItem[]) => {
    setQueue((current) => {
      const next = updater(current);
      queueRef.current = next;
      return next;
    });
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products?pageSize=100", { cache: "no-store" });
      const data = await res.json();
      setProducts(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setProducts([]);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories", { cache: "no-store" });
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/stock", { cache: "no-store" });
      const data = await res.json();
      setRecentMoves(Array.isArray(data) ? data.slice(0, 20) : []);
    } catch {
      setRecentMoves([]);
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchProducts(), fetchCategories(), fetchHistory()]);
  }, [fetchProducts, fetchCategories, fetchHistory]);

  const guessCategoryId = useCallback((remoteCategory?: string) => {
    const text = normalize(String(remoteCategory || ""));
    if (!text) return "";
    const match = categories.find((category) => {
      const name = normalize(category.name);
      const slug = normalize(category.slug);
      return text.includes(name) || text.includes(slug) || name.includes(text);
    });
    return match?.id || "";
  }, [categories]);

  const lookupBarcode = async (code: string): Promise<BarcodeLookup> => {
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return { ...emptyLookup(code), ...data };
    } catch (error) {
      return { ...emptyLookup(code), source: "error", description: error instanceof Error ? error.message : "Error de búsqueda" };
    }
  };

  const addToQueue = useCallback(async (rawCode: string, format = "barcode") => {
    const code = String(rawCode || "").trim();
    if (!code) return;

    const existing = queueRef.current.find((item) => item.code === code && !item.saved);
    if (existing) {
      updateQueue((items) => items.map((item) => item.id === existing.id
        ? { ...item, quantity: Math.min(9999, item.quantity + 1), error: "" }
        : item));
      return;
    }

    const local = products.find((product) => product.barcode === code || product.sku === code) || null;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: QueuedItem = {
      id,
      code,
      labelCode: code,
      format,
      lookup: null,
      loading: true,
      saving: false,
      uploadingImage: false,
      saved: false,
      error: "",
      quantity: 1,
      type: "in",
      name: local?.name || "",
      brand: local?.brand || "",
      description: local?.description || "",
      imageUrl: local?.imageUrl || "",
      price: local ? String(local.price ?? 0) : "",
      categoryId: local?.categoryId || "",
      unit: local?.unit || "pieza",
    };

    updateQueue((items) => [item, ...items]);
    const lookup = await lookupBarcode(code);

    updateQueue((items) => items.map((current) => {
      if (current.id !== id) return current;
      const categoryId = current.categoryId || lookup.categoryId || guessCategoryId(lookup.category);
      return {
        ...current,
        lookup,
        loading: false,
        name: current.name || lookup.name || `Producto ${code}`,
        brand: current.brand || lookup.brand || "",
        description: current.description || lookup.description || "",
        imageUrl: current.imageUrl || lookup.imageUrl || "",
        price: current.price || (lookup.price != null ? String(lookup.price) : ""),
        categoryId,
        error: lookup.source === "error" ? "No se pudo consultar las bases externas. Puedes completar la ficha manualmente." : "",
      };
    }));
  }, [products, guessCategoryId, updateQueue]);

  const handleScan = useCallback((decodedText: string, format: string) => {
    void addToQueue(decodedText, format);
  }, [addToQueue]);

  const handleAiIdentify = useCallback((details: any, imageDataUrl: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const labelCode = `IA-${Date.now().toString(36).toUpperCase()}`;
    const item: QueuedItem = {
      id,
      code: "",
      labelCode,
      format: "foto-ia",
      lookup: {
        ...emptyLookup(""),
        found: true,
        source: `IA (${details.confidence || "sin dato"})`,
        name: details.name || "",
        brand: details.brand || "",
        description: details.description || "",
        imageUrl: imageDataUrl,
        category: details.category || "",
      },
      loading: false,
      saving: false,
      uploadingImage: false,
      saved: false,
      error: "",
      quantity: 1,
      type: "in",
      name: details.name || "Producto identificado por IA",
      brand: details.brand || "",
      description: details.description || "",
      imageUrl: imageDataUrl,
      price: details.estimatedPriceClp > 0 ? String(details.estimatedPriceClp) : "",
      categoryId: guessCategoryId(details.category),
      unit: "pieza",
    };
    updateQueue((items) => [item, ...items]);
  }, [guessCategoryId, updateQueue]);

  const handleManualAdd = () => {
    const code = manualCode.trim();
    if (!code) return;
    void addToQueue(code, "manual");
    setManualCode("");
  };

  const updateQueueItem = (id: string, updates: Partial<QueuedItem>) => {
    updateQueue((items) => items.map((item) => item.id === id ? { ...item, ...updates } : item));
  };

  const removeQueueItem = (id: string) => {
    updateQueue((items) => items.filter((item) => item.id !== id));
  };

  const uploadFile = async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.url) throw new Error(data?.error || "No se pudo subir la imagen");
    return String(data.url);
  };

  const uploadQueueImage = async (id: string, file?: File | null) => {
    if (!file) return;
    updateQueueItem(id, { uploadingImage: true, error: "" });
    try {
      const url = await uploadFile(file);
      updateQueueItem(id, { imageUrl: url, uploadingImage: false });
    } catch (error) {
      updateQueueItem(id, { uploadingImage: false, error: error instanceof Error ? error.message : "No se pudo subir la imagen" });
    }
  };

  const ensureHostedImage = async (item: QueuedItem) => {
    if (!item.imageUrl.startsWith("data:image/")) return item.imageUrl;
    const response = await fetch(item.imageUrl);
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const file = new File([blob], `scanner-${Date.now()}.${extension}`, { type });
    return uploadFile(file);
  };

  const saveSingleItem = async (item: QueuedItem, refresh = true) => {
    const latest = queueRef.current.find((queued) => queued.id === item.id) || item;
    if (latest.saved) return true;
    if (!latest.name.trim()) {
      updateQueueItem(latest.id, { error: "Escribe el nombre del producto antes de guardar." });
      return false;
    }
    if (!Number.isFinite(latest.quantity) || latest.quantity <= 0) {
      updateQueueItem(latest.id, { error: "La cantidad debe ser mayor que cero." });
      return false;
    }

    updateQueueItem(latest.id, { saving: true, error: "" });
    try {
      const hostedImage = await ensureHostedImage(latest);
      const payload: Record<string, unknown> = {
        code: latest.code,
        name: latest.name.trim(),
        brand: latest.brand.trim(),
        description: latest.description.trim(),
        imageUrl: hostedImage,
        categoryId: latest.categoryId,
        quantity: latest.quantity,
        type: latest.type,
        unit: latest.unit || "pieza",
        reason: `${latest.lookup?.source || "Scanner"}: ${latest.labelCode}`,
      };
      if (latest.price !== "") payload.price = Math.max(0, Number(latest.price) || 0);

      const res = await fetch("/api/stock/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "No se pudo guardar el producto");

      updateQueueItem(latest.id, {
        imageUrl: hostedImage,
        saving: false,
        saved: true,
        error: "",
        savedStock: Number(data?.product?.stock ?? 0),
      });
      if (refresh) await Promise.all([fetchProducts(), fetchHistory()]);
      return true;
    } catch (error) {
      updateQueueItem(latest.id, { saving: false, error: error instanceof Error ? error.message : "Error al guardar" });
      return false;
    }
  };

  const saveAll = async () => {
    setSavingAll(true);
    let saved = 0;
    const pending = [...queueRef.current].filter((item) => !item.saved);
    for (const item of pending) {
      if (await saveSingleItem(item, false)) saved += 1;
    }
    await Promise.all([fetchProducts(), fetchHistory()]);
    setSuccessMsg(`${saved} de ${pending.length} producto${pending.length === 1 ? "" : "s"} guardado${saved === 1 ? "" : "s"} en el inventario central.`);
    setSavingAll(false);
  };

  const clearSaved = () => updateQueue((items) => items.filter((item) => !item.saved));
  const pendingCount = queue.filter((item) => !item.saved).length;
  const savedCount = queue.filter((item) => item.saved).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">Inventario conectado</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-main">Stock / Scanner</h1>
          <p className="text-muted mt-1 max-w-2xl">Escanea varios productos seguidos, revisa la información encontrada en bases globales, edita cada ficha y recién después envíala a Supabase.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-xl border border-card bg-card2 px-3 py-2 text-xs text-muted"><Database className="w-4 h-4 text-[#F97316]" /> {products.length} productos cargados</span>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}><History className="w-4 h-4 mr-1" /> Historial</Button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-green-300 text-sm">{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg("")} className="ml-auto text-green-300/60"><X className="w-4 h-4" /></button>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-main flex items-center gap-2"><Scan className="w-5 h-5 text-[#F97316]" /> Lector continuo</h2>
            <p className="text-xs text-muted mt-1">No necesitas cerrar la cámara entre productos. Cada código diferente entra a la cola automáticamente.</p>
          </div>
          <Button variant={scannerEnabled ? "danger" : "secondary"} size="sm" onClick={() => setScannerEnabled(!scannerEnabled)}>
            {scannerEnabled ? <><X className="w-4 h-4 mr-1" /> Cerrar</> : <><Scan className="w-4 h-4 mr-1" /> Abrir scanner</>}
          </Button>
        </div>
        {scannerEnabled && <Scanner onScan={handleScan} onAiIdentify={handleAiIdentify} enabled={scannerEnabled} />}
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="text-base font-semibold text-main flex items-center gap-2 mb-2"><Search className="w-4 h-4 text-[#F97316]" /> Código manual o lector USB</h2>
            <input
              type="text"
              autoComplete="off"
              placeholder="EAN, UPC, SKU, Code128..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
              className="input-theme w-full px-4 py-3 border border-soft rounded-xl text-main placeholder:text-dim focus-mdc text-base font-mono"
            />
          </div>
          <Button onClick={handleManualAdd} size="md" className="sm:self-end sm:min-h-[50px]"><Plus className="w-4 h-4 mr-1" /> Agregar a cola</Button>
        </div>
      </Card>

      {queue.length > 0 && (
        <Card>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-main flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-[#F97316]" /> Cola editable</h2>
              <p className="text-xs text-muted mt-1">{pendingCount} pendiente{pendingCount === 1 ? "" : "s"} · {savedCount} guardado{savedCount === 1 ? "" : "s"}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={() => void Promise.all(queue.filter((item) => !item.saved && item.code).map((item) => addToQueue(item.code, item.format)))}><RefreshCw className="w-4 h-4 mr-1" /> Revisar</Button>
              {savedCount > 0 && <Button variant="ghost" size="sm" onClick={clearSaved}>Limpiar guardados</Button>}
              {pendingCount > 0 && <Button size="sm" onClick={() => void saveAll()} loading={savingAll}><Save className="w-4 h-4 mr-1" /> Guardar todo ({pendingCount})</Button>}
            </div>
          </div>

          <div className="space-y-4">
            {queue.map((item) => {
              const preview = resolveProductImageUrl(item.imageUrl);
              return (
                <div key={item.id} className={`rounded-2xl border p-4 sm:p-5 transition-all ${item.saved ? "bg-green-500/[0.04] border-green-500/25" : "bg-card2 border-card hover:border-[rgba(249,115,22,0.35)]"}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="w-full sm:w-28 flex-shrink-0">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-card border border-card flex items-center justify-center">
                        {item.loading ? <Loader2 className="w-7 h-7 text-[#F97316] animate-spin" /> : preview ? <img src={preview} alt={item.name || "Producto"} className="w-full h-full object-contain p-2" /> : <Package className="w-9 h-9 text-dim" />}
                      </div>
                      {!item.saved && (
                        <label className="mt-2 min-h-10 px-2 flex items-center justify-center gap-1.5 rounded-lg border border-soft bg-card text-xs font-semibold text-soft cursor-pointer hover:border-[#F97316]">
                          {item.uploadingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5 text-[#F97316]" />}
                          {item.imageUrl ? "Cambiar" : "Subir imagen"}
                          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" hidden disabled={item.uploadingImage} onChange={(e) => { const file = e.target.files?.[0]; void uploadQueueImage(item.id, file); e.currentTarget.value = ""; }} />
                        </label>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm text-main break-all">{item.labelCode}</span>
                        <span className="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full bg-white/[0.04] text-muted">{item.format}</span>
                        {item.loading ? (
                          <span className="text-xs text-muted flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Buscando en MDC + bases públicas...</span>
                        ) : item.lookup?.local ? (
                          <span className="text-xs text-green-400 flex items-center gap-1"><Database className="w-3.5 h-3.5" /> Ya existe · stock actual {item.lookup.stock ?? 0}</span>
                        ) : item.lookup?.found ? (
                          <span className="text-xs text-sky-300 flex items-center gap-1"><Globe2 className="w-3.5 h-3.5" /> Encontrado en {item.lookup.source}</span>
                        ) : (
                          <span className="text-xs text-yellow-300 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> No encontrado: completa los datos manualmente</span>
                        )}
                        {item.saved && <span className="ml-auto text-xs bg-green-500/10 text-green-400 border border-green-500/25 px-2 py-1 rounded-full flex items-center gap-1"><Check className="w-3 h-3" /> Guardado · stock {item.savedStock ?? 0}</span>}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="md:col-span-2 text-xs text-muted">Nombre *
                          <input disabled={item.saved} value={item.name} onChange={(e) => updateQueueItem(item.id, { name: e.target.value, error: "" })} placeholder="Nombre del producto" className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60" />
                        </label>
                        <label className="text-xs text-muted">Marca
                          <input disabled={item.saved} value={item.brand} onChange={(e) => updateQueueItem(item.id, { brand: e.target.value })} placeholder="Marca" className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60" />
                        </label>
                        <label className="text-xs text-muted">Precio CLP
                          <input disabled={item.saved} type="number" min="0" value={item.price} onChange={(e) => updateQueueItem(item.id, { price: e.target.value })} placeholder="0" className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60" />
                        </label>
                        <label className="text-xs text-muted">Categoría
                          <select disabled={item.saved} value={item.categoryId} onChange={(e) => updateQueueItem(item.id, { categoryId: e.target.value })} className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60">
                            <option value="">Sin categoría</option>
                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-xs text-muted">Cantidad
                            <input disabled={item.saved} type="number" min="1" max="9999" value={item.quantity} onChange={(e) => updateQueueItem(item.id, { quantity: Math.max(1, Math.min(9999, parseInt(e.target.value) || 1)) })} className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60" />
                          </label>
                          <label className="text-xs text-muted">Movimiento
                            <select disabled={item.saved} value={item.type} onChange={(e) => updateQueueItem(item.id, { type: e.target.value as "in" | "out" })} className="mt-1 input-theme w-full px-2 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc disabled:opacity-60">
                              <option value="in">Entrada +</option>
                              <option value="out">Salida −</option>
                            </select>
                          </label>
                        </div>
                        <label className="md:col-span-2 text-xs text-muted">Descripción
                          <textarea disabled={item.saved} rows={3} value={item.description} onChange={(e) => updateQueueItem(item.id, { description: e.target.value })} placeholder="Descripción, medida, presentación, especificaciones..." className="mt-1 input-theme w-full px-3 py-2.5 border border-soft rounded-xl text-sm text-main focus-mdc resize-y disabled:opacity-60" />
                        </label>
                      </div>

                      {item.lookup?.found && !item.lookup.local && item.lookup.category && <p className="text-[11px] text-dim">Categoría sugerida por {item.lookup.source}: {item.lookup.category}</p>}
                      {item.error && <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 flex items-start gap-2"><AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {item.error}</div>}

                      {!item.saved && (
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <Button variant="ghost" size="sm" onClick={() => removeQueueItem(item.id)}><Trash2 className="w-4 h-4 mr-1 text-red-400" /> Quitar</Button>
                          <Button size="sm" onClick={() => void saveSingleItem(item)} loading={item.saving || item.uploadingImage} disabled={item.loading}><Save className="w-4 h-4 mr-1" /> Guardar en inventario</Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {showHistory && (
        <Card>
          <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2"><History className="w-5 h-5 text-[#F97316]" /> Últimos movimientos</h2>
          {recentMoves.length === 0 ? <p className="text-sm text-muted text-center py-5">No hay movimientos todavía.</p> : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {recentMoves.map((move) => (
                <div key={move.id} className="flex items-center gap-3 p-3 bg-card2 rounded-xl border border-card">
                  <div className={`p-2 rounded-full ${move.type === "in" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {move.type === "in" ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-main truncate">{move.product?.name || "Producto"}</p>
                    <p className="text-xs text-muted">{move.reason || "Sin motivo"} · {formatDate(move.createdAt)}</p>
                  </div>
                  <p className={`text-sm font-bold ${move.type === "in" ? "text-green-400" : "text-red-400"}`}>{move.quantity > 0 ? "+" : ""}{move.quantity}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
