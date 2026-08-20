"use client";

import styled from "styled-components";

/**
 * Card (plan §42.11) — radius `md`, 1px hairline border, NO default shadow.
 * Elevation is reserved for hover (`elevation-1`) and overlays. Cards are
 * surfaces, not floating bubbles.
 */
export const Card = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-2xl);
`;

export const CardHeader = styled.div`
  margin-bottom: var(--space-xl);
`;

export const CardTitle = styled.h2`
  font-size: var(--text-h2);
  font-weight: var(--font-weight-bold);
  margin-bottom: var(--space-sm);
`;

export const CardDescription = styled.p`
  color: var(--color-ink-muted);
  font-size: var(--text-body);
  line-height: var(--line-height-snug);
`;