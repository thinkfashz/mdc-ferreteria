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
  const [email, setEmail] = useState("admin@mdcferreteria.cl");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const [showActivation, setShowActivation] = useState(false);
  const [activationToken, setActivationToken] = useState("");
  const [activationPassword, setActivationPassword] = useState("");
  const [activationConfirm, setActivationConfirm] = useState("");
  const [activationLoading, setActivationLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Correo o contraseña incorrectos");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servicio de acceso");
      setLoading(false);
    }
  };

  const activateRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    if (activationPassword.length < 12) {
      setError("La nueva contraseña debe tener al menos 12 caracteres");
      return;
    }
    if (activationPassword !== activationConfirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setActivationLoading(true);
    try {
      const response = await fetch("/api/auth/activate-root", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          token: activationToken.trim(),
          password: activationPassword,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "No se pudo activar el acceso root");
        return;
      }

      setPassword(activationPassword);
      setActivationToken("");
      setActivationPassword("");
      setActivationConfirm("");
      setShowActivation(false);
      setNotice("Acceso root activado. Presiona “Iniciar Sesión”.");
    } catch {
      setError("No se pudo conectar con el servicio de activación");
    } finally {
      setActivationLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-page text-main">
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
            Gestiona productos, inventario y stock de la ferretería desde una sola plataforma. Rengo 1392, Linares.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 sm:px-8 py-12">
        <div className="w-full max-w-md">
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
            <p className="text-muted mt-1 text-sm">Acceso administrativo MDC</p>
          </div>

          <div className="bg-card rounded-2xl border border-soft p-7 sm:p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                  ⚠ {error}
                </div>
              )}
              {notice && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl text-sm">
                  ✓ {notice}
                </div>
              )}

              <div className="[&_label]:text-soft [&_input]:bg-[#0d0d0d] [&_input]:border-white/10 [&_input]:text-white [&_input]:py-3">
                <Input
                  id="email"
                  label="Correo electrónico"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@mdcferreteria.cl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="[&_label]:text-soft [&_input]:bg-[#0d0d0d] [&_input]:border-white/10 [&_input]:text-white [&_input]:py-3">
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

            <div className="mt-6 pt-6 border-t border-white/10 text-center space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowActivation((value) => !value);
                  setError("");
                  setNotice("");
                }}
                className="text-sm text-mdc-orange font-semibold hover:underline"
              >
                {showActivation ? "Cerrar activación root" : "Activar o restablecer acceso root"}
              </button>
              <div>
                <Link href="/" className="text-sm text-muted hover:text-mdc-orange transition-colors">
                  ← Volver a la tienda
                </Link>
              </div>
            </div>

            {showActivation && (
              <form onSubmit={activateRoot} className="mt-5 pt-5 border-t border-white/10 space-y-4">
                <div className="rounded-xl bg-white/[0.035] border border-white/10 p-3 text-xs text-muted leading-relaxed">
                  Esta activación es de un solo uso. Ingresa el código root entregado por el administrador y define una contraseña nueva de al menos 12 caracteres.
                </div>
                <Input
                  id="activation-token"
                  label="Código de activación root"
                  type="text"
                  autoComplete="off"
                  value={activationToken}
                  onChange={(e) => setActivationToken(e.target.value)}
                  required
                />
                <Input
                  id="activation-password"
                  label="Nueva contraseña"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={activationPassword}
                  onChange={(e) => setActivationPassword(e.target.value)}
                  required
                />
                <Input
                  id="activation-confirm"
                  label="Confirmar contraseña"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={activationConfirm}
                  onChange={(e) => setActivationConfirm(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" loading={activationLoading}>
                  {activationLoading ? "Activando…" : "Activar acceso root"}
                </Button>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-dim mt-6">MDC Ferretería · Linares, Región del Maule</p>
        </div>
      </div>
    </div>
  );
}
