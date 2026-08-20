import type { Metadata } from "next";
import Link from "next/link";
import RegisterForm from "./RegisterForm";
import {
  AuthShell,
  AuthCard,
  AuthHeader,
  AuthBrandMark,
  AuthTitle,
  AuthSub,
  AuthFooter,
} from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function RegisterPage() {
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader>
          <AuthBrandMark />
          <AuthTitle>Create a parent account</AuthTitle>
          <AuthSub>
            Parents create the account, then add their children. Children never sign themselves up.
          </AuthSub>
        </AuthHeader>

        <RegisterForm />

        <AuthFooter>
          Already have an account? <Link href="/login">Log in</Link>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}
