import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { adminGatewayResponse, adminRpc } from "@/lib/supabase-admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await adminRpc<unknown>("products.get", { id });
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const payload: Record<string, unknown> = { id };

    if (body?.name !== undefined) {
      const cleanName = String(body.name || "").trim();
      if (!cleanName) return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
      payload.name = cleanName;
      payload.slug = slugify(cleanName);
    }
    if (body?.description !== undefined) payload.description = body.description ? String(body.description).trim() : null;
    if (body?.brand !== undefined) payload.brand = body.brand ? String(body.brand).trim() : null;
    if (body?.price !== undefined) payload.price = Math.max(0, Number(body.price) || 0);
    if (body?.compareAtPrice !== undefined) {
      payload.compareAtPrice = body.compareAtPrice === "" || body.compareAtPrice == null
        ? null
        : Math.max(0, Number(body.compareAtPrice) || 0);
    }
    if (body?.sku !== undefined) payload.sku = body.sku ? String(body.sku).trim() : null;
    if (body?.barcode !== undefined) payload.barcode = body.barcode ? String(body.barcode).trim() : null;
    if (body?.imageUrl !== undefined) payload.imageUrl = body.imageUrl ? String(body.imageUrl).trim() : null;
    if (body?.categoryId !== undefined) payload.categoryId = body.categoryId || null;
    if (body?.stock !== undefined) payload.stock = Math.max(0, parseInt(String(body.stock), 10) || 0);
    if (body?.minStock !== undefined) payload.minStock = Math.max(0, parseInt(String(body.minStock), 10) || 0);
    if (body?.unit !== undefined) payload.unit = body.unit || "pieza";
    if (body?.active !== undefined) payload.active = Boolean(body.active);
    if (body?.featured !== undefined) payload.featured = Boolean(body.featured);

    const result = await adminRpc<unknown>("products.update", payload);
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await adminRpc<unknown>("products.delete", { id });
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
