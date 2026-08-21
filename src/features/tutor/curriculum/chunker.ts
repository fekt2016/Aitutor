/**
 * Curriculum chunker (plan §6.2, §14) — derives retrievable CurriculumChunk
 * documents from the structured curriculum (Skill → Lesson → PracticeItem).
 * The tutor reasons over these chunks; it never invents curriculum.
 *
 * Re-indexing is idempotent the same way seeding is: per skill we DELETE the
 * skill's chunks and INSERT fresh drafts. Embeddings are backfilled separately
 * (scripts/backfill-chunks.ts --embed), so a re-index marks chunks for
 * re-embedding by leaving `embedding` null.
 */
import { Types } from "mongoose";
import {
  ContentStandardModel,
  CurriculumChunkModel,
  LessonModel,
  PracticeItemModel,
  SkillModel,
  StrandModel,
  SubStrandModel,
} from "@/models";
import type { ChunkSourceType } from "@/models";

export interface ChunkDraft {
  sourceType: ChunkSourceType;
  sourceId: Types.ObjectId;
  skillId: Types.ObjectId;
  subjectId: Types.ObjectId | null;
  gradeLevelId: Types.ObjectId | null;
  title: string;
  content: string;
}

export interface ReindexResult {
  skills: number;
  chunks: number;
}

/** Resolves subjectId for a skill via standard → substrand → strand. */
async function resolveSubjectId(
  contentStandardId: Types.ObjectId
): Promise<Types.ObjectId | null> {
  const standard = await ContentStandardModel.findById(contentStandardId).lean();
  if (!standard?.substrandId) return null;
  const subStrand = await SubStrandModel.findById(standard.substrandId).lean();
  if (!subStrand?.strandId) return null;
  const strand = await StrandModel.findById(subStrand.strandId).lean();
  return strand?.subjectId ?? null;
}

/** Builds every chunk draft for one skill (no writes). */
export async function buildSkillChunks(skillId: string): Promise<ChunkDraft[]> {
  const skill = await SkillModel.findById(skillId).lean();
  if (!skill || !skill.active) return [];

  const [standard, lesson, items] = await Promise.all([
    ContentStandardModel.findById(skill.contentStandardId).lean(),
    LessonModel.findOne({ skillId: skill._id, active: true }).sort({ sortOrder: 1 }).lean(),
    PracticeItemModel.find({ skillId: skill._id, active: true }).sort({ difficulty: 1 }).lean(),
  ]);

  const subjectId = await resolveSubjectId(skill.contentStandardId);
  const gradeLevelId = standard?.gradeLevelId ?? null;
  const base = {
    skillId: skill._id,
    subjectId,
    gradeLevelId,
  };

  const drafts: ChunkDraft[] = [];

  // definition — what the skill is + what the curriculum wants it to achieve.
  const objective = standard?.objective ?? "";
  const definition = [skill.description, objective ? `Objective: ${objective}` : ""]
    .filter(Boolean)
    .join(" ");
  if (definition) {
    drafts.push({
      ...base,
      sourceType: "definition",
      sourceId: skill._id,
      title: skill.name,
      content: definition,
    });
  }

  // lesson — the teaching body.
  if (lesson?.markdownBody) {
    drafts.push({
      ...base,
      sourceType: "lesson",
      sourceId: lesson._id,
      title: lesson.title,
      content: lesson.markdownBody,
    });
    // example — one chunk per worked example for fine-grained retrieval.
    for (const example of lesson.examples ?? []) {
      if (!example.trim()) continue;
      drafts.push({
        ...base,
        sourceType: "example",
        sourceId: lesson._id,
        title: `${lesson.title} — example`,
        content: example,
      });
    }
  }

  // practice — prompt + answer + explanation teaches the reasoning.
  for (const item of items) {
    const content = [
      item.prompt,
      item.answer ? `Answer: ${item.answer}.` : "",
      item.explanation,
    ]
      .filter(Boolean)
      .join(" ");
    if (!content.trim()) continue;
    drafts.push({
      ...base,
      sourceType: "practice",
      sourceId: item._id,
      title: `Practice: ${skill.name}`,
      content,
    });
  }

  return drafts;
}

/**
 * Re-indexes one skill: replaces all its chunks atomically-ish (delete then
 * insert; a failure between the two leaves the skill unindexed, which the
 * next run repairs). Returns the number of chunks written.
 */
export async function reindexSkillChunks(skillId: string): Promise<number> {
  const drafts = await buildSkillChunks(skillId);
  await CurriculumChunkModel.deleteMany({ skillId });
  if (drafts.length > 0) {
    await CurriculumChunkModel.insertMany(drafts);
  }
  return drafts.length;
}

/** Re-indexes every active skill in the curriculum. */
export async function reindexAllCurriculum(): Promise<ReindexResult> {
  const skills = await SkillModel.find({ active: true }).select("_id").lean();
  let chunks = 0;
  for (const skill of skills) {
    chunks += await reindexSkillChunks(skill._id.toString());
  }
  return { skills: skills.length, chunks };
}

/** Chunks still missing their embedding (backfill targets). */
export async function findUnembeddedChunks(
  limit = 200
): Promise<Array<{ _id: unknown; content: string }>> {
  return CurriculumChunkModel.find({ embedding: null })
    .select("_id content")
    .limit(limit)
    .lean() as unknown as Array<{ _id: unknown; content: string }>;
}

/** Persists vectors by chunk id, same order as the input ids. */
export async function saveEmbeddings(
  ids: Array<{ _id: unknown }>,
  vectors: number[][]
): Promise<void> {
  await Promise.all(
    ids.map((chunk, i) =>
      CurriculumChunkModel.updateOne(
        { _id: chunk._id as Types.ObjectId },
        { $set: { embedding: vectors[i] } }
      )
    )
  );
}
