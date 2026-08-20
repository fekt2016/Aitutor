/**
 * Output safety (plan §18.5–18.6) — deterministic checks on every assistant
 * response BEFORE it streams to the child. The provider moderation call runs
 * on the assembled text; these local checks are the always-on belt:
 *
 * 1. Empty/refused output → fallback.
 * 2. Length cap (short replies are better for 5–11 year-olds).
 * 3. Forbidden-topic leak check (response must not drift into adult topics).
 */
import type { ModerationResult } from "../providers";
import { classifyInput } from "./keywords";
import { UNSAFE_OUTPUT_FALLBACK } from "./deflections";

export const MAX_RESPONSE_CHARS = 1600;

export interface OutputCheck {
  safe: boolean;
  reason?: string;
}

export function checkAssistantOutput(text: string, moderation: ModerationResult): OutputCheck {
  if (!text || text.trim().length === 0) {
    return { safe: false, reason: "empty" };
  }
  if (text.length > MAX_RESPONSE_CHARS) {
    return { safe: false, reason: "too_long" };
  }
  if (moderation.flagged) {
    return { safe: false, reason: `moderation:${moderation.categories.join(",")}` };
  }
  // Deterministic leak check on the final text (belt over the API call).
  const leak = classifyInput(text);
  if (leak.flagged) {
    return { safe: false, reason: `leak:${leak.categories.join(",")}` };
  }
  return { safe: true };
}

/** The child-safe replacement text for a failed output check. */
export function fallbackFor(reason: string): string {
  return reason.startsWith("too_long") ? truncateSafe(UNSAFE_OUTPUT_FALLBACK) : UNSAFE_OUTPUT_FALLBACK;
}

function truncateSafe(text: string): string {
  return text.slice(0, 200);
}