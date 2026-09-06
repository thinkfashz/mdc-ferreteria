import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await req.json();
    const { code, name, brand, description, imageUrl, category, quantity, type, reason, price } = body;
    const cleanCode = code ? String(code).trim().slice(0, 160) : "";
    const cleanName = name ? String(name).trim().slice(0, 180) : "";
    const isAiItem = !cleanCode && !!cleanName;
    const qty = Math.floor(Number(quantity || 1));
    const movementType = type === "out" ? "out" : "in";

    if (!cleanCode && !isAiItem) {
      return NextResponse.json({ error: "Código o nombre es requerido" }, { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0 || qty > 9999) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      let product = cleanCode
        ? await tx.product.findFirst({
            where: { OR: [{ barcode: cleanCode }, { sku: cleanCode }] },
            include: { category: true },
          })
        : await tx.product.findFirst({
            where: { name: { contains: cleanName.slice(0, 80), mode: "insensitive" } },
            include: { category: true },
          });

      if (!product) {
        if (movementType === "out") throw new Error("PRODUCT_NOT_FOUND");

        const productName = cleanName || `Producto ${cleanCode || "sin código"}`;
        let categoryId: string | undefined;

        if (category) {
          const categoryName = String(category).trim().slice(0, 100);
          const catSlug = slugify(categoryName);
          const existingCat = await tx.category.upsert({
            where: { slug: catSlug },
            update: { name: categoryName },
            create: { name: categoryName, slug: catSlug },
          });
          categoryId = existingCat.id;
        }

        const parsedPrice = Math.max(0, Number(price) || 0);
        product = await tx.product.create({
          data: {
            name: productName,
            slug: `${slugify(productName)}-${Date.now().toString(36)}`,
            description: description ? String(description).trim().slice(0, 1000) : null,
            brand: brand ? String(brand).trim().slice(0, 120) : null,
            barcode: cleanCode || null,
            sku: cleanCode || null,
            imageUrl: imageUrl ? String(imageUrl).trim().slice(0, 1000) : null,
            categoryId: categoryId || null,
            price: parsedPrice,
            stock: 0,
            minStock: 1,
            unit: "pieza",
          },
          include: { category: true },
        });
      }

      if (movementType === "out" && product.stock < qty) {
        throw new Error(`STOCK_CONFLICT|${product.stock}`);
      }

      const stockChange = movementType === "out" ? -qty : qty;
      const cleanReason = reason
        ? String(reason).trim().slice(0, 500)
        : `Escaneo: ${cleanCode || product.name}`;

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          quantity: stockChange,
          type: movementType,
          reason: cleanReason,
          reference: cleanCode || null,
        },
      });

      await tx.product.update({
        where: { id: product.id },
        data: { stock: { increment: stockChange } },
      });

      await tx.inventoryEntry.create({
        data: {
          productId: product.id,
          quantity: qty,
          type: movementType === "out" ? "exit" : "entry",
          notes: cleanReason,
        },
      });

      const updatedProduct = await tx.product.findUnique({
        where: { id: product.id },
        include: { category: true },
      });

      return { updatedProduct, movementType };
    });

    return NextResponse.json({
      success: true,
      product: result.updatedProduct,
      action: result.movementType === "out" ? "Salida" : "Entrada",
      quantity: qty,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PRODUCT_NOT_FOUND") {
      return NextResponse.json({ error: "No existe un producto para registrar esta salida" }, { status: 404 });
    }
    if (message.startsWith("STOCK_CONFLICT|")) {
      return NextResponse.json(
        { error: `Stock insuficiente. Disponible: ${message.split("|")[1] || 0}` },
        { status: 409 }
      );
    }
    console.error("Quick stock error:", error);
    return NextResponse.json({ error: "Error al guardar stock" }, { status: 500 });
  }
}
