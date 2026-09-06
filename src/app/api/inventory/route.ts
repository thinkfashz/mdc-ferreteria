import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const entries = await prisma.inventoryEntry.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity, type, notes } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: "Producto y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const entry = await prisma.$transaction(async (tx) => {
      const inventoryEntry = await tx.inventoryEntry.create({
        data: {
          productId,
          quantity: parseInt(quantity),
          type: type || "entry",
          notes,
        },
        include: { product: true },
      });

      const stockChange = type === "entry" ? parseInt(quantity) : -parseInt(quantity);

      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: stockChange } },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          quantity: parseInt(quantity),
          type: type === "entry" ? "in" : "out",
          reason: notes,
        },
      });

      return inventoryEntry;
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Inventory error:", error);
    return NextResponse.json({ error: "Error al registrar inventario" }, { status: 500 });
  }
}
