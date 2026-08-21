/**
 * GET /api/v1/admin/curriculum/[type]/[id]/grounded — the grounded lesson
 * view for a skill: the exact CurriculumBundle the tutor composes plus the
 * CurriculumChunks retrieval can find. Only `type=skill` is valid.
 */
import { withApiHandler, ok } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/authorize";
import { ensureDb } from "@/server/db";
import { ADMIN_ROLES } from "@/features/auth/roles";
import { getGroundedView } from "@/features/curriculum/admin/service";

export const GET = withApiHandler(async (_req, ctx) => {
  await requireRole(...ADMIN_ROLES);
  await ensureDb();

  const { type, id } = await ctx.params;
  if (type !== "skill" || typeof id !== "string") {
    throw AppError.notFound("Grounded views are available for skills only.");
  }

  return ok(await getGroundedView(id));
});

export const dynamic = "force-dynamic";
