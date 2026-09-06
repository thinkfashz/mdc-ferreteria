import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const movements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(movements);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productId, quantity, type, reason, reference } = body;

    if (!productId || !quantity) {
      return NextResponse.json(
        { error: "Producto y cantidad son requeridos" },
        { status: 400 }
      );
    }

    const movement = await prisma.$transaction(async (tx) => {
      const stockChange = type === "in" ? parseInt(quantity) : -parseInt(quantity);

      const product = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: stockChange } },
        include: { category: true },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          quantity: parseInt(quantity),
          type: type || "in",
          reason,
          reference,
        },
        include: { product: true },
      });

      return movement;
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    console.error("Stock error:", error);
    return NextResponse.json({ error: "Error al registrar stock" }, { status: 500 });
  }
}
