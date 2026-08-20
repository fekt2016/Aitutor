"use client";

import styled from "styled-components";
import { Icon, type IconName } from "./Icon";

export type BadgeVariant = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

interface BadgeStyleProps {
  $variant?: BadgeVariant;
}

/** Badge (plan §42.11) — pill, label-style text, semantic tints. Never color alone. */
export const Badge = styled.span<BadgeStyleProps>`
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 24px;
  padding: 0 var(--space-md);
  border-radius: var(--radius-pill);
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
  white-space: nowrap;

  /* Neutral (default) */
  background: var(--color-surface-secondary);
  color: var(--color-ink-secondary);

  ${(p) =>
    p.$variant === "primary" &&
    `background: var(--color-primary-subtle); color: var(--color-primary);`}

  ${(p) =>
    p.$variant === "success" &&
    `background: var(--color-success-subtle); color: var(--color-success);`}

  ${(p) =>
    p.$variant === "warning" &&
    `background: var(--color-warning-subtle); color: var(--color-warning);`}

  ${(p) =>
    p.$variant === "danger" &&
    `background: var(--color-danger-subtle); color: var(--color-danger);`}

  ${(p) =>
    p.$variant === "info" &&
    `background: var(--color-info-subtle); color: var(--color-info);`}
`;

const BADGE_ICONS: Partial<Record<BadgeVariant, IconName>> = {
  success: "check",
  warning: "alert-triangle",
  danger: "x-circle",
  info: "info",
};

interface BadgeProps extends BadgeStyleProps {
  children: React.ReactNode;
  /** Semantic badges pair an icon with text — color is never the only signal. */
  icon?: IconName;
}

export function BadgeWithIcon({ children, $variant = "neutral", icon }: BadgeProps) {
  const iconName = icon ?? BADGE_ICONS[$variant];
  return (
    <Badge $variant={$variant}>
      {iconName && <Icon name={iconName} size={12} />}
      {children}
    </Badge>
  );
}