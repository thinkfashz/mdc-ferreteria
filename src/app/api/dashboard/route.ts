import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalProducts, totalCategories, inventoryRows, inventoryAgg, newOrders] = await Promise.all([
      prisma.product.count({ where: { active: true } }),
      prisma.category.count(),
      prisma.product.findMany({
        where: { active: true },
        select: { stock: true, minStock: true },
      }),
      prisma.product.aggregate({ _sum: { stock: true }, where: { active: true } }),
      prisma.order.count({ where: { status: "nuevo" } }),
    ]);

    let pageviews7d = 0;
    let visitors7d = 0;

    try {
      const [pageviews, visitors] = await Promise.all([
        prisma.siteEvent.count({
          where: { event: "pageview", createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.siteEvent.findMany({
          where: {
            event: "pageview",
            createdAt: { gte: sevenDaysAgo },
            sessionId: { not: null },
          },
          select: { sessionId: true },
          distinct: ["sessionId"],
        }),
      ]);
      pageviews7d = pageviews;
      visitors7d = visitors.length;
    } catch (error) {
      console.warn("Site analytics unavailable:", error);
    }

    const stats = {
      totalProducts,
      totalCategories,
      lowStockProducts: inventoryRows.filter((p) => p.stock <= p.minStock).length,
      totalInventory: inventoryAgg._sum.stock || 0,
      pageviews7d,
      visitors7d,
      newOrders,
    };

    const lowStock = await prisma.product.findMany({
      where: { active: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
    });

    return NextResponse.json({ stats, lowStock });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json({
      stats: {
        totalProducts: 0,
        totalCategories: 0,
        lowStockProducts: 0,
        totalInventory: 0,
        pageviews7d: 0,
        visitors7d: 0,
        newOrders: 0,
      },
      lowStock: [],
    });
  }
}
