import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/crm → clientes con sus órdenes + estadísticas */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    const customers = await prisma.customer.findMany({
      where,
      include: { orders: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    const allOrders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

    const stats = {
      totalCustomers: customers.length,
      totalOrders: allOrders.length,
      newOrders: allOrders.filter(o => o.status === "nuevo").length,
      revenue: allOrders.filter(o => o.status !== "cancelado").reduce((s, o) => s + o.total, 0),
    };

    return NextResponse.json({
      stats,
      orders: allOrders.map(o => ({
        ...o,
        items: JSON.parse(o.items || "[]"),
      })),
      customers: customers.map(c => ({
        ...c,
        ordersCount: c.orders.length,
        totalSpent: c.orders.filter(o => o.status !== "cancelado").reduce((s, o) => s + o.total, 0),
        lastOrder: c.orders[0] ? { number: c.orders[0].number, createdAt: c.orders[0].createdAt, status: c.orders[0].status, total: c.orders[0].total } : null,
        orders: undefined,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500 });
  }
}

/** PATCH /api/crm → actualizar estado de una orden */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { orderId, status } = body;

    const valid = ["nuevo", "confirmado", "preparando", "enviado", "entregado", "cancelado"];
    if (!orderId || !valid.includes(status)) {
      return NextResponse.json({ error: "orderId y status válido requeridos" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500 });
  }
}