/**
 * GET /api/v1/admin/curriculum/tree — full taxonomy for the admin editor
 * (subjects → strands → substrands → standards → skills) plus grade levels
 * for form dropdowns. Admin-only (§3).
 */
import { withApiHandler, ok } from "@/lib/api";
import { requireRole } from "@/lib/authorize";
import { ensureDb } from "@/server/db";
import { ADMIN_ROLES } from "@/features/auth/roles";
import { getCurriculumTree } from "@/features/curriculum/admin/service";

export const GET = withApiHandler(async () => {
  await requireRole(...ADMIN_ROLES);
  await ensureDb();
  return ok(await getCurriculumTree());
});

export const dynamic = "force-dynamic";
