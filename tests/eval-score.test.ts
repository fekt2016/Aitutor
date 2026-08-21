/**
 * Hermetic tests for the §36 eval scorers (eval/score.ts) — pure math over
 * fixture hits; no DB, no network. These pin the relevance semantics the
 * live runner (`npm run eval:retrieval`) relies on.
 */
import { describe, it, expect } from "vitest";
import type { CurriculumHit } from "../src/features/tutor/curriculum/retrieval";
import {
  hitMentions,
  isRelevantHit,
  scoreRetrievalScenario,
  summarize,
  textMentions,
} from "../eval/score";
import type { RetrievalScenario } from "../eval/scenarios";

function hit(overrides: Partial<CurriculumHit> = {}): CurriculumHit {
  return {
    chunkId: "c1",
    sourceType: "definition",
    sourceId: "s1",
    title: "Equivalent fractions",
    content: "Fractions that show the same amount. Multiply the numerator and denominator.",
    ...overrides,
  };
}

describe("textMentions / hitMentions", () => {
  it("requires EVERY term of a group (AND)", () => {
    expect(textMentions("multiply the numerator", ["numerator"])).toBe(true);
    expect(textMentions("multiply the numerator", ["numerator", "denominator"])).toBe(false);
  });

  it("matches case-insensitively across title + content", () => {
    expect(hitMentions(hit(), ["EQUIVALENT FRACTIONS"])).toBe(true);
    // "equivalent" lives in the TITLE only — content alone must not match it.
    expect(hitMentions(hit({ title: "" }), ["equivalent"])).toBe(false);
    expect(hitMentions(hit({ title: "" }), ["numerator"])).toBe(true);
  });
});

describe("isRelevantHit — OR'd AND-groups", () => {
  const groups = [["same amount"], ["numerator", "denominator"]];

  it("matches when any full group matches", () => {
    expect(isRelevantHit(hit({ content: "half of a cake is the same amount" }), groups)).toBe(true);
    expect(isRelevantHit(hit(), groups)).toBe(true); // numerator+denominator
  });

  it("rejects partial group matches and unrelated content", () => {
    expect(isRelevantHit(hit({ content: "only the numerator here" }), groups)).toBe(false);
    expect(isRelevantHit(hit({ content: "consonant blends: bl, st" }), groups)).toBe(false);
  });
});

describe("scoreRetrievalScenario", () => {
  const scenario: RetrievalScenario = {
    id: "t",
    dimension: "curriculum alignment",
    query: "what is a numerator?",
    expectAny: [["numerator"]],
    minRelevant: 1,
  };

  it("records ranks of relevant hits in order", () => {
    const verdict = scoreRetrievalScenario(scenario, [
      hit({ content: "consonant blends" }),
      hit({ content: "the numerator is the top number" }),
      hit({ content: "numerator again" }),
    ]);
    expect(verdict.relevantRanks).toEqual([2, 3]);
    expect(verdict.passed).toBe(true);
  });

  it("fails when nothing relevant returns", () => {
    const verdict = scoreRetrievalScenario(scenario, [hit({ content: "blends" })]);
    expect(verdict.relevantRanks).toEqual([]);
    expect(verdict.passed).toBe(false);
  });

  it("negative control passes only with zero relevant hits", () => {
    const negative: RetrievalScenario = { ...scenario, minRelevant: 0 };
    expect(scoreRetrievalScenario(negative, [hit({ content: "blends" })]).passed).toBe(true);
    expect(scoreRetrievalScenario(negative, [hit()]).passed).toBe(false);
  });
});

describe("summarize", () => {
  function verdict(id: string, minRelevant: number, firstRank: number | null) {
    return {
      id,
      dimension: "d",
      query: "q",
      relevantRanks: firstRank ? [firstRank] : [],
      returned: 3,
      minRelevant,
      passed: firstRank !== null ? true : minRelevant === 0,
    };
  }

  it("computes hit-rate and MRR over positives only", () => {
    const summary = summarize([
      verdict("p1", 1, 1), // rank 1 → reciprocal 1
      verdict("p2", 1, 3), // rank 3 → reciprocal 1/3
      verdict("n1", 0, null), // negative control — excluded
    ]);
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(3);
    expect(summary.hitRate).toBeCloseTo(2 / 2);
    expect(summary.mrr).toBeCloseTo((1 + 1 / 3) / 2);
  });

  it("counts failures and lists them", () => {
    const summary = summarize([verdict("ok", 1, 1), verdict("bad", 1, null)]);
    expect(summary.failed).toBe(1);
    expect(summary.failures.map((f) => f.id)).toEqual(["bad"]);
    expect(summary.hitRate).toBeCloseTo(0.5);
  });

  it("handles an empty run without dividing by zero", () => {
    const summary = summarize([]);
    expect(summary).toMatchObject({ total: 0, passed: 0, failed: 0, hitRate: 0, mrr: 0 });
  });
});
