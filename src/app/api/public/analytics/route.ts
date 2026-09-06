import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store, max-age=0",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ ok: false, code: "ANALYTICS_UNAVAILABLE" }, { status: 503, headers: CORS });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event = String(body?.event || "pageview").trim().slice(0, 60);
    const path = String(body?.path || "/").trim().slice(0, 300);
    const sessionId = body?.sessionId ? String(body.sessionId).trim().slice(0, 80) : null;
    const referrer = body?.referrer ? String(body.referrer).trim().slice(0, 500) : null;
    const metadata = body?.metadata && typeof body.metadata === "object"
      ? JSON.stringify(body.metadata).slice(0, 3000)
      : null;

    if (!/^[a-z0-9:_-]{1,60}$/i.test(event) || !path.startsWith("/")) {
      return NextResponse.json({ ok: false, error: "Evento inválido" }, { status: 400, headers: CORS });
    }

    await prisma.siteEvent.create({
      data: { event, path, sessionId, referrer, metadata },
    });

    return NextResponse.json({ ok: true }, { headers: CORS });
  } catch (error) {
    console.error("Analytics event error:", error);
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS });
  }
}
