import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

/**
 * Checkout público desde la tienda:
 * POST { name, phone, email?, address?, city?, notes?, items: [{id, qty}] }
 * - Crea/reusa el cliente por teléfono o email (CRM)
 * - Valida stock y calcula total con precios reales de la BD
 * - Crea la orden y la deja en el dashboard
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone, email, address, city, notes, items } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400, headers: CORS });
    }
    if (!phone || !/^[+0-9\s\-()]{8,20}$/.test(String(phone))) {
      return NextResponse.json({ error: "Teléfono válido es requerido" }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "El carrito está vacío" }, { status: 400, headers: CORS });
    }

    // Validar productos y stock contra la BD (nunca confiar en precios del cliente)
    const ids = items.map((i: any) => String(i.id));
    const products = await prisma.product.findMany({
      where: { id: { in: ids }, active: true },
    });

    const orderItems: { id: string; name: string; price: number; qty: number }[] = [];
    let total = 0;

    for (const it of items) {
      const p = products.find(x => x.id === String(it.id));
      if (!p) {
        return NextResponse.json({ error: `Producto no disponible: ${it.name || it.id}` }, { status: 400, headers: CORS });
      }
      const qty = Math.max(1, parseInt(it.qty) || 1);
      if (qty > p.stock) {
        return NextResponse.json(
          { error: `Stock insuficiente de "${p.name}" (disponible: ${p.stock})` },
          { status: 409, headers: CORS }
        );
      }
      orderItems.push({ id: p.id, name: p.name, price: p.price, qty });
      total += p.price * qty;
    }

    // CRM: crear o reutilizar cliente
    const cleanPhone = String(phone).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : null;

    let customer = await prisma.customer.findFirst({
      where: cleanEmail
        ? { OR: [{ phone: cleanPhone }, { email: cleanEmail }] }
        : { phone: cleanPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: String(name).trim(),
          phone: cleanPhone,
          email: cleanEmail,
          address: address ? String(address).trim() : null,
          city: city ? String(city).trim() : "Linares",
        },
      });
    } else {
      // mantener datos de contacto al día
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: String(name).trim(),
          email: cleanEmail || customer.email,
          address: address ? String(address).trim() : customer.address,
          city: city ? String(city).trim() : customer.city,
        },
      });
    }

    // Número de orden secuencial
    const lastOrder = await prisma.order.findFirst({ orderBy: { number: "desc" } });
    const number = (lastOrder?.number || 0) + 1;

    const order = await prisma.order.create({
      data: {
        number,
        customerId: customer.id,
        total,
        items: JSON.stringify(orderItems),
        notes: notes ? String(notes).slice(0, 1000) : null,
        source: "web",
        status: "nuevo",
      },
    });

    return NextResponse.json(
      {
        success: true,
        orderNumber: order.number,
        total,
        customer: { id: customer.id, name: customer.name },
      },
      { headers: CORS }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500, headers: CORS });
  }
}