import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { adminGatewayResponse, adminRpc } from "@/lib/supabase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const result = await adminRpc<unknown>("products.list", {
      page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
      pageSize: Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "12", 10) || 12)),
      search: searchParams.get("search") || "",
      category: searchParams.get("category") || "",
      featured: searchParams.get("featured") || "",
    });
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cleanName = String(body?.name || "").trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }

    const price = Math.max(0, Number(body?.price) || 0);
    const compareAtPrice = body?.compareAtPrice === "" || body?.compareAtPrice == null
      ? null
      : Math.max(0, Number(body.compareAtPrice) || 0);

    const result = await adminRpc<unknown>("products.create", {
      name: cleanName,
      slug: slugify(cleanName),
      description: body?.description ? String(body.description).trim() : null,
      brand: body?.brand ? String(body.brand).trim() : null,
      price,
      compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
      sku: body?.sku ? String(body.sku).trim() : null,
      barcode: body?.barcode ? String(body.barcode).trim() : null,
      imageUrl: body?.imageUrl ? String(body.imageUrl).trim() : null,
      categoryId: body?.categoryId || null,
      stock: Math.max(0, parseInt(String(body?.stock ?? 0), 10) || 0),
      minStock: Math.max(0, parseInt(String(body?.minStock ?? 0), 10) || 0),
      unit: body?.unit || "pieza",
      active: body?.active !== false,
      featured: Boolean(body?.featured),
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
