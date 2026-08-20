/**
 * NextAuth v5 config (plan §28, §33) — credentials provider + JWT in an
 * httpOnly cookie. The JWT carries `id`, `role`, `superAdmin`; sessions are
 * stateless (no DB adapter). Roles/permissions helpers live in lib/authorize.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { User } from "next-auth";
import { UserModel } from "@/models";
import { verifyPassword } from "@/lib/password";
import { ensureDb } from "@/server/db";
import type { Role } from "@/features/auth/roles";

export interface AuthUserRecord extends User {
  role: Role;
  superAdmin: boolean;
}

/**
 * Authenticates credentials against the DB. `identifier` is a username OR an
 * email (both are normalized to lowercase for matching). Exported for tests
 * (model can be mocked); the provider's authorize() wraps it.
 */
export async function verifyCredentials(
  identifier: string,
  password: string
): Promise<AuthUserRecord | null> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized || !password) return null;

  await ensureDb();
  const user = await UserModel.findOne({
    $or: [{ email: normalized }, { username: normalized }],
    active: true,
  }).lean();
  if (!user) return null;

  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) return null;

  return {
    id: (user as unknown as { _id: { toString(): string } })._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    superAdmin: (user.superAdmin ?? false) as boolean,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        return verifyCredentials(email, password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AuthUserRecord;
        token.id = authUser.id;
        token.role = authUser.role;
        token.superAdmin = authUser.superAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.superAdmin = (token.superAdmin as boolean) ?? false;
      }
      return session;
    },
  },
});
