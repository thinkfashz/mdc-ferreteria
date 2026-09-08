import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { adminGatewayResponse, adminRpc } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const result = await adminRpc<unknown>("categories.list");
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name || "").trim();
    if (!name) return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });

    const result = await adminRpc<unknown>("categories.create", {
      name,
      slug: slugify(name),
      description: body?.description ? String(body.description).trim() : null,
      order: parseInt(String(body?.order ?? 0), 10) || 0,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = String(body?.id || "").trim();
    const name = String(body?.name || "").trim();
    if (!id || !name) {
      return NextResponse.json({ error: "id y nombre son requeridos" }, { status: 400 });
    }

    const result = await adminRpc<unknown>("categories.update", {
      id,
      name,
      slug: slugify(name),
      ...(body?.description !== undefined ? { description: body.description } : {}),
      ...(body?.order !== undefined ? { order: parseInt(String(body.order), 10) || 0 } : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!id) return NextResponse.json({ error: "id es requerido" }, { status: 400 });

    const result = await adminRpc<unknown>("categories.delete", { id });
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
