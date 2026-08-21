/**
 * Mastery engine v1 (plan §12.1) — transparent weighted score 0–100 per skill
 * with an evidence gate. Pure functions only (no I/O) → fully unit-tested.
 *
 * Scoring: exponential moving average, recent attempts weigh more; a bonus
 * applies for correct answers at higher difficulty. The evidence gate keeps a
 * lucky streak from faking mastery: "Mastered" requires score ≥81 AND ≥3
 * recent correct AND ≥1 spaced re-test.
 */
import { masteryBandForScore, type MasteryBand } from "@/models";

export interface MasteryState {
  score: number;
  evidenceCount: number;
  recentCorrect: number;
  retests: number;
}

export interface SignalInput {
  value: number; // 0..1 (correct=1, wrong=0, hint=0.5, concept_seen=0.25)
  difficulty: number; // 1..5
  /** First attempt on this skill (no prior evidence) — seeds the score. */
  firstAttempt?: boolean;
}

export const RECENT_CORRECT_WINDOW = 5;
export const MASTERY_GATE_CORRECT = 3;
export const MASTERY_GATE_RETESTS = 1;

const EMA_FACTOR = 0.8; // weight of history vs new evidence

export function difficultyFactor(difficulty: number): number {
  const clamped = Math.min(Math.max(difficulty, 1), 5);
  return 0.75 + 0.25 * ((clamped - 1) / 4); // 0.75..1.0
}

export function applySignal(
  state: MasteryState | null,
  signal: SignalInput
): MasteryState {
  const difficulty = Math.min(Math.max(signal.difficulty, 1), 5);
  const evidence = Math.min(Math.max(signal.value, 0), 1) * 100 * difficultyFactor(difficulty);
  const previous = state ?? { score: 0, evidenceCount: 0, recentCorrect: 0, retests: 0 };
  const firstAttempt = state === null;

  const score =
    firstAttempt || previous.evidenceCount === 0
      ? Math.round(evidence)
      : Math.round(EMA_FACTOR * previous.score + (1 - EMA_FACTOR) * evidence);

  // Rolling "recent correct" window: corrects add, wrongs push out one.
  const recentCorrect =
    evidence >= 50
      ? Math.min(previous.recentCorrect + 1, RECENT_CORRECT_WINDOW)
      : Math.max(previous.recentCorrect - 1, 0);

  // A graded attempt on an already-mastered skill counts as a spaced re-test.
  const retests = previous.retests + (previous.score >= 81 ? 1 : 0);

  return {
    score,
    evidenceCount: previous.evidenceCount + 1,
    recentCorrect,
    retests,
  };
}

/** The evidence gate: band = mastered only with score + ≥3 recent correct + ≥1 re-test. */
export function gatedBand(state: MasteryState): MasteryBand {
  const raw = masteryBandForScore(state.score);
  if (raw === "mastered") {
    if (state.recentCorrect < MASTERY_GATE_CORRECT || state.retests < MASTERY_GATE_RETESTS) {
      return "progressing"; // score high, evidence not proven yet
    }
  }
  return raw;
}

/** One mastery line for the long-term memory block (§13) — no PII, no transcripts. */
export function masterySummaryLine(skillName: string, state: MasteryState): string {
  const band = gatedBand(state);
  return `${skillName}: ${band} (score ${state.score}, ${state.evidenceCount} evidence points)`;
}