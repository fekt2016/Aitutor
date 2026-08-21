/**
 * /admin/curriculum — curriculum editor (plan §27, Phase 2 deliverable).
 * Server gate: admins/superadmins only; everyone else is bounced.
 */
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/nextauth";
import { ADMIN_ROLES, type Role } from "@/features/auth/roles";
import type { SessionUser } from "@/lib/authorize";
import CurriculumEditor from "./CurriculumEditor";

export default async function AdminCurriculumPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as SessionUser;
  const role = user.role as Role;
  if (!ADMIN_ROLES.includes(role) && !user.superAdmin) {
    redirect("/dashboard");
  }

  return <CurriculumEditor />;
}
