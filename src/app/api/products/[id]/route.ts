import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(product);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, price, sku, barcode, imageUrl, categoryId, stock, minStock, unit, active, featured } = body;

    const data: Record<string, unknown> = {};

    if (name) {
      data.name = name;
      data.slug = slugify(name);
    }
    if (description !== undefined) data.description = description;
    if (price !== undefined) data.price = parseFloat(price);
    if (sku !== undefined) data.sku = sku;
    if (barcode !== undefined) data.barcode = barcode;
    if (imageUrl !== undefined) data.imageUrl = imageUrl;
    if (categoryId !== undefined) data.categoryId = categoryId || null;
    if (stock !== undefined) data.stock = parseInt(stock);
    if (minStock !== undefined) data.minStock = parseInt(minStock);
    if (unit !== undefined) data.unit = unit;
    if (active !== undefined) data.active = active;
    if (featured !== undefined) data.featured = featured;

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
  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar producto" }, { status: 500 });
  }
}
