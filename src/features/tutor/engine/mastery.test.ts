import { describe, it, expect } from "vitest";
import {
  applySignal,
  gatedBand,
  masterySummaryLine,
  difficultyFactor,
  MASTERY_GATE_CORRECT,
  MASTERY_GATE_RETESTS,
} from "./mastery";

describe("difficultyFactor", () => {
  it("ranges 0.75..1.0 across difficulty 1..5", () => {
    expect(difficultyFactor(1)).toBe(0.75);
    expect(difficultyFactor(5)).toBe(1);
    expect(difficultyFactor(3)).toBe(0.875);
  });

  it("clamps out-of-range input", () => {
    expect(difficultyFactor(0)).toBe(0.75);
    expect(difficultyFactor(99)).toBe(1);
  });
});

describe("applySignal — scoring math", () => {
  it("seeds the score from the first attempt (value × difficulty factor)", () => {
    const state = applySignal(null, { value: 1, difficulty: 3 });
    expect(state.score).toBe(88); // 100 × 0.875
    expect(state.evidenceCount).toBe(1);
    expect(state.recentCorrect).toBe(1);
  });

  it("first wrong answer scores 0", () => {
    const state = applySignal(null, { value: 0, difficulty: 3 });
    expect(state.score).toBe(0);
    expect(state.recentCorrect).toBe(0);
  });

  it("moves toward recent evidence (EMA: history weighs more)", () => {
    const seeded = applySignal(null, { value: 1, difficulty: 3 }); // 88
    const afterWrong = applySignal(seeded, { value: 0, difficulty: 3 });
    expect(afterWrong.score).toBe(70); // 0.8×88 + 0.2×0
    expect(afterWrong.evidenceCount).toBe(2);
    expect(afterWrong.recentCorrect).toBe(0); // wrong pushed out a correct
  });

  it("correct answers at higher difficulty score higher than easier ones", () => {
    const easy = applySignal(null, { value: 1, difficulty: 1 });
    const hard = applySignal(null, { value: 1, difficulty: 5 });
    expect(hard.score).toBeGreaterThan(easy.score);
  });

  it("hint_used (0.5) contributes partial evidence", () => {
    const state = applySignal(null, { value: 0.5, difficulty: 3 });
    expect(state.score).toBe(44); // 50 × 0.875
  });
});

describe("gatedBand — the evidence gate (§12.1)", () => {
  it("keeps a high score at progressing until ≥3 recent correct", () => {
    let state: ReturnType<typeof applySignal> | null = null;
    state = applySignal(state, { value: 1, difficulty: 3 }); // 88
    state = applySignal(state, { value: 1, difficulty: 3 }); // 90
    expect(state.score).toBeGreaterThanOrEqual(81);
    expect(state.recentCorrect).toBeLessThan(MASTERY_GATE_CORRECT);
    expect(gatedBand(state)).toBe("progressing"); // not yet mastered
  });

  it("mastered only after the full gate: score + corrects + re-test", () => {
    let state: ReturnType<typeof applySignal> | null = null;
    state = applySignal(state, { value: 1, difficulty: 3 }); // 88
    state = applySignal(state, { value: 1, difficulty: 3 });
    expect(gatedBand(state)).toBe("progressing"); // only 2 recent corrects
    state = applySignal(state, { value: 1, difficulty: 3 }); // 3rd correct
    expect(state.recentCorrect).toBe(MASTERY_GATE_CORRECT);
    expect(state.retests).toBeGreaterThanOrEqual(MASTERY_GATE_RETESTS);
    expect(gatedBand(state)).toBe("mastered");
  });

  it("a wrong answer in the streak delays mastery (gate is evidence, not luck)", () => {
    const correct = { value: 1, difficulty: 3 };
    const wrong = { value: 0, difficulty: 3 };
    let state: ReturnType<typeof applySignal> | null = null;
    for (const signal of [correct, correct, wrong, correct, correct]) {
      state = applySignal(state, signal);
    }
    expect(state!.recentCorrect).toBe(3);
    expect(state!.score).toBe(77);
    expect(gatedBand(state!)).toBe("progressing"); // setback pushed mastery back
    // Two more corrects recover past the gate.
    state = applySignal(state, correct);
    state = applySignal(state, correct);
    expect(gatedBand(state)).toBe("mastered");
  });

  it("recently-wrong answers drop the band even though the EMA score is high", () => {
    let state: ReturnType<typeof applySignal> | null = null;
    for (let i = 0; i < MASTERY_GATE_CORRECT; i += 1) {
      state = applySignal(state, { value: 1, difficulty: 3 }); // mastered
    }
    state = applySignal(state, { value: 0, difficulty: 3 }); // then a setback
    expect(state.score).toBe(70);
    expect(gatedBand(state)).toBe("progressing"); // no longer mastered
  });

  it("maps low scores to needs_support / developing", () => {
    const low = applySignal(null, { value: 0, difficulty: 3 });
    expect(gatedBand(low)).toBe("needs_support");
    const developing = applySignal(null, { value: 0.6, difficulty: 3 }); // 52
    expect(gatedBand(developing)).toBe("developing");
  });
});

describe("masterySummaryLine (§13 long-term block)", () => {
  it("emits a PII-free one-line summary", () => {
    const state = applySignal(null, { value: 1, difficulty: 5 });
    expect(masterySummaryLine("Adding within 20", state)).toMatch(
      /Adding within 20: (progressing|mastered) \(score \d+, 1 evidence points\)/
    );
  });
});