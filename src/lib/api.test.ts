import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readJson, ok, created, noContent, toErrorResponse } from "./api";
import { AppError } from "./errors";

function makeRequest(body: string | null, contentType = "application/json"): NextRequest {
  return new NextRequest("http://localhost:3000/api/v1/auth/register", {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : undefined,
    body: body ?? undefined,
  });
}

describe("readJson", () => {
  it("parses a valid body and strips nothing", async () => {
    const req = makeRequest(JSON.stringify({ email: "a@b.com", password: "secret1" }));
    await expect(readJson(req)).resolves.toEqual({ email: "a@b.com", password: "secret1" });
  });

  it("rejects unknown fields when an allow-list is given", async () => {
    const req = makeRequest(JSON.stringify({ email: "a@b.com", admin: true }));
    await expect(readJson(req, { allowedFields: ["email"] })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("accepts only allow-listed fields", async () => {
    const req = makeRequest(JSON.stringify({ email: "a@b.com" }));
    await expect(readJson(req, { allowedFields: ["email"] })).resolves.toEqual({
      email: "a@b.com",
    });
  });

  it("rejects malformed JSON", async () => {
    const req = makeRequest("{nope");
    await expect(readJson(req)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an empty body", async () => {
    await expect(readJson(makeRequest(""))).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects non-object JSON", async () => {
    await expect(readJson(makeRequest("[1,2]"))).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });

  it("rejects oversized bodies", async () => {
    const big = JSON.stringify({ data: "x".repeat(1000) });
    await expect(readJson(makeRequest(big), { maxLength: 100 })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("envelope helpers", () => {
  it("ok wraps data in the success envelope", async () => {
    const res = ok({ user: "x" });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true, data: { user: "x" } });
  });

  it("created returns 201", () => {
    expect(created({ id: 1 }).status).toBe(201);
  });

  it("noContent returns 204 with no body", () => {
    const res = noContent();
    expect(res.status).toBe(204);
    expect(res.body).toBeNull();
  });
});

describe("toErrorResponse", () => {
  it("maps AppError to the error envelope with correct status", async () => {
    const res = toErrorResponse(AppError.unauthorized());
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      success: false,
      error: { code: "UNAUTHORIZED", message: "You need to be logged in." },
    });
  });

  it("maps unknown errors to a generic 500", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("INTERNAL");
  });
});
