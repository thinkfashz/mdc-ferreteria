import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [totalProducts, totalCategories, lowStockProducts, inventoryAgg] =
      await Promise.all([
        prisma.product.count({ where: { active: true } }),
        prisma.category.count(),
        prisma.product.count({
          where: { active: true, stock: { lte: prisma.product.fields?.minStock ?? 0 } },
        }).catch(() =>
          prisma.$queryRaw`SELECT COUNT(*) as count FROM Product WHERE active = 1 AND stock <= minStock`
            .then((r: unknown) => {
              const rows = r as { count: bigint }[];
              return Number(rows[0]?.count ?? 0);
            })
        ),
        prisma.product.aggregate({ _sum: { stock: true }, where: { active: true } }),
      ]);

    const stats = {
      totalProducts,
      totalCategories,
      lowStockProducts: typeof lowStockProducts === "number" ? lowStockProducts : 0,
      totalInventory: inventoryAgg._sum.stock || 0,
    };

    const lowStock = await prisma.product.findMany({
      where: { active: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
    });

    return NextResponse.json({ stats, lowStock });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { stats: { totalProducts: 0, totalCategories: 0, lowStockProducts: 0, totalInventory: 0 }, lowStock: [] }
    );
  }
}
