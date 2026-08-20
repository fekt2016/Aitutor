"use client";

/**
 * EazWorld brand mark (plan §42.10) — geometric open-book glyph in a rounded-
 * square indigo tile with an amber spark. Replaces the previous 🎓 emoji.
 *
 * Purely decorative (aria-hidden); wordmark lockups are composed at call sites
 * with <Wordmark /> or inline text.
 */

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 40, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Rounded-square tile (radius ≈ md scale) */}
      <rect width="44" height="44" rx="10" fill="var(--color-primary)" />
      {/* Open book */}
      <g
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11h5.5a3.5 3.5 0 0 1 3.5 3.5v18a3 3 0 0 0-3-3H9z" />
        <path d="M35 11h-5.5a3.5 3.5 0 0 0-3.5 3.5v18a3 3 0 0 1 3-3H35z" />
      </g>
      {/* Amber spark — warmth, encouragement */}
      <path
        d="M31.5 7.5l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z"
        fill="var(--color-accent)"
      />
    </svg>
  );
}

/** Wordmark lockup: "EazWorld AI Tutor" — display face, primary emphasis on "AI Tutor". */
export function Wordmark({ size = "h3" }: { size?: "h3" | "body" }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--font-weight-bold)",
        fontSize: size === "h3" ? "var(--text-h3)" : "var(--text-body-lg)",
        letterSpacing: "-0.01em",
        color: "var(--color-ink)",
        whiteSpace: "nowrap",
      }}
    >
      EazWorld <span style={{ color: "var(--color-primary)" }}>AI Tutor</span>
    </span>
  );
}