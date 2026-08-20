"use client";

import styled from "styled-components";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  $hasError?: boolean;
}

/**
 * Shared select (plan §42.11) — radius `sm`, 1px border, token focus ring,
 * 44px+ touch target, chevron affordance. Replaces one-off inline selects.
 */
export const Select = styled.select<SelectProps>`
  appearance: none;
  width: 100%;
  min-height: 44px;
  padding: 0 var(--space-4xl) 0 var(--space-lg);
  background: var(--color-surface)
    url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")
    no-repeat right var(--space-lg) center;
  border: 1px solid ${(p) => (p.$hasError ? "var(--color-danger)" : "var(--color-border-strong)")};
  border-radius: var(--radius-sm);
  font-size: var(--text-body);
  color: var(--color-ink);
  cursor: pointer;
  transition:
    border-color var(--duration-fast) var(--ease-standard),
    box-shadow var(--duration-fast) var(--ease-standard);

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--shadow-focus-ring);
  }

  &:disabled {
    background-color: var(--color-disabled-bg);
    color: var(--color-disabled-text);
    cursor: not-allowed;
  }
`;

/** Renders an accessible select with a visible label (mirrors TextField shell). */
interface SelectFieldProps extends SelectProps {
  id: string;
  label: string;
}

export function SelectField({ id, label, ...rest }: SelectFieldProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
        width: "100%",
      }}
    >
      <label
        htmlFor={id}
        style={{
          fontSize: "var(--text-label)",
          fontWeight: "var(--font-weight-semibold)",
          color: "var(--color-ink)",
        }}
      >
        {label}
      </label>
      <Select id={id} {...rest} />
    </div>
  );
}