"use client";

import { useEffect, useState } from "react";
import { Warehouse, Plus, ArrowDown, ArrowUp } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { formatDate } from "@/lib/utils";
import type { InventoryEntry, Product } from "@/types";

export default function InventoryPage() {
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    productId: "",
    quantity: "",
    type: "entry",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [entriesRes, productsRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/products?pageSize=200"),
      ]);
      const entriesData = await entriesRes.json();
      const productsData = await productsRes.json();
      setEntries(entriesData);
      setProducts(productsData.data || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setModalOpen(false);
        setForm({ productId: "", quantity: "", type: "entry", notes: "" });
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || "Error");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 mt-1">Control de entradas y salidas de stock</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Registrar Movimiento
        </Button>
      </div>

      <Card padding={false}>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Warehouse className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500">Sin movimientos registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Producto</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Cantidad</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Notas</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{formatDate(entry.createdAt)}</td>
                    <td className="px-4 py-3 font-medium">{entry.product?.name || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        entry.type === "entry"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}>
                        {entry.type === "entry" ? (
                          <ArrowDown className="w-3 h-3" />
                        ) : (
                          <ArrowUp className="w-3 h-3" />
                        )}
                        {entry.type === "entry" ? "Entrada" : "Salida"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{entry.quantity}</td>
                    <td className="px-4 py-3 text-gray-500">{entry.notes || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Movimiento">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            id="productId"
            label="Producto *"
            value={form.productId}
            onChange={(e) => setForm({ ...form, productId: e.target.value })}
            options={products.map((p) => ({ value: p.id, label: `${p.name} (${p.sku || "sin SKU"})` }))}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              id="quantity"
              label="Cantidad *"
              type="number"
              min="1"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
            <Select
              id="type"
              label="Tipo *"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={[
                { value: "entry", label: "Entrada" },
                { value: "exit", label: "Salida" },
              ]}
            />
          </div>

          <Textarea
            id="notes"
            label="Notas"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Motivo del movimiento..."
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={submitting} className="flex-1">
              Registrar
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
