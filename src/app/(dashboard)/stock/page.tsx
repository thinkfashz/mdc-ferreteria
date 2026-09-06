"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Package, Check, Search, ArrowDown, ArrowUp, History, Scan, X,
  Loader2, Save, Trash2, Plus, ShoppingCart,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Scanner from "@/components/ui/Scanner";
import { formatDate } from "@/lib/utils";
import type { Product, StockMovement } from "@/types";

interface BarcodeLookup {
  found: boolean;
  source: string;
  code: string;
  name: string;
  brand: string;
  description: string;
  imageUrl: string;
  category: string;
}

interface QueuedItem {
  id: string;
  code: string;
  lookup: BarcodeLookup | null;
  loading: boolean;
  quantity: number;
  type: "in" | "out";
  saved: boolean;
  localProduct: Product | null;
  /** detalles generados por IA desde foto (opcional) */
  aiDetails?: {
    name: string;
    brand: string;
    category: string;
    description: string;
    specs: string[];
    estimatedPriceClp: number;
    confidence: string;
  } | null;
  aiImage?: string;
}

export default function StockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [scannerEnabled, setScannerEnabled] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [recentMoves, setRecentMoves] = useState<StockMovement[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [savingAll, setSavingAll] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    fetchProducts();
    fetchHistory();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch("/api/products?pageSize=500");
    const data = await res.json();
    setProducts(data.data || []);
  };

  const fetchHistory = async () => {
    const res = await fetch("/api/stock");
    const data = await res.json();
    setRecentMoves(data.slice(0, 20));
  };

  const lookupBarcode = async (code: string): Promise<BarcodeLookup | null> => {
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(code)}`);
      return await res.json();
    } catch {
      return { found: false, source: "error", code, name: "", brand: "", description: "", imageUrl: "", category: "" };
    }
  };

  const addToQueue = useCallback(async (code: string) => {
    const existing = queue.find((q) => q.code === code);
    if (existing) {
      setQueue((prev) => prev.map((q) =>
        q.code === code ? { ...q, quantity: q.quantity + 1 } : q
      ));
      return;
    }

    const newItem: QueuedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code,
      lookup: null,
      loading: true,
      quantity: 1,
      type: "in",
      saved: false,
      localProduct: products.find((p) => p.barcode === code || p.sku === code) || null,
    };

    setQueue((prev) => [newItem, ...prev]);

    const lookup = await lookupBarcode(code);

    setQueue((prev) => prev.map((q) =>
      q.code === code ? { ...q, lookup, loading: false } : q
    ));
  }, [queue, products]);

  const handleScan = useCallback((decodedText: string) => {
    addToQueue(decodedText);
  }, [addToQueue]);

  /* Producto identificado por IA desde foto → va directo a la cola */
  const handleAiIdentify = useCallback((details: any, imageDataUrl: string) => {
    const item: QueuedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      code: `AI-${Date.now().toString(36).toUpperCase()}`,
      lookup: {
        found: true,
        source: `IA (${details.confidence})`,
        code: "",
        name: details.name,
        brand: details.brand,
        description: details.description || "",
        imageUrl: imageDataUrl,
        category: details.category,
      },
      loading: false,
      quantity: 1,
      type: "in",
      saved: false,
      localProduct: null,
      aiDetails: details,
      aiImage: imageDataUrl,
    };
    setQueue((prev) => [item, ...prev]);
  }, []);

  const handleManualAdd = () => {
    if (manualCode.trim()) {
      addToQueue(manualCode.trim());
      setManualCode("");
    }
  };

  const updateQueueItem = (id: string, updates: Partial<QueuedItem>) => {
    setQueue((prev) => prev.map((q) => q.id === id ? { ...q, ...updates } : q));
  };

  const removeQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  };

  const saveSingleItem = async (item: QueuedItem) => {
    const name = item.aiDetails?.name || item.lookup?.name || item.localProduct?.name || `Producto ${item.code}`;
    try {
      const res = await fetch("/api/stock/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: item.aiDetails ? "" : item.code,
          name,
          brand: item.aiDetails?.brand || item.lookup?.brand || "",
          description: item.aiDetails?.description || item.lookup?.description || "",
          imageUrl: item.aiImage || item.lookup?.imageUrl || "",
          category: item.aiDetails?.category || item.lookup?.category || "",
          price: item.aiDetails?.estimatedPriceClp || undefined,
          quantity: item.quantity.toString(),
          type: item.type,
          reason: item.aiDetails ? "Identificado por IA (foto)" : `Escaneo rapido: ${item.code}`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        updateQueueItem(item.id, { saved: true });
        return true;
      }
      return false;
    } catch { return false; }
  };

  const saveAll = async () => {
    setSavingAll(true);
    let saved = 0;
    for (const item of queue) {
      if (!item.saved) {
        const ok = await saveSingleItem(item);
        if (ok) saved++;
      }
    }
    setSuccessMsg(`${saved} productos guardados exitosamente`);
    setSuccess(true);
    setTimeout(() => setSuccess(false), 5000);
    fetchProducts();
    fetchHistory();
    setSavingAll(false);
  };

  const clearSaved = () => {
    setQueue((prev) => prev.filter((q) => !q.saved));
  };

  const pendingCount = queue.filter((q) => !q.saved).length;
  const savedCount = queue.filter((q) => q.saved).length;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">
            Movimientos
          </p>
          <h1 className="text-2xl font-bold text-main">Stock / Scanner</h1>
          <p className="text-muted mt-1">Escanea códigos QR y de barras, y guarda al instante</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" /> Historial
          </Button>
          {queue.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setQueue([])}>
              <Trash2 className="w-4 h-4 mr-1" /> Limpiar cola
            </Button>
          )}
        </div>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
          <Check className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-green-300 text-sm">{successMsg}</span>
        </div>
      )}

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-main flex items-center gap-2">
            <Scan className="w-5 h-5 text-[#F97316]" />
            Escanear Código
          </h2>
          <Button
            variant={scannerEnabled ? "danger" : "secondary"}
            size="sm"
            onClick={() => setScannerEnabled(!scannerEnabled)}
          >
            {scannerEnabled ? <><X className="w-4 h-4 mr-1" /> Cerrar</> : <><Scan className="w-4 h-4 mr-1" /> Abrir Scanner</>}
          </Button>
        </div>
        {scannerEnabled && <Scanner onScan={handleScan} onAiIdentify={handleAiIdentify} enabled={scannerEnabled} />}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-[#F97316]" />
          Agregar Código Manual
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Escribe o pega el código de barras / QR..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
            className="input-theme flex-1 px-3 py-2 border border-soft rounded-lg text-main placeholder:text-dim focus-mdc text-sm"
          />
          <Button onClick={handleManualAdd} size="md">
            <Plus className="w-4 h-4 mr-1" /> Agregar
          </Button>
        </div>
        <p className="text-xs text-dim mt-2">
          También puedes usar un lector USB: enfoca el campo y dispara el código.
        </p>
      </Card>

      {queue.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-main flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#F97316]" />
              Cola de Escaneos
              <span className="text-sm font-normal text-muted">
                ({pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}{savedCount > 0 ? `, ${savedCount} guardado${savedCount !== 1 ? "s" : ""}` : ""})
              </span>
            </h2>
            <div className="flex gap-2">
              {savedCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearSaved}>
                  Limpiar guardados
                </Button>
              )}
              {pendingCount > 0 && (
                <Button size="sm" onClick={saveAll} loading={savingAll}>
                  <Save className="w-4 h-4 mr-1" />
                  Guardar todo ({pendingCount})
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`border rounded-xl p-4 transition-all ${
                  item.saved
                    ? "bg-green-500/5 border-green-500/30 opacity-60"
                    : "bg-card2 border-card hover:border-[rgba(249,115,22,0.4)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {item.loading ? (
                    <div className="w-12 h-12 bg-card rounded-lg flex items-center justify-center flex-shrink-0 border border-card">
                      <Loader2 className="w-5 h-5 text-dim animate-spin" />
                    </div>
                  ) : item.lookup?.imageUrl ? (
                    <img src={item.lookup.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-card" />
                  ) : item.localProduct?.imageUrl ? (
                    <img src={item.localProduct.imageUrl} alt="" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-card" />
                  ) : (
                    <div className="w-12 h-12 bg-card rounded-lg flex items-center justify-center flex-shrink-0 border border-card">
                      <Package className="w-6 h-6 text-dim" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {item.loading ? (
                      <div>
                        <p className="font-mono text-sm text-soft">{item.code}</p>
                        <p className="text-xs text-muted">Buscando en bases de datos...</p>
                      </div>
                    ) : item.localProduct ? (
                      <div>
                        <p className="font-medium text-main text-sm">{item.localProduct.name}</p>
                        <p className="text-xs text-green-400">Ya existe en tu inventario | Stock: {item.localProduct.stock}</p>
                      </div>
                    ) : item.lookup?.found ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-1.5 py-0.5 rounded font-medium">Encontrado</span>
                          <span className="text-xs text-dim">{item.lookup.source}</span>
                        </div>
                        <p className="font-medium text-main text-sm mt-1">{item.lookup.name}</p>
                        {item.lookup.brand && <p className="text-xs text-muted">Marca: {item.lookup.brand}</p>}
                      </div>
                    ) : (
                      <div>
                        <p className="font-mono text-sm text-main">{item.code}</p>
                        <p className="text-xs text-yellow-400">No encontrado - se guardará como nuevo</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {item.saved ? (
                      <span className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Guardado
                      </span>
                    ) : (
                      <button
                        onClick={() => removeQueueItem(item.id)}
                        className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!item.saved && !item.loading && (
                  <div className="mt-3 flex items-center gap-2 pt-3 border-t border-card">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateQueueItem(item.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="input-theme w-20 px-2 py-1.5 border border-soft rounded-lg text-sm text-center text-main focus-mdc"
                    />
                    <select
                      value={item.type}
                      onChange={(e) => updateQueueItem(item.id, { type: e.target.value as "in" | "out" })}
                      className="input-theme px-2 py-1.5 border border-soft rounded-lg text-sm text-main focus-mdc"
                    >
                      <option value="in">Entrada (+)</option>
                      <option value="out">Salida (-)</option>
                    </select>
                    <div className="flex-1" />
                    <Button size="sm" onClick={() => saveSingleItem(item)}>
                      <Save className="w-3 h-3 mr-1" /> Guardar
                    </Button>
                  </div>
                )}

                {item.saved && (
                  <div className="mt-2 pt-2 border-t border-green-500/20">
                    <p className="text-xs text-green-400">
                      {item.type === "in" ? "Entrada" : "Salida"} de {item.quantity} uds guardada
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {showHistory && (
        <Card>
          <h2 className="text-lg font-semibold text-main mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-[#F97316]" /> Últimos Movimientos
          </h2>
          {recentMoves.length === 0 ? (
            <p className="text-sm text-muted text-center py-4">No hay movimientos</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {recentMoves.map((move) => (
                <div key={move.id} className="flex items-center gap-3 p-3 bg-card2 rounded-lg border border-card">
                  <div className={`p-2 rounded-full ${move.type === "in" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                    {move.type === "in" ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-main truncate">{move.product?.name || "Producto"}</p>
                    <p className="text-xs text-muted">{move.reason || "Sin motivo"} | {formatDate(move.createdAt)}</p>
                  </div>
                  <p className={`text-sm font-bold ${move.type === "in" ? "text-green-400" : "text-red-400"}`}>
                    {move.type === "in" ? "+" : "-"}{move.quantity}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}