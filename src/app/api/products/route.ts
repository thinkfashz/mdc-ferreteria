import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "12");
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const featured = searchParams.get("featured") || "";

  const where: Record<string, unknown> = { active: true };

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { barcode: { contains: search } },
    ];
  }

  if (category) {
    where.categoryId = category;
  }

  if (featured === "true") {
    where.featured = true;
  }

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, price, sku, barcode, imageUrl, categoryId, stock, minStock, unit, featured } = body;

    if (!name) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }

    const slug = slugify(name);

    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un producto con ese nombre" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description,
        price: parseFloat(price) || 0,
        sku,
        barcode,
        imageUrl,
        categoryId,
        stock: parseInt(stock) || 0,
        minStock: parseInt(minStock) || 0,
        unit: unit || "pieza",
        featured: featured || false,
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
