"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  Camera,
  Image,
  Settings,
  LogOut,
  Menu,
  X,
  Store,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Inventario", href: "/inventory", icon: Warehouse },
  { name: "Stock / Scanner", href: "/stock", icon: Camera },
  { name: "CRM", href: "/crm", icon: Users },
  { name: "Banners", href: "/banners", icon: Image },
  { name: "Configuración", href: "/settings", icon: Settings },
  { name: "Setup BD", href: "/setup", icon: Wrench },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 lg:hidden bg-[#F97316] text-[#0d0d0d] p-2 rounded-lg shadow-lg"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-section border-r border-card flex flex-col transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-card">
          <div className="w-10 h-10 bg-[#F97316] rounded-xl flex items-center justify-center font-bold text-lg text-[#0d0d0d]">
            MDC
          </div>
          <div>
            <h1 className="font-bold text-sm text-main">MDC Ferretería</h1>
            <p className="text-xs text-muted">Sistema de Gestión</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden p-1 hover:bg-[var(--hover-soft)] rounded"
          >
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-[var(--hover-soft)] hover:text-main"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-accent")} />
                <span>{item.name}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-card space-y-1">
          <a
            href="http://localhost:3002"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-[var(--hover-soft)] hover:text-main transition-colors"
          >
            <Store className="w-5 h-5" />
            <span>Ver Tienda</span>
          </a>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:bg-[var(--hover-soft)] hover:text-main transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}