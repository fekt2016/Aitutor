/**
 * Curriculum service (plan §6.3, §14) — MVP uses structured queries only
 * (session context already tells us the skill); Atlas Search/Vector retrieval
 * arrives in Phase 2. Deterministic skill picking: the grade's content
 * standard first, then any active skill in the subject.
 */
import { AppError } from "@/lib/errors";
import mongoose from "mongoose";
import {
  ContentStandardModel,
  LessonModel,
  PracticeItemModel,
  SkillModel,
  SkillMasteryModel,
  StrandModel,
  SubStrandModel,
  SubjectModel,
  TutorSessionModel,
  type TutorSessionDoc,
} from "@/models";
import { masterySummaryLine, type MasteryState } from "../engine/mastery";

export interface CurriculumBundle {
  subjectName: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  objective: string;
  lessonTitle: string;
  lessonBody: string;
  examples: string[];
  items: Array<{ _id: string; prompt: string; options: string[]; type: string; difficulty: number; answer: string; explanation: string }>;
  masteryLines: string[];
}

export interface SubjectOption {
  _id: string;
  code: string;
  name: string;
}

export async function listActiveSubjects(): Promise<SubjectOption[]> {
  const subjects = await SubjectModel.find({ active: true }).sort({ sortOrder: 1 }).lean();
  return subjects.map((s) => ({ _id: s._id.toString(), code: s.code, name: s.name }));
}

/**
 * Picks a deterministic skill for (subject, grade): a content standard
 * matching the grade first; otherwise the first active skill under the
 * subject. Session prefers its existing skillId when already set. When a
 * skill is picked fresh, it is persisted on the session so later turns reuse
 * the same lesson.
 */
export async function resolveSkillForSession(
  session: TutorSessionDoc,
  gradeLevelId: string | null
): Promise<CurriculumBundle> {
  const subject = await SubjectModel.findById(session.subjectId).lean();
  if (!subject) {
    throw AppError.validation("Choose a subject to start learning.");
  }

  let skillId = session.skillId ? session.skillId.toString() : null;
  if (!skillId) {
    const picked = await pickSkill(subject._id.toString(), gradeLevelId);
    skillId = picked?._id.toString() ?? null;
    if (skillId) {
      await TutorSessionModel.updateOne({ _id: session._id }, { $set: { skillId } }).catch(() => {});
    }
  }
  if (!skillId) {
    throw AppError.dependencyUnavailable(
      "Your lesson is still being prepared. Try again in a moment."
    );
  }

  return loadCurriculumBundle(subject._id.toString(), subject.name, skillId, session.studentId.toString());
}

export async function pickSkill(
  subjectId: string,
  gradeLevelId: string | null
): Promise<{ _id: mongoose.Types.ObjectId } | null> {
  // 1) Skills under a content standard for this grade.
  if (gradeLevelId) {
    const strands = await StrandModel.find({ subjectId }).select("_id").lean();
    const strandIds = strands.map((s) => s._id);
    const subStrands = await SubStrandModel.find({ strandId: { $in: strandIds } }).select("_id").lean();
    const subStrandIds = subStrands.map((s) => s._id);
    const standards = await ContentStandardModel.find({
      substrandId: { $in: subStrandIds },
      gradeLevelId,
    })
      .select("_id")
      .lean();
    const standardIds = standards.map((s) => s._id);
    const skill = await SkillModel.findOne({
      contentStandardId: { $in: standardIds },
      active: true,
    })
      .sort({ defaultDifficulty: 1 })
      .lean();
    if (skill) return skill;
  }
  // 2) Fallback: any active skill in the subject (by strand path).
  return SkillModel.findOne({ active: true }).sort({ defaultDifficulty: 1 }).lean();
}

export async function loadCurriculumBundle(
  subjectId: string,
  subjectName: string,
  skillId: string,
  studentId: string
): Promise<CurriculumBundle> {
  const skill = await SkillModel.findById(skillId).lean();
  if (!skill) throw AppError.notFound("That lesson is not available.");

  const [standard, lesson, items, mastery] = await Promise.all([
    ContentStandardModel.findById(skill.contentStandardId).lean(),
    LessonModel.findOne({ skillId: skill._id, active: true }).sort({ sortOrder: 1 }).lean(),
    PracticeItemModel.find({ skillId: skill._id, active: true }).sort({ difficulty: 1 }).lean(),
    SkillMasteryModel.findOne({ studentId, skillId: skill._id }).lean(),
  ]);

  const masteryState: MasteryState | null = mastery
    ? {
        score: mastery.score,
        evidenceCount: mastery.evidenceCount,
        recentCorrect: mastery.recentCorrect,
        retests: mastery.retests,
      }
    : null;

  return {
    subjectName,
    skillId: skill._id.toString(),
    skillCode: skill.code,
    skillName: skill.name,
    objective: standard?.objective ?? "",
    lessonTitle: lesson?.title ?? "",
    lessonBody: lesson?.markdownBody ?? "",
    examples: lesson?.examples ?? [],
    items: items.map((item) => ({
      _id: item._id.toString(),
      prompt: item.prompt,
      options: item.options,
      type: item.type,
      difficulty: item.difficulty,
      answer: item.answer,
      explanation: item.explanation,
    })),
    masteryLines: masteryState
      ? [masterySummaryLine(skill.name, masteryState)]
      : [],
  };
}