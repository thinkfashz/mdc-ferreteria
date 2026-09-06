import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Stock en vivo para la tienda. GET /api/public/stock?ids=a,b,c
 * Devuelve { [id]: { stock, price, updatedAt } } — liviano para polling.
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
    const idsParam = searchParams.get("ids") || "";
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean).slice(0, 100);

    const where = ids.length ? { id: { in: ids }, active: true } : { active: true };

    const rows = await prisma.product.findMany({
      where,
      select: { id: true, stock: true, price: true, updatedAt: true },
    });

    const map: Record<string, { stock: number; price: number; updatedAt: string }> = {};
    for (const r of rows) {
      map[r.id] = { stock: r.stock, price: r.price, updatedAt: r.updatedAt.toISOString() };
    }

    return NextResponse.json({ stock: map, ts: Date.now() }, {
      headers: {
        ...CORS,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500, headers: CORS });
  }
}