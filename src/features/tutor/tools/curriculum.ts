/**
 * Curriculum tools (plan §15) — `get_current_lesson` + `search_curriculum`.
 * Read-only resolvers over the curriculum service/retrieval layers; the
 * orchestrator routes through these so every read is validated, timed and
 * audited under the §15 contract.
 */
import { AppError } from "@/lib/errors";
import type { CurriculumBundle } from "../curriculum/service";
import { resolveSkillForSession } from "../curriculum/service";
import { searchCurriculum, type CurriculumHit } from "../curriculum/retrieval";
import type { TutorTool } from "./types";

export interface LessonToolInput {
  session: Parameters<typeof resolveSkillForSession>[0];
  gradeLevelId: string | null;
}

export interface SearchToolInput {
  query: string;
  subjectId?: string | null;
  skillId?: string | null;
  gradeLevelId?: string | null;
  limit?: number;
}

const MAX_QUERY_CHARS = 300;

function assertQuery(input: SearchToolInput): void {
  if (typeof input.query !== "string" || input.query.trim().length < 2) {
    throw AppError.validation("Curriculum search needs a real query.");
  }
  if (input.query.length > MAX_QUERY_CHARS) {
    // Clamp, don't reject — a long child message is still searchable.
    input.query = input.query.slice(0, MAX_QUERY_CHARS);
  }
}

/** `get_current_lesson` — the grounded skill/objective/lesson for a session. */
export const getCurrentLessonTool: TutorTool<LessonToolInput, CurriculumBundle> = {
  name: "get_current_lesson",
  description:
    "Resolve the current skill, content-standard objective, lesson body and practice items for a tutor session.",
  readOnly: true,
  execute: ({ session, gradeLevelId }) => resolveSkillForSession(session, gradeLevelId),
};

/** `search_curriculum` — hybrid retrieval over the chunk corpus. */
export const searchCurriculumTool: TutorTool<SearchToolInput, CurriculumHit[]> = {
  name: "search_curriculum",
  description:
    "Search the curriculum corpus (lessons, definitions, examples, practice explanations) for supporting material.",
  readOnly: true,
  validate: assertQuery,
  execute: (input) => searchCurriculum(input),
};
