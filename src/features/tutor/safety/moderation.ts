/**
 * Moderation service (plan §18.2) — combines the deterministic local
 * classifier with the provider Moderation API. If the provider endpoint is
 * unavailable (429/outage), THE LOCAL VERDICT STANDS: locally-flagged input
 * still blocks, benign input proceeds through the remaining independent
 * layers (prompt restrictions, output moderation, output validation).
 * Unavailability is recorded as a SafetyEvent and a short cooldown stops
 * every turn from paying the failing round-trip. Never logs message content.
 */
import { AppError } from "@/lib/errors";
import { SafetyEventModel } from "@/models";
import type { AiProvider } from "../providers";
import { ModerationUnavailableError } from "../providers/types";
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

/** After a provider failure, skip the provider layer for this long. */
const PROVIDER_COOLDOWN_MS = 60_000;
let providerCooldownUntil = 0;

/** Test hook — clears the provider cooldown between tests. */
export function resetModerationCooldown(): void {
  providerCooldownUntil = 0;
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

  // Provider layer — skipped while cooling down after an outage/429.
  if (Date.now() >= providerCooldownUntil) {
    try {
      const providerResult = await provider.moderate({ text: input.text });
      if (providerResult.flagged) {
        const categories = providerResult.categories as SafetyCategory[];
        await recordEvent(kind, categories, "provider_flagged", input);
        return { flagged: true, categories, source: "provider" };
      }
      return { flagged: false, categories: [], source: "provider" };
    } catch (error) {
      if (!(error instanceof ModerationUnavailableError)) throw error;
      // §18: the local verdict stands when the provider is unreachable.
      providerCooldownUntil = Date.now() + PROVIDER_COOLDOWN_MS;
      await recordEvent(kind, [], "provider_unavailable", input);
    }
  }

  return { flagged: false, categories: [], source: "local" };
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