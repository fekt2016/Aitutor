import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

vi.mock("@/models", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/models")>();
  return {
    ...actual,
    SkillModel: {
      findById: vi.fn(),
      find: vi.fn(),
    },
    ContentStandardModel: { findById: vi.fn() },
    SubStrandModel: { findById: vi.fn() },
    StrandModel: { findById: vi.fn() },
    LessonModel: { findOne: vi.fn() },
    PracticeItemModel: { find: vi.fn() },
    CurriculumChunkModel: {
      deleteMany: vi.fn(),
      insertMany: vi.fn(),
      updateOne: vi.fn(),
      find: vi.fn(),
    },
  };
});

import {
  SkillModel,
  ContentStandardModel,
  SubStrandModel,
  StrandModel,
  LessonModel,
  PracticeItemModel,
  CurriculumChunkModel,
} from "@/models";
import {
  buildSkillChunks,
  reindexSkillChunks,
  reindexAllCurriculum,
  saveEmbeddings,
} from "./chunker";

/* ------------------------------ fixtures ------------------------------ */

const skillId = new Types.ObjectId();
const lessonId = new Types.ObjectId();
const itemId = new Types.ObjectId();
const standardId = new Types.ObjectId();
const substrandId = new Types.ObjectId();
const strandId = new Types.ObjectId();
const subjectId = new Types.ObjectId();
const gradeLevelId = new Types.ObjectId();

function leanChain(doc: unknown) {
  return { lean: async () => doc } as never;
}

function sortedChain(docs: unknown[]) {
  return {
    select: () => ({ lean: async () => docs }),
    sort: () => ({ lean: async () => docs }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(SkillModel.findById).mockReturnValue(
    leanChain({
      _id: skillId,
      active: true,
      name: "Equivalent fractions",
      description: "Recognise fractions that show the same amount.",
      contentStandardId: standardId,
    })
  );
  vi.mocked(ContentStandardModel.findById).mockReturnValue(
    leanChain({ _id: standardId, substrandId, gradeLevelId, objective: "Identify equivalent fractions." })
  );
  vi.mocked(SubStrandModel.findById).mockReturnValue(leanChain({ _id: substrandId, strandId }));
  vi.mocked(StrandModel.findById).mockReturnValue(leanChain({ _id: strandId, subjectId }));
  vi.mocked(LessonModel.findOne).mockReturnValue(
    ({ sort: () => ({ lean: async () => ({
      _id: lessonId,
      title: "Fractions that look different but are the same",
      markdownBody: "A fraction shows parts of a whole.",
      examples: ["1/2 = 2/4", "2/3 = 4/6"],
    }) }) }) as never
  );
  vi.mocked(PracticeItemModel.find).mockReturnValue(
    sortedChain([
      {
        _id: itemId,
        prompt: "Which fraction is equivalent to 1/2?",
        options: ["2/3", "2/4"],
        answer: "2/4",
        explanation: "1/2 × 2/2 = 2/4.",
        difficulty: 2,
      },
    ])
  );
});

/* -------------------------------- tests -------------------------------- */

describe("buildSkillChunks", () => {
  it("derives definition, lesson, example and practice chunks", async () => {
    const drafts = await buildSkillChunks(skillId.toString());

    expect(drafts.map((d) => d.sourceType)).toEqual([
      "definition",
      "lesson",
      "example",
      "example",
      "practice",
    ]);
  });

  it("scopes every chunk to skill, subject and grade via the taxonomy chain", async () => {
    const drafts = await buildSkillChunks(skillId.toString());

    for (const draft of drafts) {
      expect(draft.skillId).toEqual(skillId);
      expect(draft.subjectId).toEqual(subjectId);
      expect(draft.gradeLevelId).toEqual(gradeLevelId);
    }
  });

  it("practice chunks carry prompt, answer and explanation for retrieval", async () => {
    const drafts = await buildSkillChunks(skillId.toString());
    const practice = drafts.find((d) => d.sourceType === "practice")!;

    expect(practice.sourceId).toEqual(itemId);
    expect(practice.content).toContain("Which fraction is equivalent to 1/2?");
    expect(practice.content).toContain("Answer: 2/4.");
    expect(practice.content).toContain("1/2 × 2/2 = 2/4.");
  });

  it("definition chunk combines skill description with the standard objective", async () => {
    const drafts = await buildSkillChunks(skillId.toString());
    const definition = drafts.find((d) => d.sourceType === "definition")!;

    expect(definition.title).toBe("Equivalent fractions");
    expect(definition.content).toContain("Recognise fractions that show the same amount.");
    expect(definition.content).toContain("Objective: Identify equivalent fractions.");
  });

  it("returns nothing for a missing or inactive skill", async () => {
    vi.mocked(SkillModel.findById).mockReturnValue(leanChain(null));
    await expect(buildSkillChunks(skillId.toString())).resolves.toEqual([]);

    vi.mocked(SkillModel.findById).mockReturnValue(leanChain({ _id: skillId, active: false }));
    await expect(buildSkillChunks(skillId.toString())).resolves.toEqual([]);
  });
});

describe("reindexSkillChunks", () => {
  it("replaces the skill's chunks: delete by scope, then insert fresh drafts", async () => {
    const count = await reindexSkillChunks(skillId.toString());

    expect(CurriculumChunkModel.deleteMany).toHaveBeenCalledWith({ skillId: skillId.toString() });
    expect(CurriculumChunkModel.insertMany).toHaveBeenCalledTimes(1);
    const inserted = vi.mocked(CurriculumChunkModel.insertMany).mock.calls[0][0] as unknown[];
    expect(inserted).toHaveLength(5);
    expect(count).toBe(5);
  });

  it("still clears old chunks when the skill yields no drafts", async () => {
    vi.mocked(SkillModel.findById).mockReturnValue(leanChain(null));

    const count = await reindexSkillChunks(skillId.toString());

    expect(count).toBe(0);
    expect(CurriculumChunkModel.deleteMany).toHaveBeenCalledWith({ skillId: skillId.toString() });
    expect(CurriculumChunkModel.insertMany).not.toHaveBeenCalled();
  });
});

describe("reindexAllCurriculum", () => {
  it("walks every active skill and sums written chunks", async () => {
    vi.mocked(SkillModel.find).mockReturnValue(sortedChain([{ _id: skillId }, { _id: itemId }]));

    const result = await reindexAllCurriculum();

    expect(result.skills).toBe(2);
    expect(result.chunks).toBe(10);
  });
});

describe("saveEmbeddings", () => {
  it("writes each vector to its chunk in order", async () => {
    await saveEmbeddings([{ _id: "a" }, { _id: "b" }], [
      [1, 2],
      [3, 4],
    ]);

    expect(CurriculumChunkModel.updateOne).toHaveBeenCalledTimes(2);
    expect(vi.mocked(CurriculumChunkModel.updateOne).mock.calls[0][0]).toEqual({ _id: "a" });
    expect(vi.mocked(CurriculumChunkModel.updateOne).mock.calls[0][1]).toEqual({
      $set: { embedding: [1, 2] },
    });
    expect(vi.mocked(CurriculumChunkModel.updateOne).mock.calls[1][0]).toEqual({ _id: "b" });
  });
});
