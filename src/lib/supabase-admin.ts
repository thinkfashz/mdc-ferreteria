import { auth } from "@/lib/auth";
import { callMdcRpc } from "@/lib/supabase-public";

export class AdminGatewayError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "AdminGatewayError";
    this.status = status;
  }
}

type AdminSessionShape = {
  user?: { role?: string } | null;
  adminToken?: string | null;
};

export async function adminRpc<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const session = (await auth()) as AdminSessionShape | null;

  if (!session?.user) {
    throw new AdminGatewayError("No autorizado", 401);
  }
  if (session.user.role !== "admin") {
    throw new AdminGatewayError("Permisos insuficientes", 403);
  }

  const token = String(session.adminToken || "").trim();
  if (!token) {
    throw new AdminGatewayError("La sesión administrativa debe renovarse", 401);
  }

  try {
    return await callMdcRpc<T>("mdc_admin_rpc", {
      p_token: token,
      p_action: action,
      p_payload: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error administrativo";
    if (message.includes("ADMIN_SESSION_INVALID")) {
      throw new AdminGatewayError("La sesión administrativa expiró. Inicia sesión nuevamente.", 401);
    }
    if (message.includes("ADMIN_VALIDATION")) {
      throw new AdminGatewayError(message.replace(/^.*ADMIN_VALIDATION:\s*/, ""), 400);
    }
    if (message.includes("ADMIN_NOT_FOUND")) {
      throw new AdminGatewayError(message.replace(/^.*ADMIN_NOT_FOUND:\s*/, ""), 404);
    }
    if (message.includes("ADMIN_CONFLICT")) {
      throw new AdminGatewayError(message.replace(/^.*ADMIN_CONFLICT:\s*/, ""), 409);
    }
    if (message.includes("ADMIN_STOCK")) {
      throw new AdminGatewayError(message.replace(/^.*ADMIN_STOCK:\s*/, ""), 409);
    }
    throw new AdminGatewayError("No se pudo completar la operación administrativa", 503);
  }
}

export function adminGatewayResponse(error: unknown) {
  if (error instanceof AdminGatewayError) {
    return { status: error.status, body: { error: error.message } };
  }

  console.error("Admin gateway error:", error);
  return { status: 500, body: { error: "Error interno del servidor" } };
}
