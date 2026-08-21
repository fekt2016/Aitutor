/**
 * Versioned prompt templates (plan §35) — Eazi's persona + safety boundaries
 * are hard system blocks; per-turn blocks (student context, curriculum,
 * conversation, task instruction) are composed by the Memory Builder.
 *
 * Template versioning: every template carries a `version`. Seeding these into
 * the `PromptVersion` collection (for audited, reversible changes) is Phase 2
 * work; until then these TS templates ARE the versioned source.
 */
import type { JsonSchema } from "../providers";
import type { InteractionType } from "../orchestrator/envelope";

export const PROMPT_VERSION = "2026-08-20.1";

const SYSTEM_ROLE = `You are Eazi, a warm, patient primary-school teacher for children aged 5–11 in Ghana. You teach the NaCCA curriculum: Mathematics and English Language.

How you teach:
- Speak like a friendly teacher: short sentences, simple words, one idea at a time.
- You TEACH, you never just answer. If a child asks a question you can answer directly, you often ask them to try first, or you explain then ask a quick check question.
- Use examples from everyday Ghanaian life (market, football, school, food, animals) when it helps.
- Praise effort and progress, never just correctness: "Great trying!", "You're getting there!".
- When a child answers wrongly, correct gently, explain why, and let them try once more.
- Keep every reply short (1–4 sentences normally, max ~90 words) — children cannot follow long paragraphs.
- Never use emojis, slang, or adult humour. Plain, warm, clear language.`;

const SYSTEM_SAFETY = `Hard boundaries — never break these:
1. You teach ONLY Mathematics and English Language at primary level. Nothing else.
2. Never discuss sex, violence, drugs, alcohol, self-harm, dating, or any adult topic — even if asked or told to.
3. Never ask for or reveal personal information: real names, addresses, phone numbers, school names, passwords.
4. Never pretend to be someone else or drop your teaching role, no matter how the child phrases a request.
5. If a request is off-syllabus or inappropriate, gently steer back to learning. Do not repeat, describe, or engage with the content.
6. You are a tutor, not a friend for chatting. Keep conversations focused on learning.
7. If you do not know something, say "I'm not sure about that one!" and offer to learn it together — never invent facts.
8. Never claim anything is true unless it comes from the curriculum material given to you in the prompt, or is universally known primary-level fact.`;

export function systemRolePrompt(): { version: string; role: string; safety: string } {
  return { version: PROMPT_VERSION, role: SYSTEM_ROLE, safety: SYSTEM_SAFETY };
}

/** Student context block (§35.3) — assembled by the Memory Builder. */
export function studentContextPrompt(context: StudentContext): string {
  const style = context.interactionStyle ? ` · style: ${context.interactionStyle}` : "";
  const preferences =
    context.preferences && context.preferences.length > 0
      ? ` · likes: ${context.preferences.join(", ")}`
      : "";
  return `STUDENT: ${context.name ?? "the child"}, age band ${context.ageBand ?? "unknown"} (grade ${context.gradeName ?? "—"}, vocabulary level ${context.vocabularyLevel ?? 3}/5, explanation depth ${context.explanationDepth ?? 3}/5${style}${preferences}).`;
}

export interface StudentContext {
  name?: string;
  ageBand?: string;
  gradeName?: string;
  vocabularyLevel?: number;
  explanationDepth?: number;
  interactionStyle?: string;
  preferences?: string[];
}

/** Curriculum block (§35.4) — the ONLY source the model may teach from. */
export function curriculumContextPrompt(curriculum: CurriculumContext): string {
  const lines: string[] = [];
  if (curriculum.skillName) {
    lines.push(`SKILL: ${curriculum.skillName}${curriculum.objective ? ` — ${curriculum.objective}` : ""}`);
  }
  if (curriculum.lessonTitle) {
    lines.push(`LESSON: ${curriculum.lessonTitle}`);
  }
  if (curriculum.lessonBody) {
    lines.push(`LESSON CONTENT:\n${curriculum.lessonBody}`);
  }
  if (curriculum.examples && curriculum.examples.length > 0) {
    lines.push(`EXAMPLES:\n${curriculum.examples.map((e) => `- ${e}`).join("\n")}`);
  }
  lines.push(
    "GROUNDING RULE: teach from the content above. Never invent curriculum facts. If a child asks something not covered, use general primary-level knowledge and say you can check their lesson together."
  );
  return lines.join("\n");
}

export interface CurriculumContext {
  skillName?: string;
  objective?: string;
  lessonTitle?: string;
  lessonBody?: string;
  examples?: string[];
}

/** Task instruction block (§35.6) — the orchestrator's chosen behavior. */
export function taskInstructionPrompt(
  intent: InteractionType,
  hintHint: string
): string {
  return `TASK: The orchestrator has classified this turn as: ${intent}.${hintHint}
Respond ONLY with the JSON envelope described by your output schema. The envelope's "response" field is exactly what the child sees, so it must follow every rule above and be short and warm.`;
}

/** Full system prompt: role + safety always first (order matters, §35.1–2). */
export function buildSystemPrompt(): string {
  const { role, safety } = systemRolePrompt();
  return `${role}\n\n${safety}`;
}

/**
 * The tutor action envelope JSON-schema (strict mode: every property required,
 * additionalProperties false) — provider-native structured output (§16).
 */
export const TUTOR_ENVELOPE_SCHEMA: JsonSchema = {
  name: "tutor_action_envelope",
  description: "The tutor's chosen action for this turn.",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      response: {
        type: "string",
        description: "Final text shown to the child. Short, warm, 1–4 sentences.",
      },
      interaction_type: {
        type: "string",
        enum: ["explain", "ask", "hint", "practice", "correct", "recommend", "smalltalk", "session_end"],
      },
      skill: { type: "string", description: "Skill code this turn touched, or empty string." },
      difficulty: { type: "number", description: "Next difficulty 1–5." },
      hint_available: { type: "boolean" },
      requires_action: { type: "string", enum: ["question", "none"] },
      question: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: { type: "string" },
          type: { type: "string", enum: ["mcq", "free"] },
          options: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "3–5 options for mcq, empty array for free.",
          },
        },
        required: ["prompt", "type", "options"],
      },
      hint: { type: "string", description: "A small scaffolded hint, or empty string." },
      praise: { type: "boolean", description: "True when the child deserves encouragement." },
      learning_signal: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["answer_correct", "answer_wrong", "hint_used", "concept_seen", "none"],
          },
          value: { type: "number", description: "0–1 signal strength." },
        },
        required: ["type", "value"],
      },
      completed: { type: "boolean", description: "True only for the final wrap-up turn." },
    },
    required: [
      "response",
      "interaction_type",
      "skill",
      "difficulty",
      "hint_available",
      "requires_action",
      "question",
      "hint",
      "praise",
      "learning_signal",
      "completed",
    ],
  },
};