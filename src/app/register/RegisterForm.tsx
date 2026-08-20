"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input, Label, TextFieldShell, FieldError, PasswordField } from "@/components/ui/TextField";
import { AuthForm } from "@/components/auth/AuthShell";

const ConsentRow = styled.label`
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  font-size: var(--text-sm);
  color: var(--color-ink-muted);
  line-height: var(--line-height-snug);
  cursor: pointer;
`;

const ConsentBox = styled.input`
  width: 22px;
  height: 22px;
  margin-top: 1px;
  accent-color: var(--color-primary);
`;

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountType: "parent", name, email, password, consent }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: { message?: string; details?: Record<string, string> };
      };
      if (!res.ok || !body.success) {
        setError(
          body.error?.message ??
            Object.values(body.error?.details ?? {}).join(" ") ??
            "Something went wrong. Please try again."
        );
        return;
      }
      router.push("/login");
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
        <Label htmlFor="name">Your name</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ama Mensah"
        />
      </TextFieldShell>

      <TextFieldShell>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </TextFieldShell>

      <TextFieldShell>
        <Label htmlFor="password">Password (at least 8 characters)</Label>
        <PasswordField
          id="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </TextFieldShell>

      <ConsentRow>
        <ConsentBox
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          I am the parent or guardian of the child(ren) using this account and I consent to their
          learning data being processed to provide the tutor service (plan §19 — privacy first).
        </span>
      </ConsentRow>

      {error && <FieldError role="alert">{error}</FieldError>}

      <Button type="submit" $fullWidth $size="lg" disabled={submitting}>
        {submitting ? "Creating account…" : "Create account"}
      </Button>
    </AuthForm>
  );
}
