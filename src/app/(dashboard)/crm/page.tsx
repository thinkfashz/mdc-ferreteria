"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, ShoppingCart, DollarSign, Inbox, Search, RefreshCw, Phone, Mail, MapPin, Package,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

interface OrderItem { id: string; name: string; price: number; qty: number }
interface Order {
  id: string; number: number; status: string; total: number;
  items: OrderItem[]; notes?: string; source: string; createdAt: string;
  customer: { name: string; phone?: string; email?: string; address?: string; city?: string };
}
interface CustomerRow {
  id: string; name: string; email?: string; phone?: string; address?: string; city: string;
  ordersCount: number; totalSpent: number;
  lastOrder?: { number: number; createdAt: string; status: string; total: number } | null;
}

const STATUS_STYLES: Record<string, string> = {
  nuevo: "bg-accent-soft text-accent",
  confirmado: "bg-blue-500/10 text-blue-300",
  preparando: "bg-yellow-500/10 text-yellow-300",
  enviado: "bg-purple-500/10 text-purple-300",
  entregado: "bg-green-500/10 text-green-300",
  cancelado: "bg-red-500/10 text-red-300",
};

const STATUSES = ["nuevo", "confirmado", "preparando", "enviado", "entregado", "cancelado"];

export default function CrmPage() {
  const [data, setData] = useState<{ stats: any; orders: Order[]; customers: CustomerRow[] } | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pedidos" | "clientes">("pedidos");

  const fetchCrm = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm?search=${encodeURIComponent(search)}`);
      const d = await res.json();
      setData(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCrm(); }, [fetchCrm]);

  const updateStatus = async (orderId: string, status: string) => {
    await fetch("/api/crm", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    fetchCrm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#F97316] border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.22em] uppercase text-[#F97316] mb-2">CRM</p>
          <h1 className="text-2xl font-bold text-main">Clientes y Pedidos</h1>
          <p className="text-muted mt-1">Todo lo que llega desde la tienda web</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchCrm}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualizar
        </Button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Clientes", value: stats.totalCustomers || 0, icon: Users },
          { title: "Pedidos", value: stats.totalOrders || 0, icon: ShoppingCart },
          { title: "Nuevos", value: stats.newOrders || 0, icon: Inbox },
          { title: "Ingresos", value: "$" + (stats.revenue || 0).toLocaleString("es-CL"), icon: DollarSign },
        ].map(s => (
          <Card key={s.title}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent-soft">
                <s.icon className="w-5 h-5 text-[#F97316]" />
              </div>
              <div>
                <p className="text-sm text-muted">{s.title}</p>
                <p className="text-xl font-bold text-main">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-1 p-1 bg-card2 rounded-xl border border-card w-fit">
          {(["pedidos", "clientes"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                tab === t ? "bg-accent-soft text-accent" : "text-muted hover:text-main"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
          <input
            type="text"
            placeholder="Buscar cliente por nombre, teléfono o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-theme w-full pl-10 pr-4 py-2 border border-soft rounded-lg text-main placeholder:text-dim focus-mdc text-sm"
          />
        </div>
      </div>

      {/* PEDIDOS */}
      {tab === "pedidos" && (
        <div className="space-y-3">
          {!data?.orders.length && (
            <Card className="text-center py-10 text-muted">
              Aún no hay pedidos. Cuando alguien compre en la tienda, aparecerá aquí.
            </Card>
          )}
          {data?.orders.map(o => (
            <Card key={o.id} className="hover:border-[rgba(249,115,22,0.35)] transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-accent font-bold">#{o.number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[o.status] || ""}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-dim">{o.source}</span>
                    <span className="text-xs text-dim">{new Date(o.createdAt).toLocaleString("es-CL")}</span>
                  </div>
                  <p className="text-main font-semibold mt-1">{o.customer?.name}</p>
                  <p className="text-xs text-muted flex flex-wrap gap-x-3">
                    {o.customer?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{o.customer.phone}</span>}
                    {o.customer?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{o.customer.email}</span>}
                    {o.customer?.address && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{o.customer.address}, {o.customer.city}</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
                    {o.items.map((it, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-dim" />
                        {it.qty}× {it.name}
                      </span>
                    ))}
                  </div>
                  {o.notes && <p className="text-xs text-muted mt-2 italic">"{o.notes}"</p>}
                </div>
                <div className="sm:text-right">
                  <p className="text-xl font-bold text-[#F97316]">
                    ${o.total.toLocaleString("es-CL")}
                  </p>
                  <select
                    value={o.status}
                    onChange={e => updateStatus(o.id, e.target.value)}
                    className="input-theme mt-2 px-3 py-1.5 border border-soft rounded-lg text-sm text-main focus-mdc"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CLIENTES */}
      {tab === "clientes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {!data?.customers.length && (
            <Card className="col-span-full text-center py-10 text-muted">
              No hay clientes todavía.
            </Card>
          )}
          {data?.customers.map(c => (
            <Card key={c.id} className="hover:border-[rgba(249,115,22,0.35)] transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-main truncate">{c.name}</p>
                  <p className="text-xs text-muted space-y-0.5">
                    {c.phone && <span className="block">{c.phone}</span>}
                    {c.email && <span className="block truncate">{c.email}</span>}
                    {c.address && <span className="block">{c.address}, {c.city}</span>}
                  </p>
                </div>
                <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center flex-none">
                  <span className="text-accent font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-card flex justify-between text-sm">
                <span className="text-muted">{c.ordersCount} pedido{c.ordersCount !== 1 ? "s" : ""}</span>
                <span className="font-bold text-[#F97316]">${c.totalSpent.toLocaleString("es-CL")}</span>
              </div>
              {c.lastOrder && (
                <p className="text-xs text-dim mt-2">
                  Último: #{c.lastOrder.number} · {c.lastOrder.status} · {new Date(c.lastOrder.createdAt).toLocaleDateString("es-CL")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}