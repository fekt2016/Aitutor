"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styled from "styled-components";
import { Button } from "@/components/ui/Button";
import { Input, Label, TextFieldShell, FieldError } from "@/components/ui/TextField";
import { SelectField } from "@/components/ui/Select";

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-lg);
`;

const AGE_BANDS = ["5-6", "7-8", "9-10", "11-12"] as const;

export default function AddChildForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ageBand, setAgeBand] = useState<(typeof AGE_BANDS)[number]>("5-6");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!email.trim() && !username.trim()) {
      setError("Add an email or a username so your child can log in.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountType: "student",
          name,
          email,
          username,
          password,
          ageBand,
        }),
      });
      const body = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        setError(body.error?.message ?? "Something went wrong. Please try again.");
        return;
      }
      setName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setError(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Grid>
        <TextFieldShell>
          <Label htmlFor="child-name">Child&apos;s name</Label>
          <Input
            id="child-name"
            type="text"
            autoComplete="off"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kofi Mensah"
          />
        </TextFieldShell>

        <TextFieldShell>
          <Label htmlFor="child-email">Child&apos;s email (optional)</Label>
          <Input
            id="child-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kofi@example.com — or use a username instead"
          />
        </TextFieldShell>

        <TextFieldShell>
          <Label htmlFor="child-username">Username (for their login)</Label>
          <Input
            id="child-username"
            type="text"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. kofi123 — add email or username"
          />
        </TextFieldShell>

        <TextFieldShell>
          <Label htmlFor="child-password">Password (at least 8 characters)</Label>
          <Input
            id="child-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </TextFieldShell>

        <SelectField
          id="child-age"
          label="Age band"
          value={ageBand}
          onChange={(e) => setAgeBand(e.target.value as (typeof AGE_BANDS)[number])}
        >
          {AGE_BANDS.map((band) => (
            <option key={band} value={band}>
              {band} years
            </option>
          ))}
        </SelectField>
      </Grid>

      {error && <FieldError role="alert">{error}</FieldError>}

      <Button type="submit" $size="lg" disabled={submitting}>
        {submitting ? "Adding child…" : "Add child"}
      </Button>
    </form>
  );
}