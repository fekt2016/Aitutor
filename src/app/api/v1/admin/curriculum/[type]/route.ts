/**
 * POST /api/v1/admin/curriculum/[type] — create a curriculum resource.
 * `type` ∈ strand | substrand | standard | skill | lesson | item (registry).
 * Field whitelist per type; Mongoose strict mode + validators do the rest.
 * Content writes re-index the owning skill's chunks so retrieval stays
 * consistent with what admins edit.
 */
import { withApiHandler, created, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { requireRole } from "@/lib/authorize";
import { ensureDb } from "@/server/db";
import { ADMIN_ROLES } from "@/features/auth/roles";
import {
  CURRICULUM_RESOURCES,
  isCurriculumResourceType,
  skillIdForReindex,
} from "@/features/curriculum/admin/registry";
import { reindexSkillChunks } from "@/features/tutor/curriculum/chunker";

export const POST = withApiHandler(async (req, ctx) => {
  await requireRole(...ADMIN_ROLES);
  await ensureDb();

  const { type } = await ctx.params;
  if (typeof type !== "string" || !isCurriculumResourceType(type)) {
    throw AppError.notFound("Unknown curriculum resource.");
  }
  const def = CURRICULUM_RESOURCES[type];

  const body = await readJson(req, { allowedFields: [...def.editableFields] });
  const missing = def.requiredOnCreate.filter(
    (field) =>
      body[field] === undefined ||
      body[field] === null ||
      (typeof body[field] === "string" && !(body[field] as string).trim())
  );
  if (missing.length > 0) {
    throw AppError.validation(`Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`, {
      missing,
    });
  }

  const doc = await def.model.create(body);

  const reindexSkillId = skillIdForReindex(type, doc.toObject());
  if (reindexSkillId) {
    await reindexSkillChunks(reindexSkillId).catch(() => {});
  }

  return created({ [type]: serializeDoc(doc.toObject()) });
});

function serializeDoc(doc: Record<string, unknown>): Record<string, unknown> {
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

export const dynamic = "force-dynamic";
