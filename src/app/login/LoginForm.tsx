"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label, TextFieldShell, FieldError, PasswordField } from "@/components/ui/TextField";
import { AuthForm } from "@/components/auth/AuthShell";

interface LoginFormProps {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo = "/dashboard" }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthForm onSubmit={handleSubmit} noValidate>
      <TextFieldShell>
        <Label htmlFor="identifier">Username or email</Label>
        <Input
          id="identifier"
          type="text"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g. kofi or kofi@example.com"
        />
      </TextFieldShell>

      <TextFieldShell>
        <Label htmlFor="password">Password</Label>
        <PasswordField
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </TextFieldShell>

      {error && <FieldError role="alert">{error}</FieldError>}

      <Button type="submit" $fullWidth $size="lg" disabled={submitting}>
        {submitting ? "Logging in…" : "Log in"}
      </Button>
    </AuthForm>
  );
}
