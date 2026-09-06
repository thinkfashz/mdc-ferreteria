"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Correo o contraseña incorrectos");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex bg-page text-main">
      {/* Panel izquierdo — branding (solo desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <Image
          src="/hero-letrero.jpg"
          alt="Taller MDC Ferretería de noche"
          fill
          priority
          className="object-cover opacity-60"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
        <div className="relative z-10 px-12 max-w-lg">
          <Image
            src="/logo-mdc.png"
            alt="MDC Ferretería"
            width={260}
            height={90}
            priority
            className="w-56 h-auto drop-shadow-[0_0_25px_rgba(249,115,22,0.4)] mb-8"
          />
          <h2 className="text-3xl font-bold leading-snug mb-4">
            La rapidez que el <span className="text-mdc-orange">maestro necesita</span>
          </h2>
          <p className="text-soft">
            Gestiona productos, inventario y stock de la ferretería desde una
            sola plataforma. Rengo 1392, Linares.
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
          {/* Logo centrado en móvil */}
          <div className="flex flex-col items-center mb-8 lg:mb-10">
            <Link href="/" className="mb-5 lg:hidden">
              <Image
                src="/logo-mdc.png"
                alt="MDC Ferretería"
                width={220}
                height={76}
                priority
                className="w-44 h-auto drop-shadow-[0_0_20px_rgba(249,115,22,0.35)]"
              />
            </Link>
            <h1 className="text-2xl font-bold">Sistema de Gestión</h1>
            <p className="text-muted mt-1 text-sm">Inicia sesión para administrar la ferretería</p>
          </div>

          <div className="bg-card rounded-2xl border border-soft p-7 sm:p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                  <span>⚠</span> {error}
                </div>
              )}

              <div className="[&_label]:text-soft [[&_input]:bg-[#0d0d0d] [&_input]:border-white/10 [&_input]:text-white_input]:input-theme [&_input]:border-soft [&_input]:text-main [&_input]:placeholder:text-dim [&_input]:py-3">
                <Input
                  id="email"
                  label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@mdc.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="[&_label]:text-soft [[&_input]:bg-[#0d0d0d] [&_input]:border-white/10 [&_input]:text-white_input]:input-theme [&_input]:border-soft [&_input]:text-main [&_input]:placeholder:text-dim [&_input]:py-3">
                <div className="relative">
                  <Input
                    id="password"
                    label="Contraseña"
                    type={verPass ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass(!verPass)}
                    aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-[38px] text-dim hover:text-soft text-sm"
                  >
                    {verPass ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full !py-3.5" size="lg" loading={loading}>
                {loading ? "Ingresando…" : "Iniciar Sesión"}
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-white/10 text-center">
              <Link href="/" className="text-sm text-muted hover:text-mdc-orange transition-colors">
                ← Volver a la tienda
              </Link>
              <p className="mt-3 text-sm text-dim">
                ¿Sin cuenta?{" "}
                <Link href="/register" className="text-mdc-orange font-semibold hover:underline">
                  Crear cuenta
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-dim mt-6">
            MDC Ferretería · Linares, Región del Maule
          </p>
        </div>
      </div>
    </div>
  );
}