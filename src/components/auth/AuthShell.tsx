"use client";

import styled from "styled-components";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { BrandMark, Wordmark } from "@/components/ui/BrandMark";

/**
 * Shared auth-page shell (plan §42.11) — centered flat card on the neutral
 * slate background. Brand mark + wordmark replace the old emoji circle.
 */
export const AuthShell = styled.main`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-3xl);
  gap: var(--space-2xl);
`;

export const AuthCard = styled(Card)`
  width: 100%;
  max-width: 440px;
`;

export const AuthHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-2xl);
`;

export const AuthBrand = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: var(--space-md);
  text-decoration: none;

  &:hover {
    text-decoration: none;
  }
`;

export const AuthTitle = styled.h1`
  font-size: var(--text-h1);
  font-weight: var(--font-weight-bold);
  margin-top: var(--space-md);
`;

export const AuthSub = styled.p`
  color: var(--color-ink-muted);
  font-size: var(--text-body);
  max-width: 30em;
  line-height: var(--line-height-snug);
`;

export const AuthForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
`;

export const AuthFooter = styled.p`
  text-align: center;
  color: var(--color-ink-muted);
  font-size: var(--text-small);
  margin-top: var(--space-xl);
`;

/** Brand lockup used on auth pages: mark + wordmark. */
export function AuthBrandMark() {
  return (
    <AuthBrand href="/">
      <BrandMark size={40} />
      <Wordmark />
    </AuthBrand>
  );
}