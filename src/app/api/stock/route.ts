import { NextResponse } from "next/server";
import { adminGatewayResponse, adminRpc } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const result = await adminRpc<unknown>("stock.list");
    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const productId = String(body?.productId || "").trim();
    const quantity = Math.floor(Number(body?.quantity));
    const type = body?.type === "out" ? "out" : "in";

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json(
        { error: "Producto y cantidad positiva son requeridos" },
        { status: 400 },
      );
    }

    const result = await adminRpc<unknown>("stock.adjust", {
      productId,
      quantity,
      type,
      reason: body?.reason ? String(body.reason).trim().slice(0, 500) : null,
      reference: body?.reference ? String(body.reference).trim().slice(0, 160) : null,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
