/**
 * Tutor Orchestrator v1 (plan §10) — a TypeScript class with unit-testable
 * decision functions, NOT a giant prompt. The model fills in language; the
 * orchestrator decides behavior, validates everything, and persists outcomes.
 *
 * Turn pipeline:
 *   1. resolve curriculum bundle (grounding)
 *   2. build budgeted context (memory builder)
 *   3. classify intent hint (deterministic) → task instruction
 *   4. provider structured call (JSON-schema envelope) — retry once
 *   5. envelope parse + structural validation
 *   6. OUTPUT SAFETY: provider moderation + deterministic checks BEFORE the
 *      child sees anything — unsafe → fallback + SafetyEvent
 *   7. persist: assistant message, learning signal, mastery update, session
 *      stats, UsageLog (cost attribution)
 */
import {
  LearningSignalModel,
  SkillMasteryModel,
  TutorMessageModel,
  TutorSessionModel,
  UsageLogModel,
  type MasteryBand,
  type TutorSessionDoc,
} from "@/models";
import { getProvider, getModels, type AiProvider, COST_PER_1K_IN, COST_PER_1K_OUT } from "../providers";
import { getCurrentLessonTool } from "../tools/curriculum";
import { augmentWithSupportingMaterial } from "../curriculum/grounding";
import { buildContextBundle, recentTurns, type MemoryTurn } from "../memory/builder";
import { buildSystemPrompt, TUTOR_ENVELOPE_SCHEMA } from "../prompts/templates";
import { moderateInput } from "../safety/moderation";
import { checkAssistantOutput, fallbackFor } from "../safety/output";
import { UNSAFE_OUTPUT_FALLBACK, PROVIDER_DOWN_MESSAGE, MALFORMED_OUTPUT_FALLBACK } from "../safety/deflections";
import { parseEnvelope, type TutorEnvelope } from "./envelope";
import { suggestIntent } from "./intents";
import { applySignal, gatedBand } from "../engine/mastery";

export interface StudentContextInput {
  name?: string | null;
  ageBand?: string | null;
  gradeName?: string | null;
  gradeLevelId?: string | null;
  vocabularyLevel?: number;
  explanationDepth?: number;
  interactionStyle?: string;
  preferences?: string[];
}

export interface TurnInput {
  studentId: string;
  session: TutorSessionDoc;
  userMessage: string;
  student: StudentContextInput;
}

export interface TurnResult {
  envelope: TutorEnvelope;
  assistantMessageId: string;
  usage: { task: string; model: string; tokensIn: number; tokensOut: number; costUsd: number; latencyMs: number };
  mastery?: { skillName: string; skillId: string; score: number; band: MasteryBand };
}

const SIGNAL_VALUE: Record<string, number> = {
  answer_correct: 1,
  answer_wrong: 0,
  hint_used: 0.5,
  concept_seen: 0.25,
};

export class TutorOrchestrator {
  private provider: AiProvider;

  constructor(provider: AiProvider = getProvider()) {
    this.provider = provider;
  }

  /** The full turn pipeline. Throws only for validation/DB issues the route
   * must know about; provider failures degrade to warm fallbacks (§37). */
  async handleTurn(input: TurnInput): Promise<TurnResult> {
    const { session } = input;

    const curriculum = await getCurrentLessonTool.execute({
      session,
      gradeLevelId: input.student.gradeLevelId ?? null,
    });
    // §6.3: fold supporting material into thin lessons, or support the child's
    // specific question — the model reasons over the knowledge base, not
    // invention. Routed through the §15 tool layer (validated + audited).
    await augmentWithSupportingMaterial(curriculum, {
      userMessage: input.userMessage,
      subjectId: session.subjectId ? session.subjectId.toString() : null,
      gradeLevelId: input.student.gradeLevelId ?? null,
    });
    const messages = await TutorMessageModel.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean();
    const turns: MemoryTurn[] = recentTurns(messages);

    const intentHint = suggestIntent({
      message: input.userMessage,
      lastTurnAskedQuestion: lastTurnAskedQuestion(messages),
      turnCount: turns.filter((t) => t.role === "assistant").length,
    });

    const bundle = buildContextBundle({
      student: {
        name: input.student.name ?? undefined,
        ageBand: input.student.ageBand ?? undefined,
        gradeName: input.student.gradeName ?? undefined,
        vocabularyLevel: input.student.vocabularyLevel,
        explanationDepth: input.student.explanationDepth,
        interactionStyle: input.student.interactionStyle,
        preferences: input.student.preferences,
      },
      curriculum: {
        skillName: curriculum.skillName,
        objective: curriculum.objective,
        lessonTitle: curriculum.lessonTitle,
        lessonBody: curriculum.lessonBody,
        examples: curriculum.examples,
      },
      turns,
      highlights: { lines: curriculum.masteryLines },
    });

    const taskHint = intentHint
      ? ` The student's message strongly suggests this intent; honor it unless the conversation clearly says otherwise.`
      : "";

    const userPrompt = [
      bundle.student,
      bundle.longTerm,
      bundle.curriculum,
      bundle.conversation,
      `TASK: classify this turn as ${intentHint ?? "the best fit from the conversation"}${taskHint}`,
      `STUDENT MESSAGE: "${input.userMessage}"`,
    ].join("\n\n");

    // 1) Structured provider call (schema-enforced) with ONE retry (§16, §37).
    const { envelope, usage } = await this.structuredTurn(bundle.student, userPrompt, intentHint);

    // 2) Output safety BEFORE anything reaches the child (§18.5–18.6).
    const safeEnvelope = await this.secureOutput(envelope, input);
    const finalEnvelope = safeEnvelope;

    // 3) Persist assistant message + session stats.
    const assistantMessage = await TutorMessageModel.create({
      sessionId: session._id,
      role: "assistant",
      contentType: finalEnvelope.question ? "structured" : "text",
      content: {
        text: finalEnvelope.response,
        interactionType: finalEnvelope.interaction_type,
        question: finalEnvelope.question ?? null,
        hint: finalEnvelope.hint ?? null,
        completed: finalEnvelope.completed,
      },
      model: usage.model,
      tokensIn: usage.tokensIn,
      tokensOut: usage.tokensOut,
      safety: { moderated: true, verdict: "ok" },
    });

    const update: Record<string, number> = { messages: 1 };
    if (finalEnvelope.learning_signal.type === "answer_correct") update.correct = 1;
    if (finalEnvelope.learning_signal.type === "answer_wrong") update.wrong = 1;
    if (finalEnvelope.learning_signal.type === "hint_used") update.hintsUsed = 1;
    await TutorSessionModel.updateOne(
      { _id: session._id },
      {
        $inc: { "stats.messages": update.messages, "stats.correct": update.correct ?? 0, "stats.wrong": update.wrong ?? 0, "stats.hintsUsed": update.hintsUsed ?? 0, aiCostTokens: usage.tokensIn + usage.tokensOut },
        $set: finalEnvelope.completed ? { status: "ended", endedAt: new Date(), completionReason: "completed" } : {},
      }
    );

    // 4) Learning signal → mastery update.
    const mastery = await this.recordSignal(input, finalEnvelope, curriculum.skillId, curriculum.skillName);

    // 5) Usage attribution.
    await this.logUsage(input, usage, finalEnvelope.completed);

    return { envelope: finalEnvelope, assistantMessageId: assistantMessage._id.toString(), usage, mastery };
  }

  private async structuredTurn(
    studentBlock: string,
    userPrompt: string,
    intentHint: string | null
  ): Promise<{ envelope: TutorEnvelope; usage: TurnResult["usage"] }> {
    const started = Date.now();
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.provider.complete({
          system: buildSystemPrompt(),
          messages: [{ role: "user", content: userPrompt }],
          schema: TUTOR_ENVELOPE_SCHEMA,
          model: getModels().structured, // envelope = structured-model task (§9)
          temperature: intentHint === "hint" ? 0.3 : 0.5,
          maxTokens: 600,
        });
        const usage = {
          task: "tutor_turn",
          model: response.model,
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          costUsd: (response.tokensIn / 1000) * COST_PER_1K_IN + (response.tokensOut / 1000) * COST_PER_1K_OUT,
          latencyMs: response.latencyMs || Date.now() - started,
        };
        if (response.refused) {
          return { envelope: fallbackEnvelope(UNSAFE_OUTPUT_FALLBACK), usage };
        }
        try {
          return { envelope: parseEnvelope(response.text), usage };
        } catch {
          // Malformed structured output → one retry, then friendly fallback (§37).
          if (attempt === 1) {
            return { envelope: fallbackEnvelope(MALFORMED_OUTPUT_FALLBACK), usage };
          }
        }
      } catch (error) {
        if (attempt === 1) {
          console.error("[tutor] provider call failed", {
            name: error instanceof Error ? error.name : typeof error,
            message: error instanceof Error ? error.message : undefined,
          });
          return { envelope: fallbackEnvelope(PROVIDER_DOWN_MESSAGE), usage: { task: "tutor_turn", model: "", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - started } };
        }
      }
    }
    return { envelope: fallbackEnvelope(MALFORMED_OUTPUT_FALLBACK), usage: { task: "tutor_turn", model: "", tokensIn: 0, tokensOut: 0, costUsd: 0, latencyMs: Date.now() - started } };
  }

  /** Output moderation + deterministic checks; unsafe → fallback + SafetyEvent. */
  private async secureOutput(
    envelope: TutorEnvelope,
    input: TurnInput
  ): Promise<TutorEnvelope> {
    const moderation = await this.provider.moderate({ text: envelope.response });
    const check = checkAssistantOutput(envelope.response, moderation);
    if (check.safe) return envelope;

    await moderateInput(this.provider, {
      text: envelope.response,
      studentId: input.studentId,
      sessionId: input.session._id.toString(),
    }, "output_moderation");

    return fallbackEnvelope(fallbackFor(check.reason ?? "unsafe"));
  }

  /** Persists a learning signal and updates SkillMastery (plan §12). */
  private async recordSignal(
    input: TurnInput,
    envelope: TutorEnvelope,
    skillId: string,
    skillName: string
  ): Promise<TurnResult["mastery"] | undefined> {
    const signalType = envelope.learning_signal.type;
    if (signalType === "none") return undefined;

    const value = SIGNAL_VALUE[signalType];
    if (value === undefined) return undefined;

    await LearningSignalModel.create({
      sessionId: input.session._id,
      studentId: input.studentId,
      skillId,
      type: signalType,
      value,
      confidence: 0.8,
      difficulty: envelope.difficulty,
    });

    const existing = await SkillMasteryModel.findOne({ studentId: input.studentId, skillId }).lean();
    const state = applySignal(
      existing
        ? { score: existing.score, evidenceCount: existing.evidenceCount, recentCorrect: existing.recentCorrect, retests: existing.retests }
        : null,
      { value, difficulty: envelope.difficulty }
    );
    const band = gatedBand(state);
    await SkillMasteryModel.updateOne(
      { studentId: input.studentId, skillId },
      {
        $set: {
          score: state.score,
          band,
          evidenceCount: state.evidenceCount,
          recentCorrect: state.recentCorrect,
          retests: state.retests,
          lastTestedAt: new Date(),
        },
        $setOnInsert: { studentId: input.studentId, skillId },
      },
      { upsert: true }
    );

    return { skillName, skillId, score: state.score, band };
  }

  private async logUsage(
    input: TurnInput,
    usage: TurnResult["usage"],
    completed: boolean
  ): Promise<void> {
    if (!usage.tokensIn && !usage.tokensOut && usage.model === "") return;
    try {
      await UsageLogModel.create({
        date: new Date().toISOString().slice(0, 10),
        task: usage.task,
        model: usage.model,
        tokensIn: usage.tokensIn,
        tokensOut: usage.tokensOut,
        costUsd: usage.costUsd,
        latencyMs: usage.latencyMs,
        status: completed ? "completed" : "ok",
        studentId: input.studentId,
        sessionId: input.session._id,
      });
    } catch (error) {
      console.error("[usage] failed to log UsageLog", {
        name: error instanceof Error ? error.name : typeof error,
      });
    }
  }
}

function fallbackEnvelope(response: string): TutorEnvelope {
  return {
    response,
    interaction_type: "smalltalk",
    skill: "",
    difficulty: 3,
    hint_available: false,
    requires_action: "none",
    learning_signal: { type: "none", value: 0 },
    completed: false,
  };
}

function lastTurnAskedQuestion(messages: Array<{ role: string; content: unknown }>): boolean {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role === "assistant") {
      if (typeof message.content === "object" && message.content !== null) {
        const content = message.content as Record<string, unknown>;
        return content.question !== null && content.question !== undefined;
      }
    }
  }
  return false;
}