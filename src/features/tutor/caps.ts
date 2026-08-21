/**
 * Abuse/rate caps (plan §28, §30) — DB-backed counters (Upstash Redis swap is
 * Phase 6 hardening; the semantics stay identical). Enforced server-side:
 * daily session cap per student, message cap per session.
 */
import { AppError } from "@/lib/errors";
import { getEnv } from "@/server/env";
import { TutorMessageModel, TutorSessionModel, type TutorSessionDoc } from "@/models";

export async function assertDailySessionCap(studentId: string): Promise<void> {
  const { DAILY_SESSION_CAP } = getEnv();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const count = await TutorSessionModel.countDocuments({
    studentId,
    startedAt: { $gte: startOfDay },
  });
  if (count >= DAILY_SESSION_CAP) {
    throw AppError.rateLimited(
      "You've had lots of learning today — well done! Come back tomorrow for more fun."
    );
  }
}

export async function assertSessionMessageCap(session: TutorSessionDoc): Promise<void> {
  const { SESSION_MSG_CAP } = getEnv();
  if (session.stats.messages >= SESSION_MSG_CAP) {
    throw AppError.rateLimited(
      "You've done a whole session's worth of learning today. Take a break and come back soon!"
    );
  }
  const count = await TutorMessageModel.countDocuments({ sessionId: session._id });
  if (count >= SESSION_MSG_CAP) {
    throw AppError.rateLimited(
      "You've done a whole session's worth of learning today. Take a break and come back soon!"
    );
  }
}

export function assertSessionActive(session: TutorSessionDoc): void {
  if (session.status !== "active") {
    throw AppError.validation("This session has already ended.");
  }
}