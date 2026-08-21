import { describe, it, expect } from "vitest";
import { checkAssistantOutput, fallbackFor, MAX_RESPONSE_CHARS } from "./output";
import { UNSAFE_OUTPUT_FALLBACK } from "./deflections";

const safeModeration = { flagged: false, categories: [] };
const flaggedModeration = { flagged: true, categories: ["violence"] };

describe("checkAssistantOutput (§18.5)", () => {
  it("passes a normal child-safe reply", () => {
    expect(checkAssistantOutput("Great job! 3 + 5 is 8.", safeModeration).safe).toBe(true);
  });

  it("rejects empty output", () => {
    const check = checkAssistantOutput("   ", safeModeration);
    expect(check.safe).toBe(false);
    expect(check.reason).toBe("empty");
  });

  it("rejects over-long output (short is better for 5–11)", () => {
    const long = "a".repeat(MAX_RESPONSE_CHARS + 1);
    const check = checkAssistantOutput(long, safeModeration);
    expect(check.safe).toBe(false);
    expect(check.reason).toBe("too_long");
  });

  it("rejects output the provider moderation flagged", () => {
    const check = checkAssistantOutput("Let's talk about something else.", flaggedModeration);
    expect(check.safe).toBe(false);
    expect(check.reason).toContain("moderation:violence");
  });

  it("rejects output that trips the local leak classifier even when the API passed it", () => {
    const check = checkAssistantOutput("Now let's talk about drugs and alcohol.", safeModeration);
    expect(check.safe).toBe(false);
    expect(check.reason).toContain("leak:");
  });

  it("fallbackFor always returns the safe fallback text", () => {
    expect(fallbackFor("moderation:violence")).toBe(UNSAFE_OUTPUT_FALLBACK);
    expect(fallbackFor("empty")).toBe(UNSAFE_OUTPUT_FALLBACK);
    expect(fallbackFor("leak:sexual")).toBe(UNSAFE_OUTPUT_FALLBACK);
  });
});