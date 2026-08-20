/**
 * GET /api/v1/auth/me (plan §26) — current authenticated user.
 * Returns the public user + (for students) their learning profile.
 * Never serializes passwordHash.
 */
import { withApiHandler, ok } from "@/lib/api";
import { AppError } from "@/lib/errors";
import { ensureDb } from "@/server/db";
import { getSessionUser } from "@/lib/authorize";
import { UserModel, StudentProfileModel, toPublicUser } from "@/models";
import { STUDENT_ROLE } from "@/features/auth/roles";

export const GET = withApiHandler(async () => {
  const sessionUser = await getSessionUser();
  await ensureDb();

  const user = await UserModel.findById(sessionUser.id).lean();
  if (!user || !user.active) {
    throw AppError.unauthorized();
  }

  const data: { user: ReturnType<typeof toPublicUser>; profile?: unknown } = {
    user: toPublicUser(user),
  };

  if (user.role === STUDENT_ROLE) {
    const profile = await StudentProfileModel.findOne({ studentId: user._id })
      .select("gradeLevelId language dailySessionLimit")
      .lean();
    data.profile = profile ?? null;
  }

  return ok(data);
});

export const dynamic = "force-dynamic";
