import { describe, it, expect } from "vitest";
import {
  recentTurns,
  buildConversationBlock,
  buildLongTermBlock,
  buildContextBundle,
  SHORT_TERM_MESSAGE_LIMIT,
  CURRICULUM_CHAR_LIMIT,
} from "./builder";

const fakeMessages = [
  { role: "system", content: "intro", createdAt: new Date(1) },
  { role: "user", content: "hi", createdAt: new Date(2) },
  { role: "assistant", content: "Hello! Ready?", createdAt: new Date(3) },
  { role: "user", content: "what is 3 + 5?", createdAt: new Date(4) },
] as never[];

describe("recentTurns (§13 short-term budget)", () => {
  it("keeps only user/assistant turns, newest first, reordered oldest→newest", () => {
    const turns = recentTurns(fakeMessages);
    expect(turns).toHaveLength(3);
    expect(turns[0].role).toBe("user");
    expect(turns[0].text).toBe("hi");
    expect(turns[2].role).toBe("user");
    expect(turns[2].text).toBe("what is 3 + 5?");
  });

  it("caps the window at SHORT_TERM_MESSAGE_LIMIT", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `msg ${i}`, createdAt: new Date(i) }));
    const turns = recentTurns(many as never[]);
    expect(turns.length).toBeLessThanOrEqual(SHORT_TERM_MESSAGE_LIMIT);
  });

  it("drops empty messages", () => {
    const turns = recentTurns(
      [
        { role: "user", content: "" },
        { role: "assistant", content: "real" },
      ] as never[]
    );
    expect(turns).toHaveLength(1);
  });
});

describe("buildConversationBlock", () => {
  it("labels STUDENT/EAZI lines", () => {
    const block = buildConversationBlock([
      { role: "user", text: "hi" },
      { role: "assistant", text: "Hello!" },
    ]);
    expect(block).toContain("STUDENT: hi");
    expect(block).toContain("EAZI: Hello!");
  });

  it("explains an empty conversation", () => {
    expect(buildConversationBlock([])).toContain("none yet");
  });
});

describe("buildLongTermBlock (§13)", () => {
  it("never exposes raw transcripts — only mastery lines", () => {
    const block = buildLongTermBlock({ lines: ["Adding within 20: progressing (score 88, 4 evidence points)"] });
    expect(block).toContain("Adding within 20");
    expect(block).not.toContain("STUDENT:");
  });

  it("caps at 3 highlights", () => {
    const block = buildLongTermBlock({ lines: ["a", "b", "c", "d"] });
    expect(block).toContain("a\nb\nc");
    expect(block).not.toContain("\nd");
  });
});

describe("buildContextBundle — fixed budget", () => {
  const student = {
    name: "Kojo",
    ageBand: "8-9",
    gradeName: "Basic 3",
    vocabularyLevel: 3,
    explanationDepth: 3,
    interactionStyle: "playful",
    preferences: [],
  };
  const curriculum = {
    skillName: "Adding within 20",
    objective: "Add numbers up to 20",
    lessonTitle: "Counting on",
    lessonBody: "We can count on from the bigger number. ".repeat(200), // > budget
    examples: ["3 + 5 = 8"],
  };

  it("assembles all four blocks in order", () => {
    const bundle = buildContextBundle({ student, curriculum, turns: [], highlights: { lines: [] } });
    expect(bundle.student).toContain("Kojo");
    expect(bundle.conversation).toContain("none yet");
    expect(bundle.longTerm).toContain("no prior mastery");
    expect(bundle.curriculum).toContain("Counting on");
  });

  it("clamps the curriculum lesson to the char budget", () => {
    const bundle = buildContextBundle({ student, curriculum, turns: [], highlights: { lines: [] } });
    // Body is clamped to CURRICULUM_CHAR_LIMIT; the block only adds small labels.
    expect(bundle.curriculum.length).toBeLessThan(CURRICULUM_CHAR_LIMIT + 400);
    expect(bundle.curriculum).toContain("lesson continues");
  });
});