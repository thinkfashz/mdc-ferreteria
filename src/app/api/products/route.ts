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

  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (category) where.categoryId = category;
  if (featured === "true") where.featured = true;

  try {
    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { updatedAt: "desc" },
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
  } catch (error) {
    console.error("List products error:", error);
    return NextResponse.json({ error: "No se pudo consultar el catálogo" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
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
      featured,
    } = body;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }

    const slug = slugify(cleanName);
    const existing = await prisma.product.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un producto con ese nombre" }, { status: 400 });
    }

    const parsedPrice = Math.max(0, Number(price) || 0);
    const parsedCompareAt = compareAtPrice === "" || compareAtPrice == null
      ? null
      : Math.max(0, Number(compareAtPrice) || 0);

    const product = await prisma.product.create({
      data: {
        name: cleanName,
        slug,
        description: description ? String(description).trim() : null,
        brand: brand ? String(brand).trim() : null,
        price: parsedPrice,
        compareAtPrice: parsedCompareAt && parsedCompareAt > parsedPrice ? parsedCompareAt : null,
        sku: sku ? String(sku).trim() : null,
        barcode: barcode ? String(barcode).trim() : null,
        imageUrl: imageUrl ? String(imageUrl).trim() : null,
        categoryId: categoryId || null,
        stock: Math.max(0, parseInt(String(stock ?? 0), 10) || 0),
        minStock: Math.max(0, parseInt(String(minStock ?? 0), 10) || 0),
        unit: unit || "pieza",
        featured: Boolean(featured),
      },
      include: { category: true },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Error al crear producto" }, { status: 500 });
  }
}
