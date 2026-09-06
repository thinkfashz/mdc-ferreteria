import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { proxyPublicEdge } from "@/lib/mdc-public-edge";

/**
 * Stock en vivo para la tienda. GET /api/public/stock?ids=a,b,c
 * Acepta referencias por id, slug o SKU y devuelve aliases para que el
 * storefront pueda conservar una identidad pública estable.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL) return proxyPublicEdge("stock", req);

  try {
    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get("ids") || "";
    const refs = idsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);

    const where = refs.length
      ? {
          active: true,
          OR: [
            { id: { in: refs } },
            { slug: { in: refs } },
            { sku: { in: refs } },
          ],
        }
      : { active: true };

    const rows = await prisma.product.findMany({
      where,
      select: {
        id: true,
        slug: true,
        sku: true,
        stock: true,
        price: true,
        updatedAt: true,
      },
    });

    const map: Record<string, { stock: number; price: number; updatedAt: string }> = {};
    for (const r of rows) {
      const payload = {
        stock: r.stock,
        price: r.price,
        updatedAt: r.updatedAt.toISOString(),
      };
      map[r.id] = payload;
      map[r.slug] = payload;
      if (r.sku) map[r.sku] = payload;
    }

    return NextResponse.json(
      { stock: map, ts: Date.now(), source: "database" },
      { headers: CORS }
    );
  } catch (err: unknown) {
    console.error("Public stock error:", err);
    const message = err instanceof Error ? err.message : String(err ?? "");
    if (/database|postgres|connector|environment variable|datasource|connection/i.test(message)) {
      return proxyPublicEdge("stock", req);
    }

    return NextResponse.json(
      { error: "No pudimos consultar el stock en este momento.", code: "STOCK_ERROR" },
      { status: 500, headers: CORS }
    );
  }
}
