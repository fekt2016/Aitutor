/**
 * PATCH + DELETE /api/v1/admin/curriculum/[type]/[id] — update / delete a
 * curriculum resource (registry-driven; see features/curriculum/admin/registry).
 *
 * Delete policy: content rows (skill/lesson/item) soft-delete via active:false;
 * taxonomy nodes hard-delete only when childless. Content writes re-index the
 * owning skill's CurriculumChunks.
 */
import { withApiHandler, ok, readJson } from "@/lib/api";
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

type Ctx = { params: Promise<Record<string, string | string[]>> };

async function resolveTarget(reqCtx: Ctx) {
  const { type, id } = await reqCtx.params;
  if (typeof type !== "string" || !isCurriculumResourceType(type)) {
    throw AppError.notFound("Unknown curriculum resource.");
  }
  if (typeof id !== "string") {
    throw AppError.notFound("Unknown curriculum resource.");
  }
  return { type, id, def: CURRICULUM_RESOURCES[type] };
}

export const PATCH = withApiHandler(async (req, ctx) => {
  await requireRole(...ADMIN_ROLES);
  await ensureDb();

  const { type, id, def } = await resolveTarget(ctx);
  const body = await readJson(req, { allowedFields: [...def.editableFields] });
  if (Object.keys(body).length === 0) {
    throw AppError.validation("Nothing to update.");
  }

  const doc = await def.model.findById(id);
  if (!doc) throw AppError.notFound("That record does not exist.");

  doc.set(body);
  const saved = await doc.save(); // runs schema validators on the full doc

  const reindexSkillId = skillIdForReindex(type, saved.toObject());
  if (reindexSkillId) {
    await reindexSkillChunks(reindexSkillId).catch(() => {});
  }

  return ok({ [type]: { id: String(saved._id) }, updated: true });
});

export const DELETE = withApiHandler(async (_req, ctx) => {
  await requireRole(...ADMIN_ROLES);
  await ensureDb();

  const { type, id, def } = await resolveTarget(ctx);

  const doc = await def.model.findById(id);
  if (!doc) throw AppError.notFound("That record does not exist.");

  if (def.softDelete) {
    doc.set({ active: false });
    await doc.save();
  } else {
    if (def.childGuard) {
      const children = await def.childGuard.model.countDocuments({
        [def.childGuard.field]: id,
      });
      if (children > 0) {
        throw AppError.conflict(
          `Remove the ${def.childGuard.label} under it first.`
        );
      }
    }
    await doc.deleteOne();
  }

  const reindexSkillId = skillIdForReindex(type, doc.toObject());
  if (reindexSkillId) {
    await reindexSkillChunks(reindexSkillId).catch(() => {});
  }

  return ok({ deleted: true, [type]: { id } });
});

export const dynamic = "force-dynamic";
