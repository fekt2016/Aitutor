/**
 * POST /api/v1/auth/register (plan §26)
 *
 * Two flows, validated + typed end-to-end:
 *  1. accountType "parent"  — public parent self-registration (with consent).
 *  2. accountType "student" — parent (authenticated) creates + links a child.
 *
 * Children never self-register (§3); student accounts are parent-managed.
 */
import type { NextRequest } from "next/server";
import { withApiHandler, readJson, created } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { ensureDb } from "@/server/db";
import { requireRole } from "@/lib/authorize";
import {
  UserModel,
  ParentChildModel,
  StudentProfileModel,
  toPublicUser,
  isAgeBand,
  type AgeBand,
} from "@/models";
import { PARENT_ROLE, STUDENT_ROLE, type Role } from "@/features/auth/roles";

const REGISTER_FIELDS = [
  "accountType",
  "name",
  "email",
  "username",
  "password",
  "ageBand",
  "consent",
] as const;

function assertString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw AppError.validation(`"${key}" is required.`);
  }
  return value.trim();
}

/**
 * Validates a password WITHOUT trimming. Passwords may legitimately contain
 * leading/trailing spaces; login compares the raw value, so registration must
 * hash the raw value too (a trim here silently corrupts the user's password).
 */
function assertPassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw AppError.validation('"password" is required.');
  }
  if (value.length < 8) {
    throw AppError.validation("Password must be at least 8 characters.");
  }
  return value;
}

async function createUser(input: {
  name: string;
  email?: string;
  username?: string;
  password: string;
  role: Role;
  ageBand?: AgeBand;
}) {
  return UserModel.create({
    name: input.name,
    email: input.email,
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.role,
    ageBand: input.ageBand,
  });
}

async function registerParent(record: Record<string, unknown>) {
  const name = assertString(record, "name");
  const email = assertString(record, "email");
  const password = assertPassword(record.password);
  if (record.consent !== true) {
    throw AppError.validation(
      "Parental consent is required to create an account (privacy first, plan §19)."
    );
  }

  await ensureDb();
  const user = await createUser({ name, email, password, role: PARENT_ROLE });
  return toPublicUser(user);
}

async function registerStudent(record: Record<string, unknown>, parentId: string) {
  const name = assertString(record, "name");
  const password = assertPassword(record.password);
  const ageBand = assertString(record, "ageBand");

  // A child needs at least one login identity: an email OR a username.
  // (Kids who don't have an email just use a username — plan §26.)
  const emailRaw = typeof record.email === "string" ? record.email.trim() : "";
  const email = emailRaw.length > 0 ? emailRaw : undefined;
  const usernameRaw = typeof record.username === "string" ? record.username.trim() : "";
  const username = usernameRaw.length > 0 ? usernameRaw : undefined;
  if (!email && !username) {
    throw AppError.validation(
      "Provide either an email or a username for the child so they can log in."
    );
  }

  if (!isAgeBand(ageBand)) {
    throw AppError.validation("A valid age band is required (5-6, 7-8, 9-10, 11-12).");
  }

  await ensureDb();

  // Best-effort cleanup if a later step fails (no multi-doc transactions on
  // shared Atlas tiers).
  const user = await createUser({ name, email, username, password, role: STUDENT_ROLE, ageBand });
  try {
    await StudentProfileModel.create({ studentId: user._id, gradeLevelId: null });
    await ParentChildModel.create({ parentId, childId: user._id });
  } catch (error) {
    await UserModel.deleteOne({ _id: user._id }).catch(() => {});
    throw error;
  }
  return toPublicUser(user);
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const record = await readJson(req, {
    allowedFields: [...REGISTER_FIELDS],
  });

  const accountType = record.accountType;
  if (accountType !== "parent" && accountType !== "student") {
    throw AppError.validation('"accountType" must be "parent" or "student".');
  }

  if (accountType === "parent") {
    const user = await registerParent(record);
    return created({ user });
  }

  // Child accounts require an authenticated parent creating them (§3).
  const parent = await requireRole(PARENT_ROLE);
  const user = await registerStudent(record, parent.id);
  return created({ user });
});

export const dynamic = "force-dynamic";
