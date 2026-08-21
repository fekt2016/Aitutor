/**
 * Provider factory + registry (plan §8.3) — the ONLY place that knows which
 * provider is active. `AI_PROVIDER` env selects the adapter (default "openai").
 * A fallback chain (primary down → secondary) can be added here later without
 * touching the orchestrator.
 */
import { getEnv } from "@/server/env";
import { OpenAIAdapter } from "./openai";
import type { AiProvider, ModelMap } from "./types";

export * from "./types";

let cached: AiProvider | null = null;

export function getModels(): ModelMap {
  const env = getEnv();
  return {
    tutor: env.OPENAI_MODEL_TUTOR || "gpt-4o-mini",
    structured: env.OPENAI_MODEL_STRUCTURED || "gpt-4o-mini",
  };
}

/**
 * Returns the active AiProvider (singleton per process). Throws only when the
 * provider is explicitly required and unusable; the tutor path converts this
 * into a child-friendly fallback (§37).
 */
export function getProvider(): AiProvider {
  if (cached) return cached;
  const providerName = getEnv().AI_PROVIDER || "openai";
  switch (providerName) {
    case "openai":
      cached = new OpenAIAdapter(getModels());
      break;
    default:
      throw new Error(`Unknown AI_PROVIDER "${providerName}". Supported: openai.`);
  }
  return cached;
}

/** Test helper — inject a fake provider (mock) and reset after. */
export function setProvider(provider: AiProvider): void {
  cached = provider;
}

export function resetProvider(): void {
  cached = null;
}