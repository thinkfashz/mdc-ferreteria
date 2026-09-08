import { NextResponse } from "next/server";
import { callMdcRpc } from "@/lib/supabase-public";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const token = String(body?.token || "").trim();
    const password = String(body?.password || "");

    if (!email || !token || !password) {
      return NextResponse.json({ error: "Completa correo, código de activación y contraseña." }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 12 caracteres." }, { status: 400 });
    }

    const activated = await callMdcRpc<boolean>("mdc_admin_activate_root", {
      p_email: email,
      p_token: token,
      p_password: password,
    });

    if (activated !== true) {
      return NextResponse.json(
        { error: "Código inválido, ya utilizado o usuario root no disponible." },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Acceso root activado. Ya puedes iniciar sesión." },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Root activation error:", error instanceof Error ? error.message : "error");
    return NextResponse.json({ error: "No se pudo activar el acceso root." }, { status: 500 });
  }
}
