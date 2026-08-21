/**
 * Moderation service (plan §18.2) — combines the deterministic local
 * classifier with the provider Moderation API. Fail-closed: if the API is
 * unreachable, the local verdict still stands and the turn is blocked when
 * flagged. Every flagged verdict persists a SafetyEvent (no content, ids
 * only). Never logs message content.
 */
import { AppError } from "@/lib/errors";
import { SafetyEventModel } from "@/models";
import type { AiProvider } from "../providers";
import { classifyInput, type SafetyCategory } from "./keywords";

export interface ModerationVerdict {
  flagged: boolean;
  categories: SafetyCategory[];
  source: "local" | "provider" | "both";
}

interface ModerationInput {
  text: string;
  studentId?: string | null;
  sessionId?: string | null;
}

/**
 * Runs BOTH classifiers. Local result alone can block (fast path); provider
 * result is authoritative when it flags. Unifies OpenAI categories onto the
 * SafetyCategory set (unknown provider categories pass through verbatim).
 */
export async function moderateInput(
  provider: AiProvider,
  input: ModerationInput,
  kind: "input_moderation" | "output_moderation" = "input_moderation"
): Promise<ModerationVerdict> {
  const local = classifyInput(input.text);
  if (local.flagged) {
    await recordEvent(kind, local.categories, "local_flagged", input);
    return { flagged: true, categories: local.categories, source: "local" };
  }

  const providerResult = await provider.moderate({ text: input.text });
  if (providerResult.flagged) {
    const categories = providerResult.categories as SafetyCategory[];
    await recordEvent(kind, categories, "provider_flagged", input);
    return { flagged: true, categories, source: "provider" };
  }

  return { flagged: false, categories: [], source: "provider" };
}

async function recordEvent(
  kind: "input_moderation" | "output_moderation",
  categories: string[],
  verdict: string,
  input: ModerationInput
): Promise<void> {
  try {
    await SafetyEventModel.create({
      studentId: input.studentId ?? null,
      sessionId: input.sessionId ?? null,
      kind,
      categories,
      verdict,
      detail: `len=${input.text.length}`,
    });
  } catch (error) {
    // Safety logging must never break the request; report only.
    console.error("[safety] failed to persist SafetyEvent", {
      name: error instanceof Error ? error.name : typeof error,
    });
  }
}

/** Short-circuit guard for obvious abuse (empty/garbage spam). */
export function assertReasonableMessage(text: string): void {
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 500) {
    throw AppError.validation("Messages must be between 1 and 500 characters.");
  }
  // A single char (or repeated gibberish) is not a learning turn.
  if (trimmed.length === 1 || /^(.)\1{4,}$/.test(trimmed)) {
    throw AppError.validation("Please write a real message so I can help you learn.");
  }
}