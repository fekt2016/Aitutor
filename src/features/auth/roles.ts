/**
 * Roles — scoped + hierarchical (plan §3). A user has exactly one `role`;
 * capabilities are derived from role + relations (e.g. parentOf), never
 * from multiple role fields.
 */

export const ROLES = ["superadmin", "admin", "teacher", "parent", "student"] as const;

export type Role = (typeof ROLES)[number];

export const PARENT_ROLE: Role = "parent";
export const STUDENT_ROLE: Role = "student";

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Roles that may access admin surfaces. */
export const ADMIN_ROLES: readonly Role[] = ["superadmin", "admin"];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}
