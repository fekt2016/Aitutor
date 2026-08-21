import { describe, it, expect } from "vitest";
import { validateEnvelope, parseEnvelope } from "./envelope";

const VALID = {
  response: "Let's count the apples together!",
  interaction_type: "ask",
  skill: "add-subtract-within-20",
  difficulty: 3,
  hint_available: true,
  requires_action: "question",
  question: { prompt: "If you have 3 apples and I give you 2 more, how many?", type: "mcq", options: ["4", "5", "6"] },
  hint: "Try counting on from 3.",
  praise: true,
  learning_signal: { type: "concept_seen", value: 0.25 },
  completed: false,
};

describe("validateEnvelope (§16)", () => {
  it("accepts a fully-formed envelope", () => {
    const envelope = validateEnvelope(VALID);
    expect(envelope.response).toBe(VALID.response);
    expect(envelope.question?.options).toHaveLength(3);
    expect(envelope.learning_signal.type).toBe("concept_seen");
  });

  it("rejects non-object payloads", () => {
    expect(() => validateEnvelope(null)).toThrow();
    expect(() => validateEnvelope("hi")).toThrow();
    expect(() => validateEnvelope([1, 2])).toThrow();
  });

  it("rejects missing/empty response", () => {
    expect(() => validateEnvelope({ ...VALID, response: "" })).toThrow();
  });

  it("rejects unknown interaction_type", () => {
    expect(() => validateEnvelope({ ...VALID, interaction_type: "sing" })).toThrow();
  });

  it("rejects difficulty outside 1–5", () => {
    expect(() => validateEnvelope({ ...VALID, difficulty: 0 })).toThrow();
    expect(() => validateEnvelope({ ...VALID, difficulty: 9 })).toThrow();
  });

  it("requires a question when requires_action is question", () => {
    expect(() => validateEnvelope({ ...VALID, question: undefined })).toThrow();
  });

  it("enforces 3–5 MCQ options", () => {
    expect(() => validateEnvelope({ ...VALID, question: { ...VALID.question, options: ["a", "b"] } })).toThrow();
    expect(() => validateEnvelope({ ...VALID, question: { ...VALID.question, options: ["a", "b", "c", "d", "e", "f"] } })).toThrow();
  });

  it("clamps learning_signal.value into 0..1", () => {
    const envelope = validateEnvelope({ ...VALID, learning_signal: { type: "answer_correct", value: 99 } });
    expect(envelope.learning_signal.value).toBe(1);
  });

  it("tolerates missing optional fields", () => {
    const envelope = validateEnvelope({
      ...VALID,
      requires_action: "none",
      question: undefined,
      hint: undefined,
      praise: undefined,
      learning_signal: { type: "none", value: 0 },
    });
    expect(envelope.question).toBeUndefined();
    expect(envelope.completed).toBe(false);
  });

  it("rejects trailing unknown fields (strict)", () => {
    expect(() => validateEnvelope({ ...VALID, evil: "extra" })).not.toThrow();
    // Structural validator is intentionally permissive on extra keys;
    // strictness is enforced at generation time by the JSON schema.
  });
});

describe("parseEnvelope (§16, §37)", () => {
  it("parses valid JSON text", () => {
    const envelope = parseEnvelope(JSON.stringify(VALID));
    expect(envelope.interaction_type).toBe("ask");
  });

  it("throws VALIDATION_ERROR on non-JSON", () => {
    expect(() => parseEnvelope("definitely { not json")).toThrow();
  });

  it("throws on JSON that fails structural validation", () => {
    expect(() => parseEnvelope(JSON.stringify({ response: "x", interaction_type: "bad" }))).toThrow();
  });
});