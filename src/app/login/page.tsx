import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";
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
  title: "Log in",
};

export default function LoginPage() {
  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader>
          <AuthBrandMark />
          <AuthTitle>Welcome back</AuthTitle>
          <AuthSub>Log in to keep learning.</AuthSub>
        </AuthHeader>

        <LoginForm />

        <AuthFooter>
          New here? <Link href="/register">Create an account</Link>
        </AuthFooter>
      </AuthCard>
    </AuthShell>
  );
}
