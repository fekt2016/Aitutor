/**
 * EazWorld AI Tutor — design tokens (plan §42)
 *
 * Single source of truth for the visual design system. v2 redesign:
 * minimal + professional + modern + educational + friendly.
 *
 * - Brand: indigo (trust, intelligence, safety)
 * - Canvas: cool slate neutrals
 * - Accent: amber used sparingly (stars, mascot, celebration)
 * - Semantics: green/amber/red/blue — meaning only, never decoration
 *
 * Values are consumed by `styles/GlobalStyle.tsx` (injected as CSS custom
 * properties, light + dark) and imported directly by styled-components.
 *
 * Rule: components never hard-code colors/radii/type — always reference a token.
 */

export const colors = {
  // Brand — indigo. `primary` passes WCAG AA (6.3:1) with white text.
  primary: "#4F46E5",
  primaryHover: "#4338CA",
  primaryActive: "#3730A3",
  primarySubtle: "#EEF2FF",
  primarySoft: "#E0E7FF",

  // Accent — amber (warmth, stars, mascot, celebration). Decorative; text-safe
  // variant is `accentStrong`. Shares a hue family with `warning` by design —
  // they never co-occur in one component (plan §42.3).
  accent: "#D97706",
  accentStrong: "#B45309",
  accentSubtle: "#FFFBEB",
  accentSoft: "#FEF3C7",

  // Neutrals — cool slate canvas (premium, calm)
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSecondary: "#F1F5F9",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  ink: "#0F172A",
  inkSecondary: "#334155",
  inkMuted: "#64748B",
  inkFaint: "#94A3B8",
  white: "#FFFFFF",

  // Semantic
  success: "#15803D",
  successSubtle: "#F0FDF4",
  warning: "#B45309",
  warningSubtle: "#FFFBEB",
  danger: "#B91C1C",
  dangerSubtle: "#FEF2F2",
  info: "#1D4ED8",
  infoSubtle: "#EFF6FF",
} as const;

export type ColorToken = keyof typeof colors;

export const spacing = {
  xs: "0.25rem", // 4px
  sm: "0.5rem", // 8px
  md: "0.75rem", // 12px
  lg: "1rem", // 16px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "2rem", // 32px
  "4xl": "2.5rem", // 40px
  "5xl": "3rem", // 48px
  "6xl": "4rem", // 64px
} as const;

/** Restrained radii (plan §42.7) — buttons `md`, inputs `sm`, cards `md`/`lg`, badges pill. */
export const radii = {
  sm: "0.375rem", // 6px
  md: "0.625rem", // 10px
  lg: "1rem", // 16px
  xl: "1.25rem", // 20px — rare, large celebratory panels
  pill: "9999px",
} as const;

/** Type families (plan §42.5) — Nunito Sans for display + body (warm, rounded
 * strokes, child-friendly yet professional); Geist Mono for tabular numbers.
 * NOTE: stacks reference the next/font variables directly (`--font-nunito`,
 * `--font-mono`); `--font-sans`/`--font-display` are derived in GlobalStyle.
 * Never self-reference a variable in its own stack (breaks into serif fallback). */
export const typography = {
  fontSans: "var(--font-nunito), ui-sans-serif, system-ui, sans-serif",
  fontDisplay: "var(--font-nunito), ui-sans-serif, system-ui, sans-serif",
  fontMono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, monospace",
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extraBold: 800,
  },
  lineHeights: {
    tight: 1.2,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.6,
  },
  /** Semantic type roles — components reference roles, never ad-hoc sizes.
   * Weights are capped at 700: Nunito's 800 reads heavier than needed and the
   * previous 800 display was the main "strokey" offender. */
  roles: {
    display: {
      size: "clamp(2.25rem, 4vw, 3rem)",
      weight: 700,
      lineHeight: 1.15,
      letterSpacing: "-0.01em",
    },
    h1: { size: "2rem", weight: 700, lineHeight: 1.2, letterSpacing: "-0.005em" },
    h2: { size: "1.5rem", weight: 600, lineHeight: 1.25, letterSpacing: "0em" },
    h3: { size: "1.25rem", weight: 600, lineHeight: 1.3, letterSpacing: "0em" },
    bodyLg: { size: "1.125rem", weight: 400, lineHeight: 1.6, letterSpacing: "0em" },
    body: { size: "1rem", weight: 400, lineHeight: 1.6, letterSpacing: "0em" },
    small: { size: "0.875rem", weight: 400, lineHeight: 1.5, letterSpacing: "0em" },
    caption: { size: "0.75rem", weight: 500, lineHeight: 1.4, letterSpacing: "0em" },
    label: { size: "0.8125rem", weight: 600, lineHeight: 1.2, letterSpacing: "0.02em" },
    numeric: { size: "0.875rem", weight: 500, lineHeight: 1.2, letterSpacing: "0em" },
  } as const,
} as const;

/** Elevation (plan §42.8) — minimal; cards default to border + surface contrast. */
export const shadows = {
  elevation1: "0 1px 2px rgba(15, 23, 42, 0.05)",
  elevation2: "0 4px 12px rgba(15, 23, 42, 0.08)",
  elevation3: "0 16px 40px rgba(15, 23, 42, 0.16)",
  focusRing: "0 0 0 3px rgba(79, 70, 229, 0.35)",
} as const;

/** Motion (plan §42.9) — restrained; spring only for mascot celebration moments. */
export const motion = {
  durations: {
    fast: "120ms",
    normal: "220ms",
    slow: "400ms",
  },
  easings: {
    standard: "cubic-bezier(0.2, 0, 0, 1)",
    emphasis: "cubic-bezier(0.16, 1, 0.3, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

/** Interactive states (plan §42.3) — focus/selected/disabled are tokens, not afterthoughts. */
export const interactive = {
  focusRing: {
    width: "2px",
    offset: "3px",
    color: colors.primary,
  },
  selected: {
    background: colors.primarySubtle,
    border: colors.primary,
  },
  disabled: {
    background: colors.surfaceSecondary,
    text: colors.inkFaint,
    opacity: "0.6",
  },
} as const;

/** Flat map used by GlobalStyle to inject CSS custom properties. */
export const tokens = {
  colors,
  spacing,
  radii,
  typography,
  shadows,
  motion,
  breakpoints,
  interactive,
} as const;

export type Theme = typeof tokens;