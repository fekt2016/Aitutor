/**
 * Eval scorers (plan §36) — pure functions over retrieval results so the
 * same relevance math runs in the live runner and in hermetic tests.
 * No I/O, no models, no mocks — data in, verdicts out.
 */
import type { CurriculumHit } from "../src/features/tutor/curriculum/retrieval";
import type { RetrievalScenario } from "./scenarios";

/** Case-insensitive "contains every term" over a plain text blob. */
export function textMentions(text: string, terms: string[]): boolean {
  const haystack = text.toLowerCase();
  return terms.every((term) => haystack.includes(term.toLowerCase()));
}

/** Case-insensitive "contains every term" over title + content. */
export function hitMentions(hit: CurriculumHit, terms: string[]): boolean {
  return textMentions(`${hit.title}\n${hit.content}`, terms);
}

/** A hit is relevant when ANY keyword group fully matches. */
export function isRelevantHit(hit: CurriculumHit, expectAny: string[][]): boolean {
  return expectAny.some((group) => hitMentions(hit, group));
}

export interface ScenarioVerdict {
  id: string;
  dimension: string;
  query: string;
  /** Ranks (1-based) of relevant hits within the returned top-k. */
  relevantRanks: number[];
  /** Total hits returned (may be < k). */
  returned: number;
  /** The scenario's own pass bar (0 marks a negative control). */
  minRelevant: number;
  passed: boolean;
}

export function scoreRetrievalScenario(
  scenario: RetrievalScenario,
  hits: CurriculumHit[]
): ScenarioVerdict {
  const relevantRanks = hits
    .map((hit, index) => ({ hit, rank: index + 1 }))
    .filter(({ hit }) => isRelevantHit(hit, scenario.expectAny))
    .map(({ rank }) => rank);

  return {
    id: scenario.id,
    dimension: scenario.dimension,
    query: scenario.query,
    relevantRanks,
    returned: hits.length,
    minRelevant: scenario.minRelevant,
    // Positive scenarios need ≥ minRelevant relevant hits; a negative control
    // (minRelevant 0) passes only when NO hit matched its keywords.
    passed:
      scenario.minRelevant > 0
        ? relevantRanks.length >= scenario.minRelevant
        : relevantRanks.length === 0,
  };
}

export interface RetrievalSummary {
  total: number;
  passed: number;
  failed: number;
  /** Positive scenarios with ≥1 relevant hit ÷ positive scenarios. */
  hitRate: number;
  /** Mean 1/rank of first relevant hit across positives (0 when none). */
  mrr: number;
  failures: ScenarioVerdict[];
}

/**
 * Aggregates verdicts. Hit-rate and MRR cover POSITIVE scenarios only —
 * negative controls (minRelevant 0) assert absence of relevance and carry no
 * recall signal.
 */
export function summarize(verdicts: ScenarioVerdict[]): RetrievalSummary {
  const positives = verdicts.filter((v) => v.minRelevant > 0);
  const hitsFound = positives.filter((v) => v.relevantRanks.length > 0).length;
  const mrr =
    positives.length === 0
      ? 0
      : positives.reduce((sum, v) => sum + (v.relevantRanks[0] ? 1 / v.relevantRanks[0] : 0), 0) /
        positives.length;

  return {
    total: verdicts.length,
    passed: verdicts.filter((v) => v.passed).length,
    failed: verdicts.filter((v) => !v.passed).length,
    hitRate: positives.length === 0 ? 0 : hitsFound / positives.length,
    mrr,
    failures: verdicts.filter((v) => !v.passed),
  };
}
