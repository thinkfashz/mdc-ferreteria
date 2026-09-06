import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const entries = await prisma.inventoryEntry.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json(entries);
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { productId, quantity, type, notes } = body;
    const qty = Math.floor(Number(quantity));
    const movementType = type === "entry" ? "entry" : "exit";

    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json(
        { error: "Producto y cantidad positiva son requeridos" },
        { status: 400 }
      );
    }

    const entry = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) throw new Error("PRODUCT_NOT_FOUND");
      if (movementType === "exit" && product.stock < qty) {
        throw new Error(`STOCK_CONFLICT|${product.stock}`);
      }

      const inventoryEntry = await tx.inventoryEntry.create({
        data: {
          productId,
          quantity: qty,
          type: movementType,
          notes: notes ? String(notes).trim().slice(0, 500) : null,
        },
        include: { product: true },
      });

      const stockChange = movementType === "entry" ? qty : -qty;
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: stockChange } },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          quantity: stockChange,
          type: movementType === "entry" ? "in" : "out",
          reason: notes ? String(notes).trim().slice(0, 500) : null,
        },
      });

      return inventoryEntry;
    });

    return NextResponse.json(entry, { status: 201 });
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
    console.error("Inventory error:", error);
    return NextResponse.json({ error: "Error al registrar inventario" }, { status: 500 });
  }
}
