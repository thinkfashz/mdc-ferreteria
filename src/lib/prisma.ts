import { PrismaClient } from "@prisma/client";

/*
 * Los proyectos creados/conectados desde Supabase en Vercel Marketplace
 * sincronizan POSTGRES_PRISMA_URL / POSTGRES_URL. Prisma, en cambio, está
 * configurado con DATABASE_URL en schema.prisma. Normalizamos la variable
 * antes de construir el cliente para que admin, Auth y APIs usen la misma
 * base PostgreSQL de Supabase sin duplicar credenciales.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    "";
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
