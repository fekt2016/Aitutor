"use client";

/**
 * Shared icon set (plan §42.10) — wraps `react-icons/lu` (Lucide set, 24px
 * grid, 2px stroke) so every icon in the project flows through one API with
 * consistent sizes and no emoji in UI chrome.
 *
 * Usage: <Icon name="shield-check" size={20} />
 */
import type { IconType } from "react-icons";
import {
  LuArrowRight,
  LuBookOpen,
  LuCheck,
  LuChevronRight,
  LuCircleX,
  LuClock,
  LuEye,
  LuEyeOff,
  LuGraduationCap,
  LuInfo,
  LuLock,
  LuLogOut,
  LuMail,
  LuPlus,
  LuShieldCheck,
  LuSparkles,
  LuStar,
  LuTarget,
  LuTrendingUp,
  LuTriangleAlert,
  LuUser,
  LuZap,
} from "react-icons/lu";

export type IconName =
  | "book-open"
  | "shield-check"
  | "target"
  | "sparkles"
  | "star"
  | "eye"
  | "eye-off"
  | "plus"
  | "logout"
  | "check"
  | "alert-triangle"
  | "x-circle"
  | "info"
  | "arrow-right"
  | "graduation-cap"
  | "user"
  | "mail"
  | "trending-up"
  | "chevron-right"
  | "clock"
  | "lock"
  | "zap";

const ICONS: Record<IconName, IconType> = {
  "book-open": LuBookOpen,
  "shield-check": LuShieldCheck,
  target: LuTarget,
  sparkles: LuSparkles,
  star: LuStar,
  eye: LuEye,
  "eye-off": LuEyeOff,
  plus: LuPlus,
  logout: LuLogOut,
  check: LuCheck,
  "alert-triangle": LuTriangleAlert,
  "x-circle": LuCircleX,
  info: LuInfo,
  "arrow-right": LuArrowRight,
  "graduation-cap": LuGraduationCap,
  user: LuUser,
  mail: LuMail,
  "trending-up": LuTrendingUp,
  "chevron-right": LuChevronRight,
  clock: LuClock,
  lock: LuLock,
  zap: LuZap,
};

interface IconProps {
  name: IconName;
  /** Rendered size in px (default 20). Icons keep their 24px stroke weight. */
  size?: number;
  /** Solid fill (stars, celebratory accents) instead of stroke. */
  filled?: boolean;
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}

export function Icon({ name, size = 20, filled = false, className, ...rest }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph size={size} className={className} fill={filled ? "currentColor" : "none"} {...rest} />;
}