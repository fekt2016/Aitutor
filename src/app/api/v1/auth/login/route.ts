/**
 * POST /api/v1/auth/login (plan §26) — credentials login.
 * Sets the httpOnly JWT session cookie via NextAuth and returns the envelope.
 * Generic error message on bad credentials (never hints which field failed).
 */
import type { NextRequest } from "next/server";
import { AuthError } from "next-auth";
import { withApiHandler, readJson, ok } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { signIn } from "@/features/auth/nextauth";

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await readJson(req, { allowedFields: ["email", "password"] });

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    throw AppError.validation("Email and password are required.");
  }

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      throw AppError.unauthorized("Email or password is incorrect.");
    }
    throw error;
  }

  return ok({ signedIn: true });
});

export const dynamic = "force-dynamic";
