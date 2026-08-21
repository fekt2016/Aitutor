/**
 * Curriculum admin service (plan §27, Phase 2) — read-side assembly for the
 * admin editor: the full taxonomy tree and the grounded lesson view.
 *
 * The grounded view shows EXACTLY what the tutor sees for a skill — the
 * resolved CurriculumBundle (what gets composed into prompts) plus the
 * skill's CurriculumChunks (what retrieval can find) — so an admin can
 * verify grounding without a child session. Read-only, no PII.
 */
import { AppError } from "@/lib/errors";
import {
  ContentStandardModel,
  CurriculumChunkModel,
  GradeLevelModel,
  LessonModel,
  PracticeItemModel,
  SkillModel,
  StrandModel,
  SubStrandModel,
  SubjectModel,
} from "@/models";
import { loadCurriculumBundle } from "@/features/tutor/curriculum/service";

export interface TreeSkill {
  id: string;
  code: string;
  name: string;
  active: boolean;
}
export interface TreeStandard {
  id: string;
  code: string;
  objective: string;
  gradeLevelId: string;
  skills: TreeSkill[];
}
export interface TreeSubStrand {
  id: string;
  name: string;
  standards: TreeStandard[];
}
export interface TreeStrand {
  id: string;
  name: string;
  subStrands: TreeSubStrand[];
}
export interface TreeSubject {
  id: string;
  name: string;
  strands: TreeStrand[];
}
export interface CurriculumTree {
  subjects: TreeSubject[];
  gradeLevels: Array<{ id: string; name: string }>;
}

/** Full taxonomy in one call — the corpus is small for years (§14). */
export async function getCurriculumTree(): Promise<CurriculumTree> {
  const [subjects, strands, subStrands, standards, skills, gradeLevels] = await Promise.all([
    SubjectModel.find({ active: true }).sort({ sortOrder: 1 }).lean(),
    StrandModel.find().sort({ sortOrder: 1 }).lean(),
    SubStrandModel.find().sort({ sortOrder: 1 }).lean(),
    ContentStandardModel.find().sort({ code: 1 }).lean(),
    SkillModel.find().sort({ code: 1 }).lean(),
    GradeLevelModel.find().sort({ minAge: 1 }).lean(),
  ]);

  const skillsByStandard = new Map<string, TreeSkill[]>();
  for (const skill of skills) {
    const key = skill.contentStandardId.toString();
    const list = skillsByStandard.get(key) ?? [];
    list.push({
      id: skill._id.toString(),
      code: skill.code,
      name: skill.name,
      active: skill.active,
    });
    skillsByStandard.set(key, list);
  }

  const standardsBySubStrand = new Map<string, TreeStandard[]>();
  for (const standard of standards) {
    const key = standard.substrandId.toString();
    const list = standardsBySubStrand.get(key) ?? [];
    list.push({
      id: standard._id.toString(),
      code: standard.code,
      objective: standard.objective,
      gradeLevelId: standard.gradeLevelId.toString(),
      skills: skillsByStandard.get(standard._id.toString()) ?? [],
    });
    standardsBySubStrand.set(key, list);
  }

  const subStrandsByStrand = new Map<string, TreeSubStrand[]>();
  for (const subStrand of subStrands) {
    const key = subStrand.strandId.toString();
    const list = subStrandsByStrand.get(key) ?? [];
    list.push({
      id: subStrand._id.toString(),
      name: subStrand.name,
      standards: standardsBySubStrand.get(subStrand._id.toString()) ?? [],
    });
    subStrandsByStrand.set(key, list);
  }

  const strandsBySubject = new Map<string, TreeStrand[]>();
  for (const strand of strands) {
    const key = strand.subjectId.toString();
    const list = strandsBySubject.get(key) ?? [];
    list.push({
      id: strand._id.toString(),
      name: strand.name,
      subStrands: subStrandsByStrand.get(strand._id.toString()) ?? [],
    });
    strandsBySubject.set(key, list);
  }

  return {
    subjects: subjects.map((subject) => ({
      id: subject._id.toString(),
      name: subject.name,
      strands: strandsBySubject.get(subject._id.toString()) ?? [],
    })),
    gradeLevels: gradeLevels.map((grade) => ({
      id: grade._id.toString(),
      name: grade.name,
    })),
  };
}

export interface GroundedView {
  bundle: Awaited<ReturnType<typeof loadCurriculumBundle>>;
  /** Raw lesson rows so the editor can edit them (ids included). */
  lessons: Array<{
    id: string;
    title: string;
    markdownBody: string;
    examples: string[];
    active: boolean;
  }>;
  /** Raw practice items so the editor can edit them (ids included). */
  items: Array<{
    id: string;
    type: string;
    prompt: string;
    options: string[];
    answer: string;
    explanation: string;
    difficulty: number;
    active: boolean;
  }>;
  chunks: Array<{
    id: string;
    sourceType: string;
    title: string;
    content: string;
    embedded: boolean;
  }>;
}

/**
 * The grounded lesson view: what the tutor composes for this skill
 * (bundle) + what retrieval can find (chunks). 404s on unknown skills.
 */
export async function getGroundedView(skillId: string): Promise<GroundedView> {
  const skill = await SkillModel.findById(skillId).lean();
  if (!skill) throw AppError.notFound("That skill does not exist.");

  // A synthetic preview identity — loadCurriculumBundle only reads
  // subject/skill lookups plus mastery for studentId (none for "admin-preview").
  const subjectId = await resolveSubjectIdForSkill(skill);
  if (!subjectId) throw AppError.notFound("That skill's subject could not be resolved.");
  const subject = await SubjectModel.findById(subjectId).select("name").lean();
  if (!subject) throw AppError.notFound("That skill's subject could not be resolved.");

  const [bundle, lessons, items, chunks] = await Promise.all([
    loadCurriculumBundle(subjectId, subject.name, skillId, "admin-preview"),
    LessonModel.find({ skillId: skill._id }).sort({ sortOrder: 1 }).lean(),
    PracticeItemModel.find({ skillId: skill._id }).sort({ difficulty: 1 }).lean(),
    CurriculumChunkModel.find({ skillId: skill._id })
      .select("sourceType title content embedding")
      .sort({ sourceType: 1 })
      .lean(),
  ]);

  return {
    bundle,
    lessons: lessons.map((lesson) => ({
      id: lesson._id.toString(),
      title: lesson.title,
      markdownBody: lesson.markdownBody,
      examples: lesson.examples ?? [],
      active: lesson.active,
    })),
    items: items.map((item) => ({
      id: item._id.toString(),
      type: item.type,
      prompt: item.prompt,
      options: item.options ?? [],
      answer: item.answer,
      explanation: item.explanation,
      difficulty: item.difficulty,
      active: item.active,
    })),
    chunks: chunks.map((chunk) => ({
      id: chunk._id.toString(),
      sourceType: chunk.sourceType,
      title: chunk.title,
      content: chunk.content,
      embedded: Array.isArray(chunk.embedding) && chunk.embedding.length > 0,
    })),
  };
}

async function resolveSubjectIdForSkill(
  skill: { _id: unknown; contentStandardId: unknown }
): Promise<string | null> {
  const standard = await ContentStandardModel.findById(skill.contentStandardId)
    .select("substrandId")
    .lean();
  if (!standard?.substrandId) return null;
  const subStrand = await SubStrandModel.findById(standard.substrandId)
    .select("strandId")
    .lean();
  if (!subStrand?.strandId) return null;
  const strand = await StrandModel.findById(subStrand.strandId)
    .select("subjectId")
    .lean();
  return strand?.subjectId ? strand.subjectId.toString() : null;
}

/** Lesson + item counts for a skill — used by the editor's skill panel. */
export async function getSkillContentCounts(
  skillId: string
): Promise<{ lessons: number; items: number }> {
  const [lessons, items] = await Promise.all([
    LessonModel.countDocuments({ skillId }),
    PracticeItemModel.countDocuments({ skillId }),
  ]);
  return { lessons, items };
}
