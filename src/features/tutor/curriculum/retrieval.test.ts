import { describe, it, expect, vi, afterEach } from "vitest";
import mongoose from "mongoose";
import { CurriculumChunkModel } from "@/models";
import { searchCurriculum, ATLAS_SEARCH_INDEX } from "./retrieval";

/**
 * §14 retrieval — three tiers with graceful degradation:
 *   A: Atlas $search (M10+ only) → B: $text index → C: escaped regex.
 * The M0 dev cluster has neither Atlas Search nor (initially) a text index,
 * so tier C must work standalone. Retrieval never throws to callers.
 */

afterEach(() => {
  vi.restoreAllMocks();
});

function row(overrides: Partial<{ title: string; content: string }> = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    sourceType: "definition",
    sourceId: new mongoose.Types.ObjectId(),
    title: overrides.title ?? "Counting on",
    content: overrides.content ?? "Count on from the bigger number to add quickly.",
    active: true,
  };
}

describe("searchCurriculum — tier degradation", () => {
  it("tier A: uses Atlas $search and maps scored hits", async () => {
    const aggregate = vi.fn().mockResolvedValue([{ ...row(), score: 2.5 }]);
    vi.spyOn(CurriculumChunkModel, "aggregate").mockImplementation(aggregate);
    const find = vi.spyOn(CurriculumChunkModel, "find").mockImplementation((() => {
      throw new Error("should not be called");
    }) as never);

    const hits = await searchCurriculum({ query: "counting on", limit: 3 });

    expect(hits).toHaveLength(1);
    expect(hits[0].score).toBe(2.5);
    expect(hits[0].title).toBe("Counting on");
    expect(aggregate.mock.calls[0][0][0]).toHaveProperty("$search.index", ATLAS_SEARCH_INDEX);
    expect(find).not.toHaveBeenCalled();
  });

  it("falls back when Atlas Search is unavailable (M0) and uses the text index", async () => {
    vi.spyOn(CurriculumChunkModel, "aggregate").mockRejectedValue(
      new Error("Unrecognized pipeline stage name: $search")
    );
    const find = vi
      .spyOn(CurriculumChunkModel, "find")
      .mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [row()] }) }) } as never);

    const hits = await searchCurriculum({ query: "counting on addition" });

    expect(hits).toHaveLength(1);
    const query = find.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(query.$text).toEqual({ $search: "counting on addition" });
  });

  it("tier C: regex term match works when even the text index is missing", async () => {
    vi.spyOn(CurriculumChunkModel, "aggregate").mockRejectedValue(new Error("no atlas"));
    const find = vi
      .spyOn(CurriculumChunkModel, "find")
      .mockImplementation(((query: Record<string, unknown>) => {
        if (query.$text) throw new Error("text index not found");
        return {
          sort: () => ({ limit: () => ({ lean: async () => [row({ content: "Fractions with like denominators" })] }) }),
        };
      }) as never);

    const hits = await searchCurriculum({ query: "equivalent fractions!" });

    expect(hits).toHaveLength(1);
    expect(hits[0].content).toContain("Fractions");
    // Terms are escaped + filtered to length ≥3, OR-combined over title/content.
    const query = find.mock.calls[1][0] as unknown as { $or: Array<Record<string, RegExp>> };
    expect(query.$or.some((c) => c.content?.source === "fractions")).toBe(true);
  });

  it("clamps oversized hit content to the per-hit budget", async () => {
    vi.spyOn(CurriculumChunkModel, "aggregate").mockResolvedValue([
      { ...row(), content: "x".repeat(2000), score: 1 },
    ]);

    const hits = await searchCurriculum({ query: "anything" });

    expect(hits[0].content.length).toBeLessThanOrEqual(1201); // 1200 + ellipsis
    expect(hits[0].content.endsWith("…")).toBe(true);
  });

  it("applies scope filters (subject/skill/grade) as ObjectIds", async () => {
    const aggregate = vi.fn().mockResolvedValue([]);
    vi.spyOn(CurriculumChunkModel, "aggregate").mockImplementation(aggregate);

    await searchCurriculum({
      query: "fractions",
      subjectId: new mongoose.Types.ObjectId().toString(),
      skillId: "not-an-id", // invalid ids are dropped, not thrown on
      gradeLevelId: new mongoose.Types.ObjectId().toString(),
    });

    const match = aggregate.mock.calls[0][0].find((stage: Record<string, unknown>) => stage.$match);
    expect(match.$match.active).toBe(true);
    expect(match.$match.skillId).toBeUndefined();
    expect(match.$match.subjectId).toBeInstanceOf(mongoose.Types.ObjectId);
  });
});
