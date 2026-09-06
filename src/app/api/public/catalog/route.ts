import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * API pública para la tienda (landing). Solo productos activos.
 * GET /api/public/catalog?page=1&pageSize=12&search=&cat=<slug>&id=<productId>
 * Incluye stock y datos completos. CORS abierto para la tienda en :3002.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "100")));
    const search = searchParams.get("search") || "";
    const cat = searchParams.get("cat") || "";
    const id = searchParams.get("id") || "";

    const where: Record<string, unknown> = { active: true };

    if (id) where.id = id;

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
      ];
    }

    if (cat) {
      where.category = { slug: cat };
    }

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
          brand: (p as any).brand || "",
          price: p.price,
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
      },
      { headers: CORS }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500, headers: CORS });
  }
}