import { describe, it, expect, vi, afterEach } from "vitest";
import { CurriculumChunkModel } from "@/models";
import {
  augmentWithSupportingMaterial,
  renderSupportingMaterial,
  THIN_LESSON_CHARS,
} from "./grounding";
import type { CurriculumBundle } from "./service";

/**
 * §6.3 grounding — thin lessons get supporting curriculum material folded in
 * (before the memory builder's budget clamp); retrieval failures never break
 * a turn; thick lessons are left untouched.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function bundle(lessonBody: string): CurriculumBundle {
  return {
    subjectName: "Mathematics",
    skillId: "skill-1",
    skillCode: "M1.1",
    skillName: "Add within 20",
    objective: "Add and subtract within 20",
    lessonTitle: "Counting on",
    lessonBody,
    examples: [],
    items: [],
    masteryLines: [],
  };
}

function mockHits(count: number) {
  return vi.spyOn(CurriculumChunkModel, "aggregate").mockResolvedValue(
    Array.from({ length: count }, (_, i) => ({
      _id: `id-${i}`,
      sourceType: "definition",
      sourceId: "src-1",
      title: `Definition ${i}`,
      content: `Supporting explanation ${i}`,
      score: 1 + i,
    }))
  );
}

function row(overrides: Partial<{ title: string; content: string }> = {}) {
  return {
    _id: "row-1",
    sourceType: "definition",
    sourceId: "src-1",
    title: overrides.title ?? "Counting on",
    content: overrides.content ?? "Count on from the bigger number to add quickly.",
    score: 1,
  };
}

describe("augmentWithSupportingMaterial", () => {
  it("folds supporting material into a thin lesson body", async () => {
    mockHits(2);
    const b = bundle("Short lesson.");

    await augmentWithSupportingMaterial(b, {});

    expect(b.lessonBody).toContain("SUPPORTING MATERIAL FROM THE CURRICULUM:");
    expect(b.lessonBody).toContain("- Definition 0: Supporting explanation 0");
    expect(b.lessonBody).toContain("- Definition 1: Supporting explanation 1");
  });

  it("leaves a full lesson untouched and does not call retrieval", async () => {
    const aggregate = vi.spyOn(CurriculumChunkModel, "aggregate");
    const body = "A complete lesson. ".repeat(40); // > THIN_LESSON_CHARS
    expect(body.length).toBeGreaterThan(THIN_LESSON_CHARS);
    const b = bundle(body);

    await augmentWithSupportingMaterial(b, {});

    expect(b.lessonBody).toBe(body);
    expect(aggregate).not.toHaveBeenCalled();
  });

  it("retrieval failure never breaks the turn — body stands alone", async () => {
    vi.spyOn(CurriculumChunkModel, "aggregate").mockRejectedValue(new Error("atlas down"));
    vi.spyOn(CurriculumChunkModel, "find").mockImplementation((() => {
      throw new Error("no text index");
    }) as never);
    const b = bundle("Short lesson.");

    await expect(augmentWithSupportingMaterial(b, {})).resolves.toBeUndefined();
    expect(b.lessonBody).toBe("Short lesson.");
  });

  it("zero hits leaves the body unchanged", async () => {
    vi.spyOn(CurriculumChunkModel, "aggregate").mockResolvedValue([]);
    vi.spyOn(CurriculumChunkModel, "find").mockReturnValue({
      sort: () => ({ limit: () => ({ lean: async () => [] }) }),
    } as never);
    const b = bundle("Short lesson.");

    await augmentWithSupportingMaterial(b, {});

    expect(b.lessonBody).toBe("Short lesson.");
  });

  it("full lesson + substantive question retrieves from the QUESTION, not the skill name", async () => {
    const aggregate = vi
      .spyOn(CurriculumChunkModel, "aggregate")
      .mockResolvedValue([{ ...row(), title: "Numerator", content: "Top number of a fraction.", score: 2 }]);
    const b = bundle("A complete lesson body. ".repeat(40));

    await augmentWithSupportingMaterial(b, { userMessage: "What is a numerator in a fraction?" });

    expect(b.lessonBody).toContain("SUPPORTING MATERIAL FROM THE CURRICULUM:");
    expect(b.lessonBody).toContain("Top number of a fraction.");
    // The query sent to $search is derived from the child's question.
    const pipeline = aggregate.mock.calls[0][0] as unknown as Array<Record<string, unknown>>;
    expect(JSON.stringify(pipeline[0])).toContain("numerator");
  });

  it("full lesson + tiny question does not retrieve at all", async () => {
    const aggregate = vi.spyOn(CurriculumChunkModel, "aggregate");
    const body = "A complete lesson body. ".repeat(40);
    const b = bundle(body);

    await augmentWithSupportingMaterial(b, { userMessage: "ok" });

    expect(b.lessonBody).toBe(body);
    expect(aggregate).not.toHaveBeenCalled();
  });
});

describe("renderSupportingMaterial", () => {
  it("includes titles when present, bare content otherwise", () => {
    const text = renderSupportingMaterial([
      { chunkId: "1", sourceType: "definition", sourceId: "s", title: "T", content: "C1" },
      { chunkId: "2", sourceType: "example", sourceId: "s", title: "", content: "C2" },
    ]);
    expect(text).toBe("- T: C1\n- C2");
  });
});
