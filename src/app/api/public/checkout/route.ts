import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
};

class StockConflictError extends Error {
  productName: string;
  available: number;

  constructor(productName: string, available: number) {
    super(`Stock insuficiente de ${productName}`);
    this.name = "StockConflictError";
    this.productName = productName;
    this.available = available;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function isPersistenceUnavailableError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /database_url|environment variable|connectorerror|datasource|postgres|connection/i.test(message);
}

function persistenceUnavailableResponse() {
  return NextResponse.json(
    {
      error: "El registro automático de pedidos está temporalmente fuera de servicio.",
      code: "PERSISTENCE_UNAVAILABLE",
    },
    { status: 503, headers: CORS }
  );
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) return persistenceUnavailableResponse();

  try {
    const body = await req.json();
    const { name, phone, email, address, city, notes, items } = body;

    const cleanName = typeof name === "string" ? name.trim().slice(0, 120) : "";
    const cleanPhone = typeof phone === "string" ? phone.trim().slice(0, 30) : "";
    const cleanEmail = typeof email === "string" && email.trim()
      ? email.trim().toLowerCase().slice(0, 180)
      : null;

    if (cleanName.length < 2) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400, headers: CORS });
    }
    if (!/^[+0-9\s\-()]{8,20}$/.test(cleanPhone)) {
      return NextResponse.json({ error: "Teléfono válido es requerido" }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400, headers: CORS });
    }
    if (items.length > 100) {
      return NextResponse.json({ error: "El pedido contiene demasiadas líneas" }, { status: 400, headers: CORS });
    }

    const requested = items.map((item: { id?: unknown; qty?: unknown; name?: unknown }) => ({
      ref: String(item?.id || "").trim().slice(0, 160),
      qty: Math.min(999, Math.max(1, parseInt(String(item?.qty ?? 1), 10) || 1)),
      clientName: String(item?.name || "").trim().slice(0, 160),
    }));

    if (requested.some((item) => !item.ref)) {
      return NextResponse.json({ error: "Hay un producto sin referencia válida" }, { status: 400, headers: CORS });
    }

    const cleanAddress = address ? String(address).trim().slice(0, 250) : null;
    const cleanCity = city ? String(city).trim().slice(0, 100) : "Linares";
    const cleanNotes = notes ? String(notes).trim().slice(0, 1000) : null;
    const refs = [...new Set(requested.map((item) => item.ref))];

    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          active: true,
          OR: [
            { id: { in: refs } },
            { slug: { in: refs } },
            { sku: { in: refs } },
          ],
        },
      });

      const resolved = new Map<string, { product: (typeof products)[number]; qty: number }>();

      for (const item of requested) {
        const product = products.find((p) => p.id === item.ref || p.slug === item.ref || p.sku === item.ref);
        if (!product) throw new Error(`PRODUCT_NOT_FOUND|${item.clientName || item.ref}`);
        const existing = resolved.get(product.id);
        if (existing) existing.qty += item.qty;
        else resolved.set(product.id, { product, qty: item.qty });
      }

      const orderItems: { id: string; slug: string; name: string; price: number; qty: number }[] = [];
      let total = 0;

      for (const { product, qty } of resolved.values()) {
        if (qty > product.stock) throw new StockConflictError(product.name, product.stock);
        orderItems.push({ id: product.id, slug: product.slug, name: product.name, price: product.price, qty });
        total += product.price * qty;
      }

      let customer = await tx.customer.findFirst({
        where: cleanEmail
          ? { OR: [{ phone: cleanPhone }, { email: cleanEmail }] }
          : { phone: cleanPhone },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail,
            address: cleanAddress,
            city: cleanCity,
          },
        });
      } else {
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            name: cleanName,
            phone: cleanPhone,
            email: cleanEmail || customer.email,
            address: cleanAddress || customer.address,
            city: cleanCity || customer.city,
          },
        });
      }

      for (const { product, qty } of resolved.values()) {
        const updated = await tx.product.updateMany({
          where: { id: product.id, active: true, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (updated.count !== 1) throw new StockConflictError(product.name, product.stock);
      }

      const order = await tx.order.create({
        data: {
          customerId: customer.id,
          total,
          items: JSON.stringify(orderItems),
          notes: cleanNotes,
          source: "web",
          status: "nuevo",
        },
      });

      await tx.stockMovement.createMany({
        data: [...resolved.values()].map(({ product, qty }) => ({
          productId: product.id,
          quantity: -qty,
          type: "out",
          reason: "Pedido web",
          reference: `pedido:${order.number}`,
        })),
      });

      return { order, customer, total };
    });

    return NextResponse.json(
      {
        success: true,
        orderNumber: result.order.number,
        total: result.total,
        customer: { id: result.customer.id, name: result.customer.name },
      },
      { headers: CORS }
    );
  } catch (err: unknown) {
    console.error("Public checkout error:", err);

    if (err instanceof StockConflictError) {
      return NextResponse.json(
        { error: `Stock insuficiente de "${err.productName}" (disponible: ${err.available})`, code: "STOCK_CONFLICT" },
        { status: 409, headers: CORS }
      );
    }

    const message = err instanceof Error ? err.message : String(err ?? "");
    if (message.startsWith("PRODUCT_NOT_FOUND|")) {
      return NextResponse.json(
        { error: `Producto no disponible: ${message.split("|").slice(1).join("|")}`, code: "PRODUCT_NOT_FOUND" },
        { status: 400, headers: CORS }
      );
    }

    if (isPersistenceUnavailableError(err)) return persistenceUnavailableResponse();

    return NextResponse.json(
      {
        error: "No pudimos registrar el pedido. Intenta nuevamente o confírmalo por WhatsApp.",
        code: "CHECKOUT_ERROR",
      },
      { status: 500, headers: CORS }
    );
  }
}
