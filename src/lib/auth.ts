import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { callMdcRpc } from "@/lib/supabase-public";

type AdminUser = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
};

function hasDirectDatabase() {
  return Boolean(
    process.env.DATABASE_URL?.trim() ||
      process.env.POSTGRES_PRISMA_URL?.trim() ||
      process.env.POSTGRES_URL?.trim(),
  );
}

async function findAdmin(email: string, password: string): Promise<AdminUser | null> {
  if (hasDirectDatabase()) {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.role === "admin" && (await bcrypt.compare(password, user.password))) {
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      }
    } catch (error) {
      console.warn("Prisma auth no disponible; usando Supabase RPC.", error instanceof Error ? error.message : "error");
    }
  }

  try {
    const rows = await callMdcRpc<AdminUser[]>("mdc_admin_verify", {
      p_email: email,
      p_password: password,
    });
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (error) {
    console.error("Supabase admin auth error:", error instanceof Error ? error.message : "error");
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const user = await findAdmin(email, password);
        if (!user) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = (user as { role?: string }).role;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
  },
});
