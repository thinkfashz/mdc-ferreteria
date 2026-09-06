import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const movements = await prisma.stockMovement.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(movements);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { productId, quantity, type, reason, reference } = body;
    const qty = Math.floor(Number(quantity));
    const movementType = type === "out" ? "out" : "in";

    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Producto y cantidad positiva son requeridos" },
        { status: 400 }
      );
    }

    const movement = await prisma.$transaction(async (tx) => {
      const current = await tx.product.findUnique({ where: { id: productId } });
      if (!current) throw new Error("PRODUCT_NOT_FOUND");
      if (movementType === "out" && current.stock < qty) {
        throw new Error(`STOCK_CONFLICT|${current.stock}`);
      }

      const stockChange = movementType === "in" ? qty : -qty;
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: stockChange } },
      });

      return tx.stockMovement.create({
        data: {
          productId,
          quantity: stockChange,
          type: movementType,
          reason: reason ? String(reason).trim().slice(0, 500) : null,
          reference: reference ? String(reference).trim().slice(0, 160) : null,
        },
        include: { product: true },
      });
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }
    if (message.startsWith("STOCK_CONFLICT|")) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${message.split("|")[1] || 0}` },
        { status: 409 }
      );
    }
    console.error("Stock error:", error);
    return NextResponse.json({ error: "Error al registrar stock" }, { status: 500 });
  }
}
