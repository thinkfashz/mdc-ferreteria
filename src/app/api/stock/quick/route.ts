import { NextResponse } from "next/server";
import { slugify } from "@/lib/utils";
import { adminFunctionRpc, adminGatewayResponse } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const code = String(body?.code || "").trim().slice(0, 160);
    const name = String(body?.name || "").trim().slice(0, 180);
    const quantity = Math.floor(Number(body?.quantity || 1));
    const type = body?.type === "out" ? "out" : "in";

    if (!code && !name) {
      return NextResponse.json({ error: "Código o nombre es requerido" }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }

    const productPayload: Record<string, unknown> = {
      code,
      name,
      slug: name ? slugify(name) : "",
      quantity,
      type,
      reason: body?.reason ? String(body.reason).trim().slice(0, 500) : `Scanner: ${code || name}`,
      unit: body?.unit ? String(body.unit).trim().slice(0, 40) : "pieza",
    };

    if (Object.prototype.hasOwnProperty.call(body, "brand")) {
      productPayload.brand = String(body?.brand || "").trim().slice(0, 120);
    }
    if (Object.prototype.hasOwnProperty.call(body, "description")) {
      productPayload.description = String(body?.description || "").trim().slice(0, 1600);
    }
    if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
      productPayload.imageUrl = String(body?.imageUrl || "").trim().slice(0, 1200);
    }
    if (Object.prototype.hasOwnProperty.call(body, "categoryId")) {
      productPayload.categoryId = body?.categoryId ? String(body.categoryId).trim() : "";
    }
    if (body?.price !== undefined && body?.price !== null && body?.price !== "") {
      productPayload.price = Math.max(0, Number(body.price) || 0);
    }

    const result = await adminFunctionRpc<unknown>("mdc_admin_stock_quick", {
      p_payload: productPayload,
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = adminGatewayResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
