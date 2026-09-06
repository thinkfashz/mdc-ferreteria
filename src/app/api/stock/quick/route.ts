import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, name, brand, description, imageUrl, category, quantity, type, reason, price } = body;

    const isAiItem = !code && !!name;

    if (!code && !isAiItem) {
      return NextResponse.json({ error: "Código es requerido" }, { status: 400 });
    }

    // Productos identificados por IA: se busca por nombre normalizado para evitar duplicados
    let product = null as any;
    if (code) {
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { barcode: code },
            { sku: code },
          ],
        },
        include: { category: true },
      });
    } else if (name) {
      product = await prisma.product.findFirst({
        where: { name: { contains: name.slice(0, 40) } },
        include: { category: true },
      });
    }

    if (!product) {
      const productName = name || `Producto ${code || "sin codigo"}`;
      const slug = slugify(productName) + "-" + Date.now().toString(36);

      let categoryId: string | undefined;
      if (category) {
        const catSlug = slugify(category);
        let existingCat = await prisma.category.findUnique({ where: { slug: catSlug } });
        if (!existingCat) {
          existingCat = await prisma.category.create({
            data: {
              name: category,
              slug: catSlug,
            },
          });
        }
        categoryId = existingCat.id;
      }

      const parsedPrice = parseFloat(price);
      product = await prisma.product.create({
        data: {
          name: productName,
          slug,
          description: description || `${brand ? brand + " - " : ""}${productName}`,
          barcode: code || null,
          sku: code || null,
          imageUrl: imageUrl || null,
          categoryId: categoryId || null,
          price: !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0,
          stock: 0,
          minStock: 1,
          unit: "pieza",
        },
        include: { category: true },
      });
    }

    const qty = parseInt(quantity) || 1;
    const stockChange = type === "out" ? -qty : qty;

    await prisma.$transaction(async (tx) => {
      await tx.stockMovement.create({
        data: {
          productId: product!.id,
          quantity: qty,
          type: type === "out" ? "out" : "in",
          reason: reason || `Escaneo: ${code || product!.name}`,
          reference: code || null,
        },
      });

      await tx.product.update({
        where: { id: product!.id },
        data: { stock: { increment: stockChange } },
      });

      await tx.inventoryEntry.create({
        data: {
          productId: product!.id,
          quantity: qty,
          type: type === "out" ? "exit" : "entry",
          notes: reason || `Escaneo rápido: ${code || product!.name}`,
        },
      });
    });

    const updatedProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      product: updatedProduct,
      action: type === "out" ? "Salida" : "Entrada",
      quantity: qty,
    });
  } catch (error) {
    console.error("Quick stock error:", error);
    return NextResponse.json(
      { error: "Error al guardar stock" },
      { status: 500 }
    );
  }
}
