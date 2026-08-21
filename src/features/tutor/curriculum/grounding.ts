/**
 * Grounding augmentation (plan §6.3, §35.4) — folds supporting material from
 * the curriculum corpus into the lesson body BEFORE the memory builder clamps
 * it, so the total curriculum budget (§13) still holds. The tutor then reasons
 * over the knowledge base instead of inventing content.
 *
 * Turn policy (one retrieval per turn, via the §15 tool layer):
 * - thin lesson (< THIN_LESSON_CHARS): query from skill context (§6.3(3));
 * - full lesson + a substantive child question: query from the question so
 *   specific asks ("what is a numerator?") pull the right support.
 * Never throws: a retrieval problem must not break a child's turn (§37).
 */
import type { CurriculumBundle } from "./service";
import { searchCurriculumTool } from "../tools/curriculum";
import { runTool } from "../tools/types";
import type { CurriculumHit } from "./retrieval";

/** Lessons shorter than this get supporting material pulled in. */
export const THIN_LESSON_CHARS = 600;
/** Questions shorter than this rarely name a retrievable concept. */
const MIN_QUESTION_CHARS = 8;
const MAX_SUPPORT_CHUNKS = 3;
/** Marker folded into lessonBody when supporting material was appended. */
export const SUPPORT_MARKER = "\n\nSUPPORTING MATERIAL FROM THE CURRICULUM:";

export function renderSupportingMaterial(hits: CurriculumHit[]): string {
  return hits.map((hit) => `- ${hit.title ? `${hit.title}: ` : ""}${hit.content}`).join("\n");
}

/** Mutates bundle.lessonBody in place when support was found. */
export async function augmentWithSupportingMaterial(
  bundle: CurriculumBundle,
  opts: {
    userMessage?: string;
    subjectId?: string | null;
    gradeLevelId?: string | null;
  } = {}
): Promise<void> {
  const thin = bundle.lessonBody.length < THIN_LESSON_CHARS;
  const question = opts.userMessage?.trim() ?? "";
  if (!thin && question.length < MIN_QUESTION_CHARS) return;

  const query = thin
    ? `${bundle.skillName} ${bundle.objective} ${bundle.lessonTitle}`.trim()
    : `${question} ${bundle.skillName}`.trim();

  const outcome = await runTool(searchCurriculumTool, {
    query,
    subjectId: opts.subjectId ?? null,
    skillId: bundle.skillId,
    gradeLevelId: opts.gradeLevelId ?? null,
    limit: MAX_SUPPORT_CHUNKS,
  });
  const hits = outcome.ok ? (outcome.data ?? []) : [];
  if (hits.length === 0) return;

  bundle.lessonBody = `${bundle.lessonBody}${SUPPORT_MARKER}\n${renderSupportingMaterial(hits)}`;
}
