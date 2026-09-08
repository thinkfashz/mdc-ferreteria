"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Package, Edit, Trash2, Database, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { formatCurrency } from "@/lib/utils";
import { resolveProductImageUrl } from "@/lib/brand";
import type { Product, PaginatedResponse } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<PaginatedResponse<Product> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => { void fetchProducts(); }, [page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: page.toString(), pageSize: "12", ...(search && { search }) });
      const res = await fetch(`/api/products?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data?.data)) throw new Error(data?.error || "No se pudo cargar el catálogo");
      setProducts(data);
    } catch (err) {
      setProducts(null);
      setError(err instanceof Error ? err.message : "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto del catálogo central?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar");
      await fetchProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">Catálogo central</p>
          <h1 className="text-2xl font-bold text-main">Productos</h1>
          <p className="text-muted mt-1">La tienda pública y este panel leen la misma tabla de productos y el mismo stock.</p>
        </div>
        <div className="flex items-center gap-2">
          {products && <span className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-card bg-card2 px-3 py-2 text-xs text-muted"><Database className="w-4 h-4 text-[#F97316]" /> {products.total} productos sincronizados</span>}
          <Link href="/products/new"><Button><Plus className="w-4 h-4 mr-2" /> Nuevo producto</Button></Link>
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
          <input type="text" placeholder="Buscar por nombre, SKU o código..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="input-theme w-full pl-10 pr-4 py-3 border border-soft rounded-xl text-main placeholder:text-dim focus-mdc" />
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {loading ? (
        <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full" /></div>
      ) : !products?.data?.length ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Package className="w-12 h-12 text-dim mb-4" />
          <p className="text-muted">No se encontraron productos</p>
          <Link href="/products/new" className="mt-4"><Button>Agregar primer producto</Button></Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.data.map((product) => {
              const image = resolveProductImageUrl(product.imageUrl);
              const noStock = product.stock <= 0;
              const lowStock = !noStock && product.minStock > 0 && product.stock <= product.minStock;
              return (
                <Card key={product.id} className="flex flex-col hover:border-[rgba(249,115,22,0.4)] transition-colors">
                  <div className="flex items-start gap-3">
                    {image ? <img src={image} alt={product.name} className="w-20 h-20 object-contain p-1 rounded-xl border border-card bg-card2" /> : <div className="w-20 h-20 bg-card2 rounded-xl flex items-center justify-center border border-card"><Package className="w-8 h-8 text-dim" /></div>}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-main line-clamp-2 leading-tight">{product.name}</h3>
                      <p className="text-[11px] text-muted font-mono mt-1 truncate">{product.sku || product.barcode || "Sin código"}</p>
                      <p className="text-lg font-bold text-[#F97316] mt-1">{formatCurrency(product.price)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${noStock ? "bg-red-500/10 text-red-400" : lowStock ? "bg-yellow-500/10 text-yellow-300" : "bg-green-500/10 text-green-400"}`}>
                      {noStock ? "Sin stock" : `Stock: ${product.stock} ${product.unit}`}
                    </span>
                    <div className="flex gap-1">
                      <Link href={`/products/${product.id}`}><Button variant="ghost" size="sm"><Edit className="w-4 h-4" /></Button></Link>
                      <Button variant="ghost" size="sm" onClick={() => void handleDelete(product.id)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                    </div>
                  </div>

                  {product.category && <span className="mt-3 inline-block w-fit text-xs bg-accent-soft text-accent px-2 py-1 rounded-full">{product.category.name}</span>}
                  {noStock && <Link href="/stock" className="mt-3 text-xs font-semibold text-[#F97316] hover:underline">Registrar entrada de stock →</Link>}
                </Card>
              );
            })}
          </div>
          <Pagination page={products.page} totalPages={products.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
