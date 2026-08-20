/**
 * GET /api/v1/tutor/sessions/:id (plan §26) — a session + its recent messages.
 * Auth: owner (the student themself, a linked parent, or admin). The
 * studentId used for the ownership check is ALWAYS the session's own
 * studentId — never anything from the client.
 */
import { withApiHandler, ok, type ApiHandlerContext } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { ensureDb } from "@/server/db";
import { getSessionUser, requireOwner } from "@/lib/authorize";
import { SubjectModel, TutorMessageModel, TutorSessionModel } from "@/models";

export const GET = withApiHandler(async (_req, ctx: ApiHandlerContext) => {
  const user = await getSessionUser();
  await ensureDb();
  const { id } = (await ctx.params) as { id: string };

  const session = await TutorSessionModel.findById(id).lean();
  if (!session) throw AppError.notFound("That session doesn't exist.");

  const studentId = session.studentId.toString();
  await requireOwner(user, studentId);

  const [messages, subject] = await Promise.all([
    TutorMessageModel.find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(30)
      .select("role contentType content safety createdAt")
      .lean(),
    SubjectModel.findById(session.subjectId).select("name").lean(),
  ]);

  return ok({
    session: {
      id: session._id.toString(),
      subject: subject?.name ?? "",
      goal: session.goal,
      status: session.status,
      difficulty: session.difficulty,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      summary: session.summary,
      stats: session.stats,
    },
    messages: messages.map((message) => ({
      id: message._id.toString(),
      role: message.role,
      contentType: message.contentType,
      content: message.content,
      createdAt: message.createdAt,
    })),
  });
});

export const dynamic = "force-dynamic";