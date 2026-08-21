/**
 * OpenAI adapter (plan §8.2–8.3) — the FIRST provider adapter. Implements the
 * AiProvider contract only; nothing outside `providers/` imports `openai`.
 *
 * - Structured output: provider-native JSON-schema mode (`response_format`).
 * - Moderation: the dedicated Moderation API — never the tutor model.
 * - Stream: chunk deltas over an async generator.
 *
 * Env (lazy — the provider is only constructed when the tutor path runs):
 *   OPENAI_API_KEY, OPENAI_MODEL_TUTOR, OPENAI_MODEL_STRUCTURED.
 */
import OpenAI from "openai";
import { getEnv } from "@/server/env";
import type {
  AiProvider,
  CompletionRequest,
  CompletionResponse,
  JsonSchema,
  ModerationRequest,
  ModerationResult,
  ModelMap,
  StreamChunk,
} from "./types";
import { ModerationUnavailableError } from "./types";

export const OPENAI_MODEL_DEFAULTS: ModelMap = {
  tutor: "gpt-4o-mini",
  structured: "gpt-4o-mini",
};

export class OpenAIAdapter implements AiProvider {
  readonly name = "openai";
  private client: OpenAI | null = null;
  readonly models: ModelMap;

  constructor(models: ModelMap = OPENAI_MODEL_DEFAULTS) {
    this.models = models;
  }

  /** Lazy client — constructing with a missing key throws a friendly error. */
  private getClient(): OpenAI {
    if (this.client) return this.client;
    const apiKey = getEnv().OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. The tutor cannot run without a provider key."
      );
    }
    this.client = new OpenAI({
      apiKey,
      // A child chat turn must never hang on the SDK default (~10 min).
      timeout: 15_000,
      maxRetries: 1,
    });
    return this.client;
  }

  private buildBody(req: CompletionRequest) {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: req.system },
      ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
    const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      model: req.model ?? this.models.tutor,
      messages,
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 400,
    };
    if (req.schema) {
      body.response_format = { type: "json_schema", json_schema: toOpenAiSchema(req.schema) };
    }
    return body;
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const started = Date.now();
    const client = this.getClient();
    const body = this.buildBody(req);
    try {
      const completion = await client.chat.completions.create(body);
      const choice = completion.choices[0];
      const text = choice?.message?.content ?? "";
      return {
        text,
        model: completion.model,
        tokensIn: completion.usage?.prompt_tokens ?? 0,
        tokensOut: completion.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
        refused: choice?.finish_reason === "content_filter" || !text,
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async *stream(req: CompletionRequest): AsyncIterable<StreamChunk> {
    const client = this.getClient();
    const body: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
      ...this.buildBody(req),
      stream: true,
    };
    let tokensOut = 0;
    try {
      const stream = await client.chat.completions.create(body);
      for await (const chunk of stream) {
        tokensOut += 1;
        const delta = chunk.choices[0]?.delta?.content ?? "";
        yield { delta, done: false, model: chunk.model };
      }
      yield { delta: "", done: true, model: body.model, tokensOut };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    try {
      const result = await this.getClient().moderations.create({
        model: "omni-moderation-latest",
        input: req.text.slice(0, 4000),
      });
      const item = result.results[0];
      const flagged = item?.flagged ?? false;
      const categories = item
        ? (Object.entries(item.categories)
            .filter(([, v]) => v)
            .map(([k]) => k) as string[])
        : [];
      return { flagged, categories };
    } catch (error) {
      const e = error as { status?: number; message?: string };
      // Observability only — request content is never logged (§19).
      console.error("[safety] moderation API unavailable", {
        status: e?.status ?? null,
        message: e?.message ?? "unknown",
      });
      // Surface unavailability so the safety layer can fall back to the
      // local classifier (§18). Faking "flagged" here would block every
      // benign turn whenever this endpoint throttles.
      throw new ModerationUnavailableError(e?.message ?? "moderation unavailable", e?.status);
    }
  }
}

function toOpenAiSchema(schema: JsonSchema): OpenAI.ResponseFormatJSONSchema["json_schema"] {
  return {
    name: schema.name,
    description: schema.description,
    strict: schema.strict ?? true,
    schema: schema.schema,
  };
}

function toProviderError(error: unknown): Error {
  const e = error as { status?: number; message?: string };
  if (e?.status === 429) {
    return new Error("provider_rate_limited");
  }
  if (e?.status && e.status >= 500) {
    return new Error("provider_unavailable");
  }
  return error instanceof Error ? error : new Error("provider_error");
}