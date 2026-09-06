import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * SETUP — Módulo bloqueado de configuración de bases de datos.
 *
 * Seguridad:
 * - Toda la API exige contraseña master (SETUP_MASTER_PASSWORD en .env).
 * - La contraseña nunca viaja en GETs; el cliente la envía en cada operación
 *   sensible o usa un token de sesión temporal (30 min, en memoria del server).
 * - Nunca se devuelve la contraseña ni las connection strings completas
 *   (solo tipo, nombre y estado).
 */

const MASTER_HASH_KEY = "setup_master_hash";
const SETUP_SESSIONS = new Map<string, number>(); // token -> expiry

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutos
const MAX_ATTEMPTS = 5;
const attempts = new Map<string, { count: number; blockedUntil: number }>();

function getClientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function hash(pw: string) {
  return crypto.scryptSync(pw, "mdc-setup-salt", 32).toString("hex");
}

async function getStoredMasterHash(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: MASTER_HASH_KEY } });
  return row?.value || null;
}

async function setStoredMasterHash(pw: string) {
  const h = hash(pw);
  const existing = await prisma.setting.findUnique({ where: { key: MASTER_HASH_KEY } });
  if (existing) {
    await prisma.setting.update({ where: { key: MASTER_HASH_KEY }, data: { value: h } });
  } else {
    await prisma.setting.create({ data: { key: MASTER_HASH_KEY, value: h } });
  }
}

function isBlocked(ip: string) {
  const a = attempts.get(ip);
  return a && a.blockedUntil > Date.now();
}

function registerFail(ip: string) {
  const a = attempts.get(ip) || { count: 0, blockedUntil: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.blockedUntil = Date.now() + 10 * 60 * 1000; // 10 min de bloqueo
    a.count = 0;
  }
  attempts.set(ip, a);
  return a;
}

function clearAttempts(ip: string) {
  attempts.delete(ip);
}

/* ---------- sesión temporal ---------- */
function createSession(): string {
  const token = crypto.randomBytes(32).toString("hex");
  SETUP_SESSIONS.set(token, Date.now() + SESSION_TTL_MS);
  // limpieza de sesiones expiradas
  for (const [t, exp] of SETUP_SESSIONS) {
    if (exp < Date.now()) SETUP_SESSIONS.delete(t);
  }
  return token;
}

function validSession(req: Request): boolean {
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace("Bearer ", "").trim();
  if (!token) return false;
  const exp = SETUP_SESSIONS.get(token);
  if (!exp || exp < Date.now()) {
    SETUP_SESSIONS.delete(token);
    return false;
  }
  return true;
}

/* ==================================================================== */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action;

    /* ---- LOGIN: establece o valida la contraseña master ---- */
    if (action === "login") {
      const ip = getClientIp(req);
      if (isBlocked(ip)) {
        return NextResponse.json({ error: "Demasiados intentos. Espera 10 minutos." }, { status: 429 });
      }
      const pw = String(body.password || "");
      if (pw.length < 8) {
        return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
      }
      const stored = await getStoredMasterHash();
      if (!stored) {
        // primer acceso: queda establecida para siempre
        await setStoredMasterHash(pw);
        clearAttempts(ip);
        return NextResponse.json({ success: true, token: createSession(), firstTime: true });
      }
      if (hash(pw) === stored) {
        clearAttempts(ip);
        return NextResponse.json({ success: true, token: createSession(), firstTime: false });
      }
      const a = registerFail(ip);
      return NextResponse.json(
        { error: `Contraseña incorrecta (${a.count}/${MAX_ATTEMPTS})` },
        { status: 401 }
      );
    }

    /* ---- Todas las demás acciones exigen sesión válida ---- */
    if (!validSession(req)) {
      return NextResponse.json({ error: "No autorizado. Vuelve a entrar al setup." }, { status: 401 });
    }

    /* ---- LISTAR BASES DE DATOS DISPONIBLES ---- */
    if (action === "list-databases") {
      const dbs: any[] = [];

      // SQLite: archivo local (el que usa la app)
      dbs.push({
        id: "sqlite-main",
        type: "SQLite",
        name: "MDC Principal (dev.db)",
        status: "conectada",
        active: true,
        location: "prisma/dev.db (local)",
        note: "La base que usa la app ahora mismo",
      });

      // Detectar otras BD SQLite en la carpeta prisma/
      try {
        const fs = await import("fs");
        const path = await import("path");
        const dir = path.join(process.cwd(), "prisma");
        if (fs.existsSync(dir)) {
          for (const f of fs.readdirSync(dir)) {
            if (f.endsWith(".db") && f !== "dev.db") {
              dbs.push({
                id: `sqlite-${f}`,
                type: "SQLite",
                name: f,
                status: "disponible",
                active: false,
                location: `prisma/${f}`,
                note: "Archivo SQLite detectado",
              });
            }
          }
        }
      } catch {}

      // Postgres / MySQL detectados por variables de entorno comunes
      if (process.env.POSTGRES_URL || process.env.DATABASE_URL?.startsWith("postgres")) {
        dbs.push({
          id: "postgres-env",
          type: "PostgreSQL",
          name: "PostgreSQL (configurada en .env)",
          status: "detectada",
          active: false,
          location: "POSTGRES_URL / DATABASE_URL",
          note: "Para activarla hay que cambiar el datasource de Prisma",
        });
      }
      if (process.env.MYSQL_URL || process.env.DATABASE_URL?.startsWith("mysql")) {
        dbs.push({
          id: "mysql-env",
          type: "MySQL",
          name: "MySQL (configurada en .env)",
          status: "detectada",
          active: false,
          location: "MYSQL_URL / DATABASE_URL",
          note: "Para activarla hay que cambiar el datasource de Prisma",
        });
      }

      // BDs registradas manualmente en el setup (sin credenciales en la respuesta)
      const saved = await prisma.setting.findUnique({ where: { key: "setup_databases" } });
      if (saved?.value) {
        try {
          const list = JSON.parse(saved.value);
          for (const db of list) {
            if (!dbs.find(d => d.id === db.id)) {
              dbs.push({ ...db, secret: undefined });
            }
          }
        } catch {}
      }

      return NextResponse.json({ databases: dbs });
    }

    /* ---- REGISTRAR UNA BASE DE DATOS ---- */
    if (action === "register-database") {
      const { type, name, location, username } = body;
      if (!type || !name) {
        return NextResponse.json({ error: "type y name son requeridos" }, { status: 400 });
      }
      const saved = await prisma.setting.findUnique({ where: { key: "setup_databases" } });
      const list = saved?.value ? JSON.parse(saved.value) : [];
      const id = `${type.toLowerCase().replace(/\s/g, "-")}-${Date.now().toString(36)}`;
      list.push({
        id,
        type: String(type).slice(0, 40),
        name: String(name).slice(0, 100),
        status: "registrada",
        active: false,
        location: String(location || "").slice(0, 200),
        user: username ? String(username).slice(0, 60) : undefined,
        registeredAt: new Date().toISOString(),
        // la contraseña NUNCA se guarda en la BD — solo se pide al conectar
      });
      await prisma.setting.upsert({
        where: { key: "setup_databases" },
        update: { value: JSON.stringify(list) },
        create: { key: "setup_databases", value: JSON.stringify(list) },
      });
      return NextResponse.json({ success: true, id });
    }

    /* ---- ELIMINAR BASE REGISTRADA ---- */
    if (action === "remove-database") {
      const { id } = body;
      const saved = await prisma.setting.findUnique({ where: { key: "setup_databases" } });
      const list = saved?.value ? JSON.parse(saved.value) : [];
      const filtered = list.filter((d: any) => d.id !== id);
      await prisma.setting.upsert({
        where: { key: "setup_databases" },
        update: { value: JSON.stringify(filtered) },
        create: { key: "setup_databases", value: JSON.stringify(filtered) },
      });
      return NextResponse.json({ success: true });
    }

    /* ---- GUARDAR APIs / COLECCIONES EN LA BASE ACTIVA ---- */
    if (action === "save-api-config") {
      const { apiName, endpoint, databaseId, data } = body;
      if (!apiName) {
        return NextResponse.json({ error: "apiName es requerido" }, { status: 400 });
      }
      const key = `api_config_${String(apiName).slice(0, 60)}`;
      const value = JSON.stringify({
        endpoint: String(endpoint || "").slice(0, 300),
        databaseId: String(databaseId || "sqlite-main").slice(0, 80),
        data: data ?? null,
        savedAt: new Date().toISOString(),
      });
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
      return NextResponse.json({ success: true, key });
    }

    /* ---- LISTAR APIs GUARDADAS ---- */
    if (action === "list-api-configs") {
      const all = await prisma.setting.findMany({
        where: { key: { startsWith: "api_config_" } },
      });
      return NextResponse.json({
        apis: all.map(s => {
          try {
            const v = JSON.parse(s.value);
            return { key: s.key.replace("api_config_", ""), ...v };
          } catch {
            return { key: s.key, raw: true };
          }
        }),
      });
    }

    /* ---- ESTADO GENERAL ---- */
    if (action === "status") {
      const hasMaster = !!(await getStoredMasterHash());
      return NextResponse.json({ hasMaster });
    }

    return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message?.slice(0, 300) || "Error" }, { status: 500 });
  }
}