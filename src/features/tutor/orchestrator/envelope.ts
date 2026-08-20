/**
 * Tutor action envelope (plan §16) — the structured output of every tutor
 * turn. The model fills in language; the orchestrator decides behavior.
 *
 * The envelope is validated twice: provider-native JSON-schema (strict) at
 * generation time, and this structural validator before anything is shown or
 * persisted (defense against provider drift / malformed output → one retry
 * then a friendly fallback, §37).
 */
import { AppError } from "@/lib/errors";
import type { SignalType } from "@/models";

export const INTERACTION_TYPES = [
  "explain",
  "ask",
  "hint",
  "practice",
  "correct",
  "recommend",
  "smalltalk",
  "session_end",
] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

export const QUESTION_TYPES = ["mcq", "free"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface EnvelopeQuestion {
  prompt: string;
  type: QuestionType;
  options: string[];
}

export interface EnvelopeSignal {
  type: SignalType | "none";
  value: number;
}

export interface TutorEnvelope {
  /** Final text shown to the child (already checked by output safety). */
  response: string;
  interaction_type: InteractionType;
  /** Skill code this turn touched ("" when none). */
  skill: string;
  difficulty: number;
  hint_available: boolean;
  requires_action: "question" | "none";
  /** Present whenever requires_action === "question". */
  question?: EnvelopeQuestion;
  hint?: string;
  praise?: boolean;
  learning_signal: EnvelopeSignal;
  completed: boolean;
}

const INTERACTION_SET = new Set<string>(INTERACTION_TYPES);
const SIGNAL_SET = new Set<string>(["answer_correct", "answer_wrong", "hint_used", "concept_seen", "none"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Structural validation of a raw parsed envelope. Returns the typed envelope
 * or throws VALIDATION_ERROR (caller retries once, then falls back).
 */
export function validateEnvelope(raw: unknown): TutorEnvelope {
  if (!isRecord(raw)) {
    throw AppError.validation("Tutor envelope must be an object.");
  }
  if (typeof raw.response !== "string" || raw.response.trim().length === 0) {
    throw AppError.validation("Envelope response is missing or empty.");
  }
  if (typeof raw.interaction_type !== "string" || !INTERACTION_SET.has(raw.interaction_type)) {
    throw AppError.validation("Envelope interaction_type is invalid.");
  }
  if (typeof raw.skill !== "string") {
    throw AppError.validation("Envelope skill must be a string.");
  }
  if (typeof raw.difficulty !== "number" || raw.difficulty < 1 || raw.difficulty > 5) {
    throw AppError.validation("Envelope difficulty must be 1–5.");
  }
  if (typeof raw.hint_available !== "boolean") {
    throw AppError.validation("Envelope hint_available must be a boolean.");
  }
  if (raw.requires_action !== "question" && raw.requires_action !== "none") {
    throw AppError.validation("Envelope requires_action is invalid.");
  }

  const signal = raw.learning_signal;
  let learningSignal: EnvelopeSignal = { type: "none", value: 0 };
  if (isRecord(signal)) {
    if (typeof signal.type !== "string" || !SIGNAL_SET.has(signal.type)) {
      throw AppError.validation("Envelope learning_signal.type is invalid.");
    }
    const value =
      typeof signal.value === "number" && Number.isFinite(signal.value)
        ? Math.min(Math.max(signal.value, 0), 1)
        : 0;
    learningSignal = { type: signal.type as EnvelopeSignal["type"], value };
  }

  let question: EnvelopeQuestion | undefined;
  if (raw.requires_action === "question") {
    if (!isRecord(raw.question)) {
      throw AppError.validation("Envelope question is required when requires_action is question.");
    }
    if (typeof raw.question.prompt !== "string" || raw.question.prompt.trim().length === 0) {
      throw AppError.validation("Envelope question.prompt is required.");
    }
    const qType = raw.question.type;
    if (qType !== "mcq" && qType !== "free") {
      throw AppError.validation("Envelope question.type must be mcq or free.");
    }
    const options = raw.question.options === undefined ? [] : raw.question.options;
    if (!isStringArray(options) || (qType === "mcq" && (options.length < 3 || options.length > 5))) {
      throw AppError.validation("MCQ questions need 3–5 options.");
    }
    question = { prompt: String(raw.question.prompt), type: qType, options };
  }

  return {
    response: raw.response,
    interaction_type: raw.interaction_type as InteractionType,
    skill: raw.skill,
    difficulty: raw.difficulty,
    hint_available: raw.hint_available,
    requires_action: raw.requires_action,
    question,
    hint: typeof raw.hint === "string" && raw.hint.trim() ? raw.hint : undefined,
    praise: typeof raw.praise === "boolean" ? raw.praise : undefined,
    learning_signal: learningSignal,
    completed: raw.completed === true,
  };
}

/** Parses the raw model text into an envelope (JSON.parse + validate). */
export function parseEnvelope(rawText: string): TutorEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw AppError.validation("Tutor output was not valid JSON.");
  }
  return validateEnvelope(parsed);
}