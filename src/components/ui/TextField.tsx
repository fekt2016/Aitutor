"use client";

import { useState } from "react";
import styled from "styled-components";
import { Icon } from "./Icon";

export const TextFieldShell = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  width: 100%;
`;

export const Label = styled.label`
  font-size: var(--text-label);
  font-weight: var(--font-weight-semibold);
  color: var(--color-ink);
`;

interface InputProps {
  $hasError?: boolean;
  $withToggle?: boolean;
}

/**
 * Input (plan §42.11) — radius `sm`, 1px border, focus = primary border +
 * focus-ring halo. 44px+ touch target.
 */
export const Input = styled.input<InputProps>`
  width: 100%;
  min-height: 48px;
  padding: 0 var(--space-lg);
  padding-right: ${(p) => (p.$withToggle ? "calc(var(--space-lg) + 44px)" : "var(--space-lg)")};
  background: var(--color-surface);
  border: 1px solid ${(p) => (p.$hasError ? "var(--color-danger)" : "var(--color-border-strong)")};
  border-radius: var(--radius-sm);
  font-size: var(--text-body);
  color: var(--color-ink);
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  &::placeholder {
    color: var(--color-ink-faint);
  }

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-focus-ring);
  }

  &:disabled {
    background: var(--color-disabled-bg);
    color: var(--color-disabled-text);
    cursor: not-allowed;
  }
`;

export const FieldError = styled.p`
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  color: var(--color-danger);
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
`;

const PasswordWrap = styled.div`
  position: relative;
  width: 100%;
`;

const ToggleButton = styled.button`
  position: absolute;
  top: 50%;
  right: var(--space-xs);
  transform: translateY(-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-standard);

  &:hover {
    color: var(--color-ink);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }
`;

interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  id: string;
  $hasError?: boolean;
}

/**
 * Password input with a show/hide toggle. Keeps `type="password"` by default;
 * toggling reveals the value (never trimmed — spaces are significant).
 */
export function PasswordField({ id, $hasError, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <PasswordWrap>
      <Input
        id={id}
        type={visible ? "text" : "password"}
        $hasError={$hasError}
        $withToggle
        {...rest}
      />
      <ToggleButton
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={20} />
      </ToggleButton>
    </PasswordWrap>
  );
}