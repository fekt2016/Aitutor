/**
 * POST /api/v1/tutor/sessions (plan §26) — create a tutor session.
 * Student-only for MVP (parent-as arrives with the parent dashboard).
 * Daily session cap enforced here. The session's skill is resolved
 * immediately (grounding) so the response tells the child what they'll learn.
 */
import { withApiHandler, created, readJson } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { ensureDb } from "@/server/db";
import { requireRole } from "@/lib/authorize";
import { ParentChildModel, StudentProfileModel, SubjectModel, TutorSessionModel } from "@/models";
import { STUDENT_ROLE } from "@/features/auth/roles";
import { assertDailySessionCap } from "@/features/tutor/caps";
import { resolveSkillForSession } from "@/features/tutor/curriculum/service";

export const POST = withApiHandler(async (req) => {
  const user = await requireRole(STUDENT_ROLE);
  await ensureDb();

  const body = await readJson(req, { allowedFields: ["subjectId", "goal"] });
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const goal = typeof body.goal === "string" ? body.goal.trim().slice(0, 120) : "";

  const subject = await SubjectModel.findById(subjectId).lean();
  if (!subject || !subject.active) {
    throw AppError.validation("Choose a subject to start learning.");
  }

  await assertDailySessionCap(user.id);

  const profile = await StudentProfileModel.findOne({ studentId: user.id }).lean();
  const link = await ParentChildModel.findOne({ childId: user.id }).select("parentId").lean();

  const session = await TutorSessionModel.create({
    studentId: user.id,
    parentId: link?.parentId ?? null,
    subjectId: subject._id,
    goal: goal || `Learn ${subject.name}`,
    difficulty: 3,
  });

  // Resolve + persist the skill so the session is grounded immediately.
  let bundle;
  try {
    bundle = await resolveSkillForSession(session, profile?.gradeLevelId?.toString() ?? null);
  } catch {
    bundle = null; // session still usable; lesson resolves on first turn
  }

  return created({
    session: {
      id: session._id.toString(),
      subject: subject.name,
      goal: session.goal,
      status: session.status,
      skill: bundle ? { id: bundle.skillId, name: bundle.skillName, code: bundle.skillCode } : null,
      startedAt: session.startedAt,
    },
  });
});

export const dynamic = "force-dynamic";