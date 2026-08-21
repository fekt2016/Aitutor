/**
 * Golden-scenario orchestrator tests (§36) with a deterministic mock provider
 * and mocked persistence — no network, no database, no OpenAI.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AiProvider, CompletionResponse } from "../providers";
import { TutorOrchestrator, type StudentContextInput } from "./orchestrator";
import { UNSAFE_OUTPUT_FALLBACK, PROVIDER_DOWN_MESSAGE, MALFORMED_OUTPUT_FALLBACK } from "../safety/deflections";

/* ------------------------------------------------------------------ */
/* Mocks                                                               */
/* ------------------------------------------------------------------ */

vi.mock("@/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models")>();
  return {
    ...actual,
    TutorMessageModel: {
      find: vi.fn(),
      create: vi.fn(),
    },
    TutorSessionModel: {
      updateOne: vi.fn(),
    },
    LearningSignalModel: { create: vi.fn() },
    SkillMasteryModel: {
      findOne: vi.fn(),
      updateOne: vi.fn(),
    },
    UsageLogModel: { create: vi.fn() },
    SafetyEventModel: { create: vi.fn() },
  };
});

vi.mock("../curriculum/service", () => ({
  resolveSkillForSession: vi.fn(),
}));

// Grounding hits the real CurriculumChunk collection — keep orchestrator
// scenarios hermetic (no DB); grounding itself has dedicated tests.
vi.mock("../curriculum/grounding", () => ({
  augmentWithSupportingMaterial: vi.fn(),
}));

import {
  TutorMessageModel,
  TutorSessionModel,
  LearningSignalModel,
  SkillMasteryModel,
  UsageLogModel,
  SafetyEventModel,
} from "@/models";
import { resolveSkillForSession } from "../curriculum/service";

const messageFindChain = {
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn(),
};
vi.mocked(TutorMessageModel.find).mockReturnValue(messageFindChain as never);

const masteryFindChain = { lean: vi.fn() };
vi.mocked(SkillMasteryModel.findOne).mockReturnValue(masteryFindChain as never);

const resolvedBundle = {
  subjectName: "Mathematics",
  skillId: "skill-1",
  skillCode: "add-subtract-within-20",
  skillName: "Adding within 20",
  objective: "Add numbers up to 20",
  lessonTitle: "Counting on",
  lessonBody: "Count on from the bigger number.",
  examples: ["3 + 5 = 8"],
  items: [],
  masteryLines: [],
};

const session = {
  _id: "sess-1",
  studentId: "student-1",
  subjectId: "subj-1",
  gradeLevelId: "grade-1",
  status: "active",
  stats: { messages: 0, correct: 0, wrong: 0, hintsUsed: 0 },
  aiCostTokens: 0,
} as never;

const studentContext: StudentContextInput = {
  name: "Kojo",
  ageBand: "8-9",
  gradeName: "Basic 3",
  gradeLevelId: "grade-1",
  vocabularyLevel: 3,
  explanationDepth: 3,
  interactionStyle: "playful",
};

function mockProvider(overrides: Partial<AiProvider> = {}) {
  const base = {
    name: "mock",
    complete: vi.fn().mockResolvedValue({
      text: JSON.stringify({
        response: "Great trying! Let's count on from 8. 8… 9, 10, 11, 12!",
        interaction_type: "explain",
        skill: "add-subtract-within-20",
        difficulty: 3,
        hint_available: true,
        requires_action: "none",
        learning_signal: { type: "concept_seen", value: 0.25 },
        completed: false,
      }),
      model: "mock-model",
      tokensIn: 100,
      tokensOut: 50,
      latencyMs: 40,
    } satisfies CompletionResponse),
    moderate: vi.fn().mockResolvedValue({ flagged: false, categories: [] }),
    stream: vi.fn(),
  };
  return { ...base, ...overrides } as AiProvider & {
    complete: ReturnType<typeof vi.fn>;
    moderate: ReturnType<typeof vi.fn>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(resolveSkillForSession).mockResolvedValue(resolvedBundle as never);
  messageFindChain.lean.mockResolvedValue([] as never);
  masteryFindChain.lean.mockResolvedValue(null as never);
  vi.mocked(TutorMessageModel.create).mockResolvedValue({ _id: "msg-1" } as never);
  vi.mocked(TutorSessionModel.updateOne).mockResolvedValue({} as never);
  vi.mocked(LearningSignalModel.create).mockResolvedValue({} as never);
  vi.mocked(SkillMasteryModel.updateOne).mockResolvedValue({} as never);
  vi.mocked(UsageLogModel.create).mockResolvedValue({} as never);
  vi.mocked(SafetyEventModel.create).mockResolvedValue({} as never);
});

/* ------------------------------------------------------------------ */
/* Golden scenarios (§36)                                              */
/* ------------------------------------------------------------------ */

describe("TutorOrchestrator golden scenarios", () => {
  it("happy path: grounds, calls the provider once, persists message + usage", async () => {
    const provider = mockProvider();
    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "can you help me add 8 and 4?",
      student: studentContext,
    });

    expect(provider.complete).toHaveBeenCalledTimes(1);
    const request = provider.complete.mock.calls[0][0];
    expect(request.system).toContain("You TEACH, you never just answer");
    expect(request.messages[0].content).toContain("Adding within 20"); // curriculum grounding
    expect(request.messages[0].content).toContain("STUDENT: Kojo"); // age-appropriate context
    expect(request.schema?.name).toBe("tutor_action_envelope");

    expect(result.envelope.response).toContain("Great trying");
    expect(TutorMessageModel.create).toHaveBeenCalledTimes(1);
    expect(UsageLogModel.create).toHaveBeenCalledTimes(1);
    expect(UsageLogModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "student-1", sessionId: "sess-1", model: "mock-model", tokensIn: 100, tokensOut: 50 })
    );
    expect(result.usage.costUsd).toBeGreaterThan(0);
  });

  it("records a learning signal and updates mastery (upsert, per-student)", async () => {
    const provider = mockProvider();
    provider.complete.mockResolvedValue({
      text: JSON.stringify({
        response: "Brilliant! 8 + 4 is 12.",
        interaction_type: "practice",
        skill: "add-subtract-within-20",
        difficulty: 3,
        hint_available: false,
        requires_action: "none",
        learning_signal: { type: "answer_correct", value: 1 },
        completed: false,
      }),
      model: "mock-model",
      tokensIn: 100,
      tokensOut: 50,
      latencyMs: 40,
    } satisfies CompletionResponse);

    await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "12!",
      student: studentContext,
    });

    expect(LearningSignalModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "student-1", skillId: "skill-1", type: "answer_correct", value: 1 })
    );
    expect(SkillMasteryModel.findOne).toHaveBeenCalledWith({ studentId: "student-1", skillId: "skill-1" });
    expect(SkillMasteryModel.updateOne).toHaveBeenCalledWith(
      { studentId: "student-1", skillId: "skill-1" },
      expect.objectContaining({ $set: expect.objectContaining({ score: expect.any(Number), band: expect.any(String) }) }),
      { upsert: true }
    );
  });

  it("completion: ends the session and marks the UsageLog completed", async () => {
    const provider = mockProvider();
    provider.complete.mockResolvedValue({
      text: JSON.stringify({
        response: "You finished the whole lesson — well done!",
        interaction_type: "session_end",
        skill: "add-subtract-within-20",
        difficulty: 3,
        hint_available: false,
        requires_action: "none",
        learning_signal: { type: "none", value: 0 },
        completed: true,
      }),
      model: "mock-model",
      tokensIn: 100,
      tokensOut: 50,
      latencyMs: 40,
    } satisfies CompletionResponse);

    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "I'm done!",
      student: studentContext,
    });

    expect(TutorSessionModel.updateOne).toHaveBeenCalledWith(
      { _id: "sess-1" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "ended", completionReason: "completed" }) })
    );
    expect(result.envelope.completed).toBe(true);
    expect(UsageLogModel.create).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
  });

  it("provider outage: retries once, then serves the warm fallback (§37)", async () => {
    const provider = mockProvider({ complete: vi.fn().mockRejectedValue(new Error("network down")) });

    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "hello",
      student: studentContext,
    });

    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(result.envelope.response).toBe(PROVIDER_DOWN_MESSAGE);
    // Fallback still persists a message so the child gets a coherent reply.
    expect(TutorMessageModel.create).toHaveBeenCalledTimes(1);
    // No tokens → no UsageLog row.
    expect(UsageLogModel.create).not.toHaveBeenCalled();
  });

  it("malformed structured output: retries once, then friendly fallback (§37)", async () => {
    const provider = mockProvider({ complete: vi.fn().mockResolvedValue({ text: "oops { not json", model: "m", tokensIn: 1, tokensOut: 1, latencyMs: 1 } as never) });

    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "hello",
      student: studentContext,
    });

    expect(provider.complete).toHaveBeenCalledTimes(2);
    expect(result.envelope.response).toBe(MALFORMED_OUTPUT_FALLBACK);
  });

  it("unsafe model output: blocked before the child sees it + SafetyEvent recorded", async () => {
    const provider = mockProvider({ moderate: vi.fn().mockResolvedValue({ flagged: true, categories: ["violence"] }) });
    provider.complete.mockResolvedValue({
      text: JSON.stringify({
        response: "Here is some adult content the model tried to leak.",
        interaction_type: "explain",
        skill: "add-subtract-within-20",
        difficulty: 3,
        hint_available: false,
        requires_action: "none",
        learning_signal: { type: "none", value: 0 },
        completed: false,
      }),
      model: "mock-model",
      tokensIn: 100,
      tokensOut: 50,
      latencyMs: 40,
    } satisfies CompletionResponse);

    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "hello",
      student: studentContext,
    });

    expect(result.envelope.response).toBe(UNSAFE_OUTPUT_FALLBACK);
    expect(SafetyEventModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "student-1", kind: "output_moderation" })
    );
  });

  it("provider refusal (safety gate): never streams the refused text", async () => {
    const provider = mockProvider({ complete: vi.fn().mockResolvedValue({ text: "I refuse", model: "m", tokensIn: 1, tokensOut: 1, latencyMs: 1, refused: true } as never) });

    const result = await new TutorOrchestrator(provider).handleTurn({
      studentId: "student-1",
      session,
      userMessage: "hello",
      student: studentContext,
    });

    expect(result.envelope.response).toBe(UNSAFE_OUTPUT_FALLBACK);
    expect(result.envelope.response).not.toBe("I refuse");
  });
});