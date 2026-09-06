"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, Package, Edit, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pagination from "@/components/ui/Pagination";
import { formatCurrency } from "@/lib/utils";
import type { Product, PaginatedResponse } from "@/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<PaginatedResponse<Product> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "12",
        ...(search && { search }),
      });
      const res = await fetch(`/api/products?${params}`);
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE" });
      fetchProducts();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">
            Catálogo
          </p>
          <h1 className="text-2xl font-bold text-main">Productos</h1>
          <p className="text-muted mt-1">Gestiona tu catálogo de productos</p>
        </div>
        <Link href="/products/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </Link>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
            <input
              type="text"
              placeholder="Buscar por nombre, SKU o código..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input-theme w-full pl-10 pr-4 py-2 border border-soft rounded-lg text-main placeholder:text-dim focus-mdc"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
        </div>
      ) : !products?.data.length ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Package className="w-12 h-12 text-dim mb-4" />
          <p className="text-muted">No se encontraron productos</p>
          <Link href="/products/new" className="mt-4">
            <Button>Agregar primer producto</Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.data.map((product) => (
              <Card key={product.id} className="flex flex-col hover:border-[rgba(249,115,22,0.4)] transition-colors">
                <div className="flex items-start gap-3">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg border border-card"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-card2 rounded-lg flex items-center justify-center border border-card">
                      <Package className="w-8 h-8 text-dim" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-main truncate">{product.name}</h3>
                    <p className="text-sm text-muted font-mono text-xs">{product.sku || "Sin SKU"}</p>
                    <p className="text-lg font-bold text-[#F97316] mt-1">
                      {formatCurrency(product.price)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-muted">Stock: </span>
                    <span className={`font-semibold ${product.stock <= product.minStock ? "text-red-400" : "text-green-400"}`}>
                      {product.stock} {product.unit}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Link href={`/products/${product.id}`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>

                {product.category && (
                  <span className="mt-3 inline-block w-fit text-xs bg-accent-soft text-accent px-2 py-1 rounded-full">
                    {product.category.name}
                  </span>
                )}
              </Card>
            ))}
          </div>

          <Pagination
            page={products.page}
            totalPages={products.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}