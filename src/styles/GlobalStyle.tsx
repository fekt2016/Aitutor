"use client";

import { createGlobalStyle } from "styled-components";
import {
  colors,
  radii,
  spacing,
  typography,
  shadows,
  motion,
  breakpoints,
  interactive,
} from "./tokens";

/**
 * Injects design tokens as CSS custom properties + base element styles.
 * Single source of truth is `styles/tokens.ts` (plan §42.18).
 *
 * `:root` = light theme; `[data-theme="dark"]` = dark theme overrides
 * (tokenized now, enabled later — plan §42.4). Components are theme-agnostic.
 */
export const GlobalStyle = createGlobalStyle`
  :root {
    /* Colors — brand (indigo) */
    --color-primary: ${colors.primary};
    --color-primary-hover: ${colors.primaryHover};
    --color-primary-active: ${colors.primaryActive};
    --color-primary-subtle: ${colors.primarySubtle};
    --color-primary-soft: ${colors.primarySoft};

    /* Colors — accent (amber, decorative only) */
    --color-accent: ${colors.accent};
    --color-accent-strong: ${colors.accentStrong};
    --color-accent-subtle: ${colors.accentSubtle};
    --color-accent-soft: ${colors.accentSoft};

    /* Colors — neutrals (cool slate canvas) */
    --color-background: ${colors.background};
    --color-surface: ${colors.surface};
    --color-surface-secondary: ${colors.surfaceSecondary};
    --color-border: ${colors.border};
    --color-border-strong: ${colors.borderStrong};
    --color-ink: ${colors.ink};
    --color-ink-secondary: ${colors.inkSecondary};
    --color-ink-muted: ${colors.inkMuted};
    --color-ink-faint: ${colors.inkFaint};
    --color-white: ${colors.white};

    /* Colors — semantic */
    --color-success: ${colors.success};
    --color-success-subtle: ${colors.successSubtle};
    --color-warning: ${colors.warning};
    --color-warning-subtle: ${colors.warningSubtle};
    --color-danger: ${colors.danger};
    --color-danger-subtle: ${colors.dangerSubtle};
    --color-info: ${colors.info};
    --color-info-subtle: ${colors.infoSubtle};

    /* Spacing */
    --space-xs: ${spacing.xs};
    --space-sm: ${spacing.sm};
    --space-md: ${spacing.md};
    --space-lg: ${spacing.lg};
    --space-xl: ${spacing.xl};
    --space-2xl: ${spacing["2xl"]};
    --space-3xl: ${spacing["3xl"]};
    --space-4xl: ${spacing["4xl"]};
    --space-5xl: ${spacing["5xl"]};
    --space-6xl: ${spacing["6xl"]};

    /* Radii — restrained (plan §42.7) */
    --radius-sm: ${radii.sm};
    --radius-md: ${radii.md};
    --radius-lg: ${radii.lg};
    --radius-xl: ${radii.xl};
    --radius-pill: ${radii.pill};

    /* Typography — families */
    --font-sans: ${typography.fontSans};
    --font-display: ${typography.fontDisplay};
    --font-mono: ${typography.fontMono};

    /* Typography — weights + line heights */
    --font-weight-regular: ${typography.weights.regular};
    --font-weight-medium: ${typography.weights.medium};
    --font-weight-semibold: ${typography.weights.semibold};
    --font-weight-bold: ${typography.weights.bold};
    --font-weight-extrabold: ${typography.weights.extraBold};
    --line-height-tight: ${typography.lineHeights.tight};
    --line-height-snug: ${typography.lineHeights.snug};
    --line-height-normal: ${typography.lineHeights.normal};
    --line-height-relaxed: ${typography.lineHeights.relaxed};

    /* Typography — semantic roles (plan §42.5) */
    --text-display: ${typography.roles.display.size};
    --text-h1: ${typography.roles.h1.size};
    --text-h2: ${typography.roles.h2.size};
    --text-h3: ${typography.roles.h3.size};
    --text-body-lg: ${typography.roles.bodyLg.size};
    --text-body: ${typography.roles.body.size};
    --text-small: ${typography.roles.small.size};
    --text-caption: ${typography.roles.caption.size};
    --text-label: ${typography.roles.label.size};
    --text-numeric: ${typography.roles.numeric.size};

    /* Shadows / elevation (plan §42.8) */
    --shadow-elevation-1: ${shadows.elevation1};
    --shadow-elevation-2: ${shadows.elevation2};
    --shadow-elevation-3: ${shadows.elevation3};
    --shadow-focus-ring: ${shadows.focusRing};

    /* Motion (plan §42.9) */
    --duration-fast: ${motion.durations.fast};
    --duration-normal: ${motion.durations.normal};
    --duration-slow: ${motion.durations.slow};
    --ease-standard: ${motion.easings.standard};
    --ease-emphasis: ${motion.easings.emphasis};
    --ease-spring: ${motion.easings.spring};

    /* Breakpoints */
    --bp-sm: ${breakpoints.sm};
    --bp-md: ${breakpoints.md};
    --bp-lg: ${breakpoints.lg};
    --bp-xl: ${breakpoints.xl};

    /* Interactive (plan §42.3) */
    --focus-ring-width: ${interactive.focusRing.width};
    --focus-ring-offset: ${interactive.focusRing.offset};
    --focus-ring-color: ${interactive.focusRing.color};
    --color-selected: ${interactive.selected.background};
    --color-disabled-bg: ${interactive.disabled.background};
    --color-disabled-text: ${interactive.disabled.text};
    --color-disabled-opacity: ${interactive.disabled.opacity};
  }

  /* Dark theme overrides (plan §42.4) — tokenized now, enabled later. */
  [data-theme="dark"] {
    --color-primary: #818CF8;
    --color-primary-hover: #A5B4FC;
    --color-primary-active: #6366F1;
    --color-primary-subtle: rgba(129, 140, 248, 0.16);
    --color-primary-soft: rgba(129, 140, 248, 0.24);
    --color-accent: #FBBF24;
    --color-accent-strong: #FDE68A;
    --color-accent-subtle: rgba(251, 191, 36, 0.14);
    --color-accent-soft: rgba(251, 191, 36, 0.22);
    --color-background: #0F172A;
    --color-surface: #1E293B;
    --color-surface-secondary: #334155;
    --color-border: #334155;
    --color-border-strong: #475569;
    --color-ink: #F8FAFC;
    --color-ink-secondary: #CBD5E1;
    --color-ink-muted: #94A3B8;
    --color-ink-faint: #64748B;
    --color-success: #4ADE80;
    --color-success-subtle: rgba(74, 222, 128, 0.14);
    --color-warning: #FBBF24;
    --color-warning-subtle: rgba(251, 191, 36, 0.14);
    --color-danger: #F87171;
    --color-danger-subtle: rgba(248, 113, 113, 0.14);
    --color-info: #60A5FA;
    --color-info-subtle: rgba(96, 165, 250, 0.14);
    --focus-ring-color: #818CF8;
    --shadow-focus-ring: 0 0 0 3px rgba(129, 140, 248, 0.4);
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    padding: 0;
    min-height: 100%;
  }

  body {
    background: var(--color-background);
    color: var(--color-ink);
    font-family: var(--font-sans);
    font-size: var(--text-body);
    line-height: var(--line-height-normal, 1.5);
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    color: var(--color-ink);
    margin: 0;
  }

  p {
    margin: 0;
  }

  a {
    color: var(--color-primary);
    text-decoration: none;
  }

  a:hover {
    text-decoration: underline;
  }

  button {
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
  }

  /* Focus ring — 2px outline + 3px offset, token-driven (plan §42.17). */
  :focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-radius: var(--radius-sm);
  }

  img, svg {
    display: block;
    max-width: 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;