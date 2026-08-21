/**
 * Memory Builder (plan §13) — composes a FIXED-BUDGET context block per turn.
 * Never unbounded history: short-term ≤6 messages, session summary (~1 short
 * paragraph), long-term highlights (≤3 mastery lines), curriculum chunk
 * (≤ ~1200 tokens / 4800 chars). Older turns are dropped, not summarized,
 * for MVP (async summarization arrives in Phase 4).
 */
import type { TutorMessage } from "@/models";
import { studentContextPrompt, curriculumContextPrompt, type StudentContext, type CurriculumContext } from "../prompts/templates";

export const SHORT_TERM_MESSAGE_LIMIT = 6;
export const CURRICULUM_CHAR_LIMIT = 4800; // ≈1200 tokens
const SINGLE_MESSAGE_CHAR_LIMIT = 600;

export interface MemoryTurn {
  role: "user" | "assistant";
  text: string;
}

/** Last N assistant+user exchanges only (never system/tool rows). */
export function recentTurns(messages: TutorMessage[], limit = SHORT_TERM_MESSAGE_LIMIT): MemoryTurn[] {
  const turns: MemoryTurn[] = [];
  for (let i = messages.length - 1; i >= 0 && turns.length < limit; i -= 1) {
    const message = messages[i];
    if (message.role !== "user" && message.role !== "assistant") continue;
    const text = typeof message.content === "string" ? message.content : JSON.stringify(message.content);
    if (!text || text.trim().length === 0) continue;
    turns.push({
      role: message.role as "user" | "assistant",
      text: text.length > SINGLE_MESSAGE_CHAR_LIMIT ? `${text.slice(0, SINGLE_MESSAGE_CHAR_LIMIT)}…` : text,
    });
  }
  return turns.reverse();
}

/** Compiles the short-term conversation block. */
export function buildConversationBlock(turns: MemoryTurn[]): string {
  if (turns.length === 0) return "CONVERSATION: (none yet — this is the start of the session.)";
  const lines = turns.map((turn) => `${turn.role === "user" ? "STUDENT" : "EAZI"}: ${turn.text}`);
  return `RECENT CONVERSATION:\n${lines.join("\n")}`;
}

export interface LongTermHighlights {
  lines: string[];
}

/** Long-term learning block — mastery highlights, never raw transcripts (§13). */
export function buildLongTermBlock(highlights: LongTermHighlights): string {
  if (highlights.lines.length === 0) return "LONG-TERM: no prior mastery data.";
  return `LONG-TERM LEARNING (from the student's progress records):\n${highlights.lines.slice(0, 3).join("\n")}`;
}

/** One assembled, ordered, budgeted context bundle for a tutor turn. */
export interface ContextBundle {
  student: string;
  curriculum: string;
  conversation: string;
  longTerm: string;
}

export function buildContextBundle(input: {
  student: StudentContext;
  curriculum: CurriculumContext;
  turns: MemoryTurn[];
  highlights: LongTermHighlights;
}): ContextBundle {
  return {
    student: studentContextPrompt(input.student),
    curriculum: clampCurriculum(input.curriculum),
    conversation: buildConversationBlock(input.turns),
    longTerm: buildLongTermBlock(input.highlights),
  };
}

function clampCurriculum(curriculum: CurriculumContext): string {
  let body = curriculum.lessonBody ?? "";
  if (body.length > CURRICULUM_CHAR_LIMIT) {
    // Keep the head (definitions/examples) — lessons are written head-first.
    body = `${body.slice(0, CURRICULUM_CHAR_LIMIT)}\n…(lesson continues)`;
  }
  return curriculumContextPrompt({ ...curriculum, lessonBody: body });
}