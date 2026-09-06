"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al crear cuenta");
        setLoading(false);
        return;
      }

      router.push("/login");
    } catch {
      setError("Error de conexión");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-[#FF6600] rounded-2xl mb-4">
            <span className="text-3xl font-bold text-white">MDC</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Crear Cuenta</h1>
          <p className="text-gray-400 mt-1">Registro de administrador</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Input
              id="name"
              label="Nombre"
              type="text"
              placeholder="Tu nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              id="email"
              label="Correo electrónico"
              type="email"
              placeholder="admin@mdc.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="password"
              label="Contraseña"
              type="password"
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Crear Cuenta
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/login" className="text-sm text-[#FF6600] hover:underline">
              Ya tengo cuenta, iniciar sesión
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
