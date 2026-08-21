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
