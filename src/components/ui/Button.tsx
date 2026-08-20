"use client";

import styled from "styled-components";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonStyleProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $fullWidth?: boolean;
}

/**
 * Button (plan §42.11) — radius `md` (not pill), no shadow, restrained hover.
 * Min-heights 44/48/56 (sm/md/lg) keep touch targets ≥44px.
 */
export const Button = styled.button<ButtonStyleProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  min-height: 48px;
  padding: 0 var(--space-2xl);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  letter-spacing: 0.01em;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--duration-fast) var(--ease-standard),
    border-color var(--duration-fast) var(--ease-standard),
    color var(--duration-fast) var(--ease-standard);
  width: ${(p) => (p.$fullWidth ? "100%" : "auto")};

  /* Sizes */
  ${(p) =>
    p.$size === "sm" && `min-height: 44px; padding: 0 var(--space-lg); font-size: var(--text-small);`}
  ${(p) =>
    p.$size === "lg" && `min-height: 56px; padding: 0 var(--space-3xl); font-size: var(--text-body-lg);`}

  /* Secondary — outline on light surfaces */
  ${(p) =>
    p.$variant === "secondary" &&
    `
      background: var(--color-surface);
      color: var(--color-ink-secondary);
      border-color: var(--color-border-strong);
      &:hover:not(:disabled) { background: var(--color-surface-secondary); border-color: var(--color-ink-muted); }
      &:active:not(:disabled) { background: var(--color-surface-secondary); }
    `}

  /* Ghost — text-only */
  ${(p) =>
    p.$variant === "ghost" &&
    `
      background: transparent;
      color: var(--color-primary);
      border-color: transparent;
      &:hover:not(:disabled) { background: var(--color-primary-subtle); }
    `}

  /* Danger */
  ${(p) =>
    p.$variant === "danger" &&
    `
      background: var(--color-danger);
      color: var(--color-white);
      &:hover:not(:disabled) { background: var(--color-danger); filter: brightness(0.92); }
    `}

  /* Primary (default) — indigo fill, no shadow */
  ${(p) =>
    (!p.$variant || p.$variant === "primary") &&
    `
      background: var(--color-primary);
      color: var(--color-white);
      &:hover:not(:disabled) { background: var(--color-primary-hover); }
      &:active:not(:disabled) { background: var(--color-primary-active); }
    `}

  &:disabled {
    background: var(--color-disabled-bg);
    color: var(--color-disabled-text);
    border-color: var(--color-border);
    opacity: var(--color-disabled-opacity, 0.6);
    cursor: not-allowed;
  }
`;

Button.defaultProps = {
  $variant: "primary",
  $size: "md",
};