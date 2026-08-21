/**
 * AiProvider abstraction (plan §8.3) — every AI call in the app goes through
 * this interface. NEVER import the provider SDK (OpenAI) outside an adapter.
 * Model names, prompts, and JSON schemas are config, so Anthropic/Gemini can
 * be added as adapters later without touching the orchestrator.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Minimal JSON-schema subset used for provider-native structured output. */
export interface JsonSchema {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
  /** Provider-native enforcement: true = strict mode where supported. */
  strict?: boolean;
}

export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  /** Structured output schema — provider-native JSON-schema when supported. */
  schema?: JsonSchema;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CompletionResponse {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  /** Provider "refused" flag — text is not usable for a child. */
  refused?: boolean;
}

export interface StreamChunk {
  /** Text delta (empty on the final chunk). */
  delta: string;
  done: boolean;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface ModerationResult {
  flagged: boolean;
  categories: string[];
}

export interface ModerationRequest {
  text: string;
}

/**
 * Thrown by adapters when the Moderation endpoint is unreachable or failing
 * (network, 429 rate limit, 5xx, auth). The safety layer falls back to the
 * local classifier (§18) — an adapter must NEVER fake a "flagged" verdict,
 * which would silently block every benign turn.
 */
export class ModerationUnavailableError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModerationUnavailableError";
    this.status = status;
  }
}

export interface AiProvider {
  complete(req: CompletionRequest): Promise<CompletionResponse>;
  stream(req: CompletionRequest): AsyncIterable<StreamChunk>;
  moderate(req: ModerationRequest): Promise<ModerationResult>;
  /** Human-readable provider name for UsageLog/model attribution. */
  readonly name: string;
}

/** Declarative model routing (plan §9) — prices/names change without code. */
export interface ModelMap {
  /** Main tutor conversation. */
  tutor: string;
  /** Structured outputs (envelope, classification). */
  structured: string;
}

/** Task keys for UsageLog attribution (plan §29). */
export type AiTask =
  | "tutor_turn"
  | "intent_classify"
  | "moderation"
  | "summary"
  | "signal_extract";

/** Estimated USD per 1k tokens (small-model class defaults; config overrides later). */
export const COST_PER_1K_IN = 0.00015;
export const COST_PER_1K_OUT = 0.0006;