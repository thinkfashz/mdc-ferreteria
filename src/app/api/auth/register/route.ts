import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "El registro público de administradores está deshabilitado." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
