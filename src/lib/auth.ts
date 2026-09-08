import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { callMdcRpc } from "@/lib/supabase-public";

type AdminLogin = {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  token: string;
  expiresAt: string;
};

async function findAdmin(email: string, password: string): Promise<AdminLogin | null> {
  try {
    const rows = await callMdcRpc<AdminLogin[]>("mdc_admin_login", {
      p_email: email,
      p_password: password,
    });
    return Array.isArray(rows) && rows[0]?.token ? rows[0] : null;
  } catch (error) {
    console.error("Supabase admin login error:", error instanceof Error ? error.message : "error");
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
          adminToken: user.token,
          adminTokenExpiresAt: user.expiresAt,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const admin = user as {
          role?: string;
          adminToken?: string;
          adminTokenExpiresAt?: string;
        };
        token.role = admin.role;
        token.adminToken = admin.adminToken;
        token.adminTokenExpiresAt = admin.adminTokenExpiresAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { id?: string }).id = token.sub;
      }
      const adminSession = session as typeof session & {
        adminToken?: string;
        adminTokenExpiresAt?: string;
      };
      adminSession.adminToken = token.adminToken as string | undefined;
      adminSession.adminTokenExpiresAt = token.adminTokenExpiresAt as string | undefined;
      return adminSession;
    },
  },
});
