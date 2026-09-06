import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function databaseUnavailableResponse() {
  return NextResponse.json(
    {
      error: "El inventario en vivo está temporalmente fuera de servicio.",
      code: "DATABASE_UNAVAILABLE",
    },
    { status: 503, headers: CORS }
  );
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL) return databaseUnavailableResponse();

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "100", 10)));
    const search = (searchParams.get("search") || "").trim();
    const cat = (searchParams.get("cat") || "").trim();
    const id = (searchParams.get("id") || "").trim();

    const where: Record<string, unknown> = { active: true };
    if (id) where.OR = [{ id }, { slug: id }, { sku: id }];

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (cat) where.category = { slug: cat };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json(
      {
        products: data.map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description || "",
          brand: p.brand || "",
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          stock: p.stock,
          minStock: p.minStock,
          unit: p.unit,
          sku: p.sku || "",
          barcode: p.barcode || "",
          imageUrl: p.imageUrl || "",
          featured: p.featured,
          updatedAt: p.updatedAt,
          category: p.category ? { name: p.category.name, slug: p.category.slug } : null,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        source: "database",
      },
      { headers: CORS }
    );
  } catch (err: unknown) {
    console.error("Public catalog error:", err);
    const message = err instanceof Error ? err.message : String(err ?? "");

    if (/database|postgres|connector|environment variable|datasource/i.test(message)) {
      return databaseUnavailableResponse();
    }

    return NextResponse.json(
      { error: "No pudimos consultar el inventario en este momento.", code: "CATALOG_ERROR" },
      { status: 500, headers: CORS }
    );
  }
}
