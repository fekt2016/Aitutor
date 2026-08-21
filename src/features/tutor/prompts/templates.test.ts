import { describe, it, expect } from "vitest";
import { buildSystemPrompt, studentContextPrompt, curriculumContextPrompt, systemRolePrompt, TUTOR_ENVELOPE_SCHEMA } from "./templates";

describe("system prompt golden checks (§35.1–2)", () => {
  const system = buildSystemPrompt();

  it("establishes the teacher persona (name, age, curriculum)", () => {
    expect(system).toContain("Eazi");
    expect(system).toContain("5–11");
    expect(system).toContain("NaCCA");
  });

  it("TEACHES — never just answers (teaching-vs-answering golden rule)", () => {
    expect(system).toContain("You TEACH, you never just answer");
    expect(system).toContain("ask a quick check question");
  });

  it("uses Ghanaian everyday examples", () => {
    expect(system).toContain("market");
    expect(system).toContain("football");
  });

  it("keeps replies short and plain (child-friendly)", () => {
    expect(system).toContain("1–4 sentences");
    expect(system).toContain("Never use emojis, slang, or adult humour");
  });

  it("never discusses adult topics or collects PII", () => {
    expect(system).toContain("Never discuss sex, violence, drugs, alcohol, self-harm, dating");
    expect(system).toContain("Never ask for or reveal personal information");
    expect(system).toContain("Never pretend to be someone else");
    expect(system).toContain("never invent facts");
  });

  it("grounds every claim in the curriculum material", () => {
    expect(system).toContain("unless it comes from the curriculum material");
  });

  it("is versioned", () => {
    expect(systemRolePrompt().version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("studentContextPrompt (§35.3)", () => {
  it("carries age band + grade + vocabulary + depth for age-appropriateness", () => {
    const block = studentContextPrompt({
      name: "Kojo",
      ageBand: "8-9",
      gradeName: "Basic 3",
      vocabularyLevel: 3,
      explanationDepth: 3,
      interactionStyle: "playful",
    });
    expect(block).toContain("age band 8-9");
    expect(block).toContain("vocabulary level 3/5");
    expect(block).toContain("explanation depth 3/5");
    expect(block).toContain("Basic 3");
  });

  it("falls back to safe defaults when context is missing", () => {
    const block = studentContextPrompt({});
    expect(block).toContain("age band unknown");
    expect(block).not.toContain("undefined");
  });
});

describe("curriculumContextPrompt (§35.4) — grounding", () => {
  it("teaches from content and never claims invented facts", () => {
    const block = curriculumContextPrompt({
      skillName: "Adding within 20",
      objective: "Add numbers up to 20",
      lessonTitle: "Counting on",
      lessonBody: "Count on from the bigger number.",
      examples: ["3 + 5 = 8"],
    });
    expect(block).toContain("SKILL: Adding within 20");
    expect(block).toContain("EXAMPLES");
    expect(block).toContain("GROUNDING RULE");
  });
});

describe("TUTOR_ENVELOPE_SCHEMA (§16) — strict provider-side contract", () => {
  it("enables strict mode and rejects extra fields", () => {
    expect(TUTOR_ENVELOPE_SCHEMA.strict).toBe(true);
    const s = TUTOR_ENVELOPE_SCHEMA.schema as { additionalProperties?: boolean };
    expect(s.additionalProperties).toBe(false);
  });

  it("requires every field the orchestrator relies on", () => {
    const required = TUTOR_ENVELOPE_SCHEMA.schema as { required?: string[] };
    for (const field of ["response", "interaction_type", "difficulty", "hint_available", "requires_action", "learning_signal", "completed"]) {
      expect(required.required).toContain(field);
    }
  });

  it("restricts learning_signal values to the engine's known types", () => {
    const schema = TUTOR_ENVELOPE_SCHEMA.schema as {
      properties: { learning_signal: { properties: { type: { enum: unknown[] } } } };
    };
    const enumValues = schema.properties.learning_signal.properties.type.enum as string[];
    for (const signal of ["answer_correct", "answer_wrong", "hint_used", "concept_seen", "none"]) {
      expect(enumValues).toContain(signal);
    }
  });
});