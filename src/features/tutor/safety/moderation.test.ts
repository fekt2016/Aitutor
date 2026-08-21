import { describe, it, expect, vi, afterEach } from "vitest";
import { SafetyEventModel } from "@/models";
import type { AiProvider, ModerationResult } from "../providers/types";
import { ModerationUnavailableError } from "../providers/types";
import {
  moderateInput,
  resetModerationCooldown,
} from "./moderation";

/**
 * §18 policy tests — provider moderation is ONE layer of several. When it
 * fails (429/outage) the local classifier verdict stands: flagged input still
 * blocks, benign input proceeds through the remaining layers instead of
 * every turn being blocked (regression: adapter used to fake flagged=true).
 */

function mockProvider(moderate: ReturnType<typeof vi.fn>): AiProvider {
  return { name: "mock", complete: vi.fn(), stream: vi.fn(), moderate } as unknown as AiProvider;
}

function unavailable(status = 429): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new ModerationUnavailableError("Too Many Requests", status));
}

const BENIGN = "What is 8 + 4?";

afterEach(() => {
  vi.restoreAllMocks();
  resetModerationCooldown();
});

describe("moderateInput — provider unavailability (§18)", () => {
  it("benign message passes on the local verdict when the provider is down", async () => {
    const createSpy = vi.spyOn(SafetyEventModel, "create").mockResolvedValue(null as never);
    const provider = mockProvider(unavailable());

    const verdict = await moderateInput(provider, { text: BENIGN });

    expect(verdict.flagged).toBe(false);
    expect(verdict.source).toBe("local");
    // Unavailability is observable without content.
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ verdict: "provider_unavailable", categories: [] })
    );
  });

  it("locally-flagged input still blocks before the provider is consulted", async () => {
    vi.spyOn(SafetyEventModel, "create").mockResolvedValue(null as never);
    const moderate = unavailable();
    const provider = mockProvider(moderate);

    const verdict = await moderateInput(provider, { text: "you are so sexy" });

    expect(verdict.flagged).toBe(true);
    expect(verdict.categories).toContain("sexual");
    expect(moderate).not.toHaveBeenCalled();
  });

  it("cooldown: after a failure the provider is not called again immediately", async () => {
    vi.spyOn(SafetyEventModel, "create").mockResolvedValue(null as never);
    const moderate = unavailable();
    const provider = mockProvider(moderate);

    await moderateInput(provider, { text: BENIGN });
    const second = await moderateInput(provider, { text: "Tell me about fractions" });

    expect(second.flagged).toBe(false);
    expect(second.source).toBe("local");
    expect(moderate).toHaveBeenCalledTimes(1); // skipped during cooldown
  });

  it("resetModerationCooldown restores provider checks", async () => {
    vi.spyOn(SafetyEventModel, "create").mockResolvedValue(null as never);
    const moderate = unavailable();
    const provider = mockProvider(moderate);

    await moderateInput(provider, { text: BENIGN });
    resetModerationCooldown();
    await moderateInput(provider, { text: BENIGN });

    expect(moderate).toHaveBeenCalledTimes(2);
  });

  it("a provider flag still blocks with provider categories", async () => {
    vi.spyOn(SafetyEventModel, "create").mockResolvedValue(null as never);
    const moderate = vi.fn().mockResolvedValue({
      flagged: true,
      categories: ["violence"],
    } satisfies ModerationResult);
    const provider = mockProvider(moderate);

    const verdict = await moderateInput(provider, { text: BENIGN });

    expect(verdict.flagged).toBe(true);
    expect(verdict.source).toBe("provider");
    expect(verdict.categories).toContain("violence");
  });
});
