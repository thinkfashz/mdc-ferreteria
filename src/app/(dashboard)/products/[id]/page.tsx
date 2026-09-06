"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import ProductImageUpload from "@/components/products/ProductImageUpload";
import Link from "next/link";
import type { Category } from "@/types";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    brand: "",
    price: "",
    compareAtPrice: "",
    sku: "",
    barcode: "",
    imageUrl: "",
    categoryId: "",
    stock: "",
    minStock: "",
    unit: "pieza",
    featured: false,
    active: true,
  });

  useEffect(() => {
    Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([product, cats]) => {
      setForm({
        name: product.name || "",
        description: product.description || "",
        brand: product.brand || "",
        price: product.price?.toString() || "",
        compareAtPrice: product.compareAtPrice?.toString() || "",
        sku: product.sku || "",
        barcode: product.barcode || "",
        imageUrl: product.imageUrl || "",
        categoryId: product.categoryId || "",
        stock: product.stock?.toString() || "0",
        minStock: product.minStock?.toString() || "0",
        unit: product.unit || "pieza",
        featured: product.featured || false,
        active: product.active ?? true,
      });
      setCategories(Array.isArray(cats) ? cats : []);
      setFetching(false);
    }).catch(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        router.push("/products");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Error al actualizar");
      }
    } catch {
      alert("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#FF6600] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Producto</h1>
          <p className="text-gray-500 mt-1">Los cambios se reflejan en la tienda pública</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <ProductImageUpload
            value={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
          />

          <Input
            id="name"
            label="Nombre del producto *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="brand"
              label="Marca"
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              placeholder="Ej: Stanley"
            />
            <Select
              id="categoryId"
              label="Categoría"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>

          <Textarea
            id="description"
            label="Descripción"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="price"
              label="Precio de venta"
              type="number"
              step="1"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Input
              id="compareAtPrice"
              label="Precio anterior (opcional)"
              type="number"
              step="1"
              min="0"
              value={form.compareAtPrice}
              onChange={(e) => setForm({ ...form, compareAtPrice: e.target.value })}
              placeholder="Solo para ofertas reales"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="sku"
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
            <Input
              id="barcode"
              label="Código de barras"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="stock"
              label="Stock actual"
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
            />
            <Input
              id="minStock"
              label="Stock mínimo"
              type="number"
              min="0"
              value={form.minStock}
              onChange={(e) => setForm({ ...form, minStock: e.target.value })}
            />
            <Select
              id="unit"
              label="Unidad"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              options={[
                { value: "pieza", label: "Pieza" },
                { value: "kg", label: "Kilogramo" },
                { value: "lt", label: "Litro" },
                { value: "m", label: "Metro" },
                { value: "m2", label: "Metro cuadrado" },
                { value: "m3", label: "Metro cúbico" },
                { value: "caja", label: "Caja" },
                { value: "par", label: "Par" },
                { value: "docena", label: "Docena" },
              ]}
            />
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 text-[#FF6600] rounded"
              />
              <span className="text-sm font-medium text-gray-700">Destacado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 text-[#FF6600] rounded"
              />
              <span className="text-sm font-medium text-gray-700">Activo</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" loading={loading}>
              <Save className="w-4 h-4 mr-2" /> Actualizar Producto
            </Button>
            <Link href="/products"><Button type="button" variant="secondary">Cancelar</Button></Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
