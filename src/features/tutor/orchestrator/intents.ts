/**
 * Deterministic intent hints (plan §10.1) — a cheap, offline first pass that
 * suggests the interaction type to the model. The model fills in the
 * language; these rules keep behavior predictable and unit-testable.
 * The envelope call remains authoritative (the model may refine the intent
 * from conversation context).
 */
import type { InteractionType } from "./envelope";

const HINT_KEYWORDS =
  /\b(hint|hints|help me|help please|im stuck|i'm stuck|i dont know|i don't know|i am stuck|give me a clue|clue|too hard|confusing)\b/i;

const GREETING_KEYWORDS =
  /^\s*(hi|hello|hey|good (morning|afternoon|evening)|how are you|yo|hallo|hie|hola|salaam|akwaaba)\b/i;

const THANKS_KEYWORDS = /\b(thank|thanks|ty)\b/i;
const BYE_KEYWORDS = /\b(bye|goodbye|see you|good night|goodnight)\b/i;

export interface IntentHintInput {
  /** The student's current message (lowercased for matching). */
  message: string;
  /** Whether the previous assistant turn asked the student a question. */
  lastTurnAskedQuestion: boolean;
  /** Number of assistant turns so far (0 = brand-new session). */
  turnCount: number;
}

export type IntentHint = InteractionType | null;

/**
 * Returns the suggested intent, or null when the model should decide freely.
 */
export function suggestIntent(input: IntentHintInput): IntentHint {
  const text = input.message.trim().toLowerCase();

  if (HINT_KEYWORDS.test(text)) return "hint";
  if (GREETING_KEYWORDS.test(text) && input.turnCount === 0) return "smalltalk";
  if (BYE_KEYWORDS.test(text)) return "session_end";
  if (THANKS_KEYWORDS.test(text)) return "smalltalk";

  // The student just answered the tutor's question → grade it.
  if (input.lastTurnAskedQuestion && input.turnCount > 0) {
    return "practice";
  }

  // Anything else in a live session is an explanation/learning request.
  if (input.turnCount > 0) return "explain";
  return null;
}