"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-[#F97316] rounded-2xl mb-6 shadow-lg shadow-[#F97316]/30">
            <span className="text-4xl font-bold text-[#0d0d0d]">MDC</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold text-main mb-4">
            Sistema de Gesti&oacute;n
          </h1>
          <p className="text-muted mb-8 max-w-md mx-auto">
            Administra tu cat&aacute;logo de productos, inventario, stock y banners desde
            una sola plataforma. Compatible con dispositivos m&oacute;viles y escritorio.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {status === "authenticated" ? (
              <Link href="/dashboard">
                <Button size="lg" className="w-full sm:w-auto">
                  Ir al Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/login">
                  <Button size="lg" className="w-full sm:w-auto">
                    Iniciar Sesi&oacute;n
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    Crear Cuenta
                  </Button>
                </Link>
              </>
            )}
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: "Productos", desc: "Cat&aacute;logo completo" },
              { label: "Inventario", desc: "Control total" },
              { label: "Scanner", desc: "C&aacute;mara integrada" },
              { label: "Banners", desc: "Portadas din&aacute;micas" },
            ].map((item) => (
              <div key={item.label} className="p-4 bg-card border border-card rounded-xl">
                <p className="text-main font-medium text-sm">{item.label}</p>
                <p className="text-muted text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-sm text-muted">
            &iquest;Buscas la tienda p&uacute;blica?{" "}
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noopener"
              className="text-[#F97316] font-semibold hover:underline"
            >
              Ver cat&aacute;logo MDC &rarr;
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}