/**
 * Grounding augmentation (plan §6.3, §35.4) — when the resolved lesson is
 * thin, retrieve supporting material from the curriculum corpus so the tutor
 * reasons over the knowledge base instead of inventing content. The material
 * is folded into the lesson body BEFORE the memory builder clamps it, so the
 * total curriculum budget (§13) still holds. Never throws: a retrieval
 * problem must not break a child's turn (§37).
 */
import type { CurriculumBundle } from "./service";
import { searchCurriculum, type CurriculumHit } from "./retrieval";

/** Lessons shorter than this get supporting material pulled in. */
export const THIN_LESSON_CHARS = 600;
const MAX_SUPPORT_CHUNKS = 3;
const SUPPORT_HEADING = "\n\nSUPPORTING MATERIAL FROM THE CURRICULUM:";

export function renderSupportingMaterial(hits: CurriculumHit[]): string {
  return hits.map((hit) => `- ${hit.title ? `${hit.title}: ` : ""}${hit.content}`).join("\n");
}

/** Mutates bundle.lessonBody in place when support was found. */
export async function augmentWithSupportingMaterial(
  bundle: CurriculumBundle,
  opts: { subjectId?: string | null; gradeLevelId?: string | null; query?: string } = {}
): Promise<void> {
  if (bundle.lessonBody.length >= THIN_LESSON_CHARS) return;

  try {
    const hits = await searchCurriculum({
      query:
        opts.query ?? `${bundle.skillName} ${bundle.objective} ${bundle.lessonTitle}`.trim(),
      subjectId: opts.subjectId ?? null,
      skillId: bundle.skillId,
      gradeLevelId: opts.gradeLevelId ?? null,
      limit: MAX_SUPPORT_CHUNKS,
    });
    if (hits.length === 0) return;
    bundle.lessonBody = `${bundle.lessonBody}${SUPPORT_HEADING}\n${renderSupportingMaterial(hits)}`;
  } catch {
    // Lesson body stands alone — never break a turn over retrieval (§37).
  }
}
