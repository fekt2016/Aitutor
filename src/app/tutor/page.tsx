/**
 * /tutor (plan §34, §42.12) — the child's tutor surface. Server shell: guards
 * the student role, loads active subjects, then hands off to the client
 * TutorApp (session flow + streamed chat). Non-students go to /dashboard.
 */
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/nextauth";
import { ensureDb } from "@/server/db";
import { STUDENT_ROLE } from "@/features/auth/roles";
import { listActiveSubjects } from "@/features/tutor/curriculum/service";
import { StudentProfileModel, GradeLevelModel } from "@/models";
import TutorApp from "./TutorApp";

export default async function TutorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== STUDENT_ROLE) redirect("/dashboard");

  await ensureDb();
  const [subjects, profile] = await Promise.all([
    listActiveSubjects(),
    StudentProfileModel.findOne({ studentId: session.user.id })
      .select("gradeLevelId language")
      .lean(),
  ]);
  const grade = profile?.gradeLevelId
    ? await GradeLevelModel.findById(profile.gradeLevelId).select("name").lean()
    : null;

  return (
    <TutorApp
      studentName={session.user.name ?? "friend"}
      gradeName={grade?.name ?? null}
      subjects={subjects}
    />
  );
}

export const dynamic = "force-dynamic";