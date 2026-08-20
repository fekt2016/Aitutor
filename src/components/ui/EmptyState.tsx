"use client";

import styled from "styled-components";
import { Icon, type IconName } from "./Icon";

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
  padding: var(--space-4xl) var(--space-3xl);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
`;

const IconTile = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-md);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
`;

const Title = styled.h3`
  font-size: var(--text-h3);
  font-weight: var(--font-weight-semibold);
`;

const Hint = styled.p`
  color: var(--color-ink-muted);
  font-size: var(--text-body);
  max-width: 32em;
  line-height: var(--line-height-snug);
`;

const Action = styled.div`
  margin-top: var(--space-sm);
`;

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}

/** Empty state (plan §42.11) — icon + title + hint + one primary action. */
export function EmptyState({ icon = "info", title, hint, children }: EmptyStateProps) {
  return (
    <Wrapper>
      <IconTile>
        <Icon name={icon} size={26} />
      </IconTile>
      <Title>{title}</Title>
      {hint && <Hint>{hint}</Hint>}
      {children && <Action>{children}</Action>}
    </Wrapper>
  );
}