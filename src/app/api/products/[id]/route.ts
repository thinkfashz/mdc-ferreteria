import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "@/lib/require-admin";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    return NextResponse.json({ error: "No se pudo consultar el producto" }, { status: 503 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await req.json();
    const {
      name,
      description,
      brand,
      price,
      compareAtPrice,
      sku,
      barcode,
      imageUrl,
      categoryId,
      stock,
      minStock,
      unit,
      active,
      featured,
    } = body;

    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
      data.name = cleanName;
      data.slug = slugify(cleanName);
    }
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (brand !== undefined) data.brand = brand ? String(brand).trim() : null;
    if (price !== undefined) data.price = Math.max(0, Number(price) || 0);
    if (compareAtPrice !== undefined) {
      const nextPrice = Number(price ?? 0) || 0;
      const nextCompare = compareAtPrice === "" || compareAtPrice == null ? null : Math.max(0, Number(compareAtPrice) || 0);
      data.compareAtPrice = nextCompare && nextCompare > nextPrice ? nextCompare : null;
    }
    if (sku !== undefined) data.sku = sku ? String(sku).trim() : null;
    if (barcode !== undefined) data.barcode = barcode ? String(barcode).trim() : null;
    if (imageUrl !== undefined) data.imageUrl = imageUrl ? String(imageUrl).trim() : null;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (stock !== undefined) data.stock = Math.max(0, parseInt(String(stock), 10) || 0);
    if (minStock !== undefined) data.minStock = Math.max(0, parseInt(String(minStock), 10) || 0);
    if (unit !== undefined) data.unit = unit || "pieza";
    if (active !== undefined) data.active = Boolean(active);
    if (featured !== undefined) data.featured = Boolean(featured);

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Error al actualizar producto" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
