import { handlers } from "@/features/auth/nextauth";

// NextAuth.js own endpoints (/api/auth/*) — session, csrf, signin, etc.
export const { GET, POST } = handlers;
