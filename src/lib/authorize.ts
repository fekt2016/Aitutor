/**
 * Authorization helpers (plan §3, §28).
 *
 * Hard invariant: a student can never access another student's data.
 * Every data query must be scoped by `studentId` from the session; these
 * helpers centralize the checks so the rule can't be bypassed in a route.
 *
 * Pure decision logic (assertRole, isParentOf, isOwnerOf) is unit-tested
 * without a database; DB-backed wrappers resolve links from Mongo.
 */
import { auth } from "@/features/auth/nextauth";
import { ParentChildModel } from "@/models";
import { AppError } from "./errors";
import { ADMIN_ROLES, type Role } from "@/features/auth/roles";

export interface SessionUser {
  id: string;
  role: Role;
  name: string;
  email: string;
  superAdmin: boolean;
}

export interface ParentChildLink {
  parentId: string;
  childId: string;
}

/* ------------------------------------------------------------------ */
/* Pure decision logic (unit-testable, no I/O)                         */
/* ------------------------------------------------------------------ */

export function assertRole(user: SessionUser, allowed: readonly Role[]): SessionUser {
  if (!allowed.includes(user.role)) {
    throw AppError.forbidden("You do not have permission to do that.");
  }
  return user;
}

export function isAdminUser(user: SessionUser): boolean {
  return ADMIN_ROLES.includes(user.role) || user.superAdmin;
}

/** A parent may act for a student only if a link exists between them. */
export function isParentOfLinks(
  parentId: string,
  studentId: string,
  links: ParentChildLink[]
): boolean {
  return links.some((link) => link.parentId === parentId && link.childId === studentId);
}

/** Owner check: the student themselves, an admin, or a linked parent. */
export function isOwnerOf(user: SessionUser, studentId: string, links: ParentChildLink[]): boolean {
  if (user.role === "student") return user.id === studentId;
  if (isAdminUser(user)) return true;
  if (user.role === "parent") return isParentOfLinks(user.id, studentId, links);
  return false;
}

/* ------------------------------------------------------------------ */
/* DB-backed wrappers (used by route handlers)                         */
/* ------------------------------------------------------------------ */

/**
 * Returns the authenticated user from the JWT session cookie,
 * or throws 401. Call at the top of every protected handler.
 */
export async function getSessionUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (!user?.id) {
    throw AppError.unauthorized();
  }
  return user;
}

/** Resolves the parent↔child links for a parent user. */
export async function getParentChildLinks(parentId: string): Promise<ParentChildLink[]> {
  const links = await ParentChildModel.find({ parentId }).select("parentId childId").lean();
  return links.map((link) => ({
    parentId: link.parentId.toString(),
    childId: link.childId.toString(),
  }));
}

/**
 * requireRole(...roles) — session + role gate for a handler.
 * Throws 401 (no session) or 403 (wrong role).
 */
export async function requireRole(...allowed: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  return assertRole(user, allowed);
}

/**
 * requireParentOf — the authenticated user must be the parent of
 * `studentId` (or an admin/superadmin auditing).
 */
export async function requireParentOf(user: SessionUser, studentId: string): Promise<void> {
  if (isAdminUser(user)) return;
  if (user.role !== "parent") {
    throw AppError.forbidden("Only a parent can access a child's data.");
  }
  const links = await getParentChildLinks(user.id);
  if (!isParentOfLinks(user.id, studentId, links)) {
    throw AppError.forbidden("You can only access your own children's data.");
  }
}

/**
 * requireOwner — the authenticated user must be the student themself,
 * a linked parent, or an admin. Use for session/progress endpoints.
 */
export async function requireOwner(user: SessionUser, studentId: string): Promise<void> {
  if (user.role === "student" && user.id === studentId) return;
  if (isAdminUser(user)) return;
  if (user.role === "parent") {
    const links = await getParentChildLinks(user.id);
    if (isParentOfLinks(user.id, studentId, links)) return;
  }
  throw AppError.forbidden("You can only access your own data.");
}
