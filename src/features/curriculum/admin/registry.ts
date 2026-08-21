/**
 * Curriculum admin resource registry (plan §27, Phase 2 taxonomy CRUD).
 *
 * One declarative table drives all six curriculum resources so the routes
 * stay thin and every type gets identical auth/validation/delete semantics.
 *
 * Safety model:
 * - Editable fields are whitelisted per type (route passes them to readJson);
 *   Mongoose strict mode then rejects anything the schema doesn't know.
 * - Taxonomy nodes (strand/substrand/standard) HARD-delete only when they
 *   have no children — no orphans, ever.
 * - Content rows (skill/lesson/item) SOFT-delete (active:false) so sessions,
 *   mastery history and chunks keep their references.
 * - Any write touching a skill's content re-indexes that skill's
 *   CurriculumChunks so retrieval stays in sync with what admins edit.
 */
import type { Model } from "mongoose";
import {
  ContentStandardModel,
  LessonModel,
  PracticeItemModel,
  SkillModel,
  StrandModel,
  SubStrandModel,
} from "@/models";

export const CURRICULUM_RESOURCE_TYPES = [
  "strand",
  "substrand",
  "standard",
  "skill",
  "lesson",
  "item",
] as const;

export type CurriculumResourceType = (typeof CURRICULUM_RESOURCE_TYPES)[number];

export function isCurriculumResourceType(value: string): value is CurriculumResourceType {
  return (CURRICULUM_RESOURCE_TYPES as readonly string[]).includes(value);
}

export interface CurriculumResourceDef {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  /** Fields an admin may write — everything else is rejected before the model. */
  editableFields: readonly string[];
  /** Fields that must be present (non-empty) on create; updates are partial. */
  requiredOnCreate: readonly string[];
  /** true → soft delete via active:false; false → guarded hard delete. */
  softDelete: boolean;
  /** Hard-delete guard: model + foreign key that must be empty first. */
  childGuard?: {
    model: { countDocuments(filter: Record<string, unknown>): Promise<number> };
    field: string;
    label: string;
  };
}

export const CURRICULUM_RESOURCES: Record<CurriculumResourceType, CurriculumResourceDef> = {
  strand: {
    model: StrandModel,
    editableFields: ["subjectId", "name", "sortOrder"],
    requiredOnCreate: ["subjectId", "name"],
    softDelete: false,
    childGuard: { model: SubStrandModel, field: "strandId", label: "sub-strands" },
  },
  substrand: {
    model: SubStrandModel,
    editableFields: ["strandId", "name", "sortOrder"],
    requiredOnCreate: ["strandId", "name"],
    softDelete: false,
    childGuard: { model: ContentStandardModel, field: "substrandId", label: "content standards" },
  },
  standard: {
    model: ContentStandardModel,
    editableFields: ["code", "substrandId", "gradeLevelId", "objective", "exemplars"],
    requiredOnCreate: ["code", "substrandId", "gradeLevelId", "objective"],
    softDelete: false,
    childGuard: { model: SkillModel, field: "contentStandardId", label: "skills" },
  },
  skill: {
    model: SkillModel,
    editableFields: [
      "contentStandardId",
      "code",
      "name",
      "description",
      "defaultDifficulty",
      "requiresSkillId",
      "active",
    ],
    requiredOnCreate: ["contentStandardId", "code", "name"],
    softDelete: true,
  },
  lesson: {
    model: LessonModel,
    editableFields: ["skillId", "title", "markdownBody", "examples", "sortOrder", "active"],
    requiredOnCreate: ["skillId", "title", "markdownBody"],
    softDelete: true,
  },
  item: {
    model: PracticeItemModel,
    editableFields: [
      "skillId",
      "type",
      "prompt",
      "options",
      "answer",
      "explanation",
      "difficulty",
      "active",
    ],
    requiredOnCreate: ["skillId", "type", "prompt", "answer", "difficulty"],
    softDelete: true,
  },
};

/**
 * Resource types whose documents carry (directly or via skillId) retrievable
 * content — writes to them trigger a chunk reindex for the owning skill.
 */
export function skillIdForReindex(
  type: CurriculumResourceType,
  doc: Record<string, unknown>
): string | null {
  if (type === "skill") return typeof doc._id !== "undefined" ? String(doc._id) : null;
  if (type === "lesson" || type === "item") {
    const skillId = doc.skillId;
    return skillId ? String(skillId) : null;
  }
  return null;
}
