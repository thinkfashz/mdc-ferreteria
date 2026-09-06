"use client";

import { useEffect, useState } from "react";
import { Package, FolderTree, AlertTriangle, Warehouse, Plus, Camera, TrendingUp, Users, ShoppingBag } from "lucide-react";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { DashboardStats, Product } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lowStock, setLowStock] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await res.json();
      setStats(data.stats);
      setLowStock(data.lowStock || []);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }

  const statCards = [
    { title: "Productos", value: stats?.totalProducts || 0, icon: Package, href: "/products" },
    { title: "Categorías", value: stats?.totalCategories || 0, icon: FolderTree, href: "/products" },
    {
      title: "Stock Bajo",
      value: stats?.lowStockProducts || 0,
      icon: AlertTriangle,
      href: "/inventory",
      alert: (stats?.lowStockProducts || 0) > 0,
    },
    { title: "Inventario Total", value: stats?.totalInventory || 0, icon: Warehouse, href: "/inventory" },
    { title: "Visitas · 7 días", value: stats?.pageviews7d || 0, icon: TrendingUp, href: "/dashboard" },
    { title: "Visitantes · 7 días", value: stats?.visitors7d || 0, icon: Users, href: "/dashboard" },
    {
      title: "Pedidos nuevos",
      value: stats?.newOrders || 0,
      icon: ShoppingBag,
      href: "/crm",
      alert: (stats?.newOrders || 0) > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">Panel de control</p>
        <h1 className="text-2xl font-bold text-main">Resumen de tu ferretería</h1>
        <p className="text-muted mt-1">Inventario, pedidos y actividad de la tienda pública en un solo lugar.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="group hover:border-[rgba(249,115,22,0.45)] transition-all cursor-pointer hover:-translate-y-0.5 h-full">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent-soft">
                  <stat.icon className={`w-6 h-6 ${stat.alert ? "text-yellow-400" : "text-[#F97316]"}`} />
                </div>
                <div>
                  <p className="text-sm text-muted">{stat.title}</p>
                  <p className="text-2xl font-bold text-main">{stat.value}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="border-[rgba(249,115,22,0.16)]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-accent-soft"><TrendingUp className="w-5 h-5 text-[#F97316]" /></div>
          <div>
            <h2 className="font-semibold text-main">Estadísticas con consentimiento</h2>
            <p className="text-sm text-muted mt-1">
              Las visitas se registran de forma anónima únicamente cuando el cliente acepta estadísticas en la tienda. No se guarda IP ni información sensible.
            </p>
          </div>
        </div>
      </Card>

      {lowStock.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-main mb-4">
            <AlertTriangle className="w-5 h-5 inline text-yellow-400 mr-2" />
            Productos con Stock Bajo
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-soft">
                  <th className="text-left py-2 font-medium text-muted">Producto</th>
                  <th className="text-left py-2 font-medium text-muted">SKU</th>
                  <th className="text-right py-2 font-medium text-muted">Stock</th>
                  <th className="text-right py-2 font-medium text-muted">Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((product) => (
                  <tr key={product.id} className="border-b border-card last:border-0">
                    <td className="py-2.5 text-main">{product.name}</td>
                    <td className="py-2.5 text-muted font-mono text-xs">{product.sku || "-"}</td>
                    <td className="py-2.5 text-right font-semibold text-red-400">{product.stock}</td>
                    <td className="py-2.5 text-right text-muted">{product.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/products/new">
          <Card className="hover:border-[rgba(249,115,22,0.45)] transition-all cursor-pointer border-dashed flex items-center justify-center min-h-[120px] group">
            <div className="text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-accent-soft flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Plus className="w-5 h-5 text-[#F97316]" />
              </div>
              <p className="text-sm font-medium text-soft">Agregar Producto</p>
            </div>
          </Card>
        </Link>
        <Link href="/stock">
          <Card className="hover:border-[rgba(249,115,22,0.45)] transition-all cursor-pointer border-dashed flex items-center justify-center min-h-[120px] group">
            <div className="text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-accent-soft flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5 text-[#F97316]" />
              </div>
              <p className="text-sm font-medium text-soft">Escanear Código</p>
            </div>
          </Card>
        </Link>
        <Link href="/inventory">
          <Card className="hover:border-[rgba(249,115,22,0.45)] transition-all cursor-pointer border-dashed flex items-center justify-center min-h-[120px] group">
            <div className="text-center">
              <div className="w-11 h-11 mx-auto rounded-xl bg-accent-soft flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Warehouse className="w-5 h-5 text-[#F97316]" />
              </div>
              <p className="text-sm font-medium text-soft">Gestionar Inventario</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
