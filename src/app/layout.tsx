import type { Metadata } from "next";
import { Nunito_Sans, Geist_Mono } from "next/font/google";
import StyledComponentsRegistry from "@/lib/registry";
import { GlobalStyle } from "@/styles/GlobalStyle";

// Type family (plan §42.5): Nunito Sans — warm, rounded strokes, excellent
// readability for children, professional at the same time. One family drives
// both display and body. Loaded under `--font-nunito` and mapped to
// `--font-sans`/`--font-display` in tokens.ts (never self-referencing, so the
// stack can't break into browser-default serif). Geist Mono stays for
// tabular numbers (stats, cost).
const nunitoSans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "EazWorld AI Tutor",
    template: "%s · EazWorld AI Tutor",
  },
  description:
    "A safe, personalized, adaptive AI tutor for primary school children, aligned to the Ghana NaCCA curriculum.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunitoSans.variable} ${geistMono.variable}`}>
      <body>
        <StyledComponentsRegistry>
          <GlobalStyle />
          {children}
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
