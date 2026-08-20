import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password helpers", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-42");
    expect(hash).not.toContain("correct-horse-42");
    await expect(verifyPassword("correct-horse-42", hash)).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct-horse-42");
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("produces different hashes for the same input (salting)", async () => {
    const [a, b] = await Promise.all([hashPassword("same"), hashPassword("same")]);
    expect(a).not.toBe(b);
  });

  it("never trims passwords — spaces are significant (login compares raw)", async () => {
    const raw = "  secret pass 123  ";
    const hash = await hashPassword(raw);
    // The exact raw value must verify; a trimmed value must NOT.
    await expect(verifyPassword(raw, hash)).resolves.toBe(true);
    await expect(verifyPassword(raw.trim(), hash)).resolves.toBe(false);
  });
});
