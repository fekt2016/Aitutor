/**
 * POST /api/v1/tutor/sessions/:id/end (plan §26) — end a session + wrap-up.
 * Returns the session stats and any mastery touched in this session.
 */
import { withApiHandler, ok, type ApiHandlerContext } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { ensureDb } from "@/server/db";
import { getSessionUser, requireOwner } from "@/lib/authorize";
import { LearningSignalModel, SkillMasteryModel, TutorSessionModel } from "@/models";

export const POST = withApiHandler(async (_req, ctx: ApiHandlerContext) => {
  const user = await getSessionUser();
  await ensureDb();
  const { id } = (await ctx.params) as { id: string };

  const session = await TutorSessionModel.findById(id).lean();
  if (!session) throw AppError.notFound("That session doesn't exist.");

  const studentId = session.studentId.toString();
  await requireOwner(user, studentId);

  if (session.status === "active") {
    await TutorSessionModel.updateOne(
      { _id: session._id },
      { $set: { status: "ended", endedAt: new Date(), completionReason: "student_ended" } }
    );
    session.status = "ended";
    session.endedAt = new Date();
  }

  // Skills touched this session + their (gated) mastery bands.
  const signals = await LearningSignalModel.find({ sessionId: session._id })
    .distinct("skillId")
    .lean();
  const mastery = await SkillMasteryModel.find({ studentId, skillId: { $in: signals } })
    .select("skillId score band evidenceCount")
    .lean();

  return ok({
    session: {
      id: session._id.toString(),
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      summary: session.summary,
      stats: session.stats,
    },
    mastery: mastery.map((m) => ({
      skillId: m.skillId.toString(),
      score: m.score,
      band: m.band,
      evidenceCount: m.evidenceCount,
    })),
  });
});

export const dynamic = "force-dynamic";