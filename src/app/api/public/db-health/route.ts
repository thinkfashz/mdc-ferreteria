import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function safeHost(value?: string) {
  if (!value) return null;
  try { return new URL(value).hostname || null; } catch { return null; }
}

export async function GET() {
  const selected = process.env.DATABASE_URL
    ? "DATABASE_URL"
    : process.env.POSTGRES_PRISMA_URL
      ? "POSTGRES_PRISMA_URL"
      : process.env.POSTGRES_URL
        ? "POSTGRES_URL"
        : null;

  let prismaOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaOk = true;
  } catch (_) {}

  return NextResponse.json({
    ok: prismaOk,
    selected,
    host: safeHost(process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL),
    env: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      postgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
      postgresUrl: Boolean(process.env.POSTGRES_URL),
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
    },
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
