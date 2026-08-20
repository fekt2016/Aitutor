import { describe, it, expect } from "vitest";
import { AppError, toErrorBody, isAppError } from "./errors";

describe("AppError", () => {
  it("constructs a typed operational error", () => {
    const err = AppError.forbidden("nope");
    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.statusCode).toBe(403);
    expect(err.isOperational).toBe(true);
  });

  it("static helpers carry the right status/code", () => {
    expect(AppError.validation("x").statusCode).toBe(400);
    expect(AppError.unauthorized().code).toBe("UNAUTHORIZED");
    expect(AppError.notFound().statusCode).toBe(404);
    expect(AppError.conflict("x").code).toBe("CONFLICT");
    expect(AppError.rateLimited().statusCode).toBe(429);
    expect(AppError.dependencyUnavailable().statusCode).toBe(503);
  });
});

describe("toErrorBody", () => {
  it("passes AppError fields through safely", () => {
    const err = AppError.validation("Bad value.", { field: "age" });
    expect(toErrorBody(err)).toEqual({
      code: "VALIDATION_ERROR",
      message: "Bad value.",
      details: { field: "age" },
    });
  });

  it("maps Mongoose validation errors to 400-style bodies", () => {
    const mongooseLike = {
      name: "ValidationError",
      message: "User validation failed",
      errors: { email: { message: "Please provide a valid email address." } },
    };
    expect(toErrorBody(mongooseLike)).toEqual({
      code: "VALIDATION_ERROR",
      message: "User validation failed",
      details: { email: "Please provide a valid email address." },
    });
  });

  it("maps cast errors to generic validation", () => {
    expect(toErrorBody({ name: "CastError" })).toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("maps duplicate keys to conflict", () => {
    expect(toErrorBody({ code: 11000 })).toMatchObject({ code: "CONFLICT" });
  });

  it("never leaks internals for unknown errors", () => {
    const body = toErrorBody(new Error("secret db password in message"));
    expect(body.code).toBe("INTERNAL");
    expect(body.message).not.toContain("secret");
    expect(body.details).toBeUndefined(); // NODE_ENV is "test" in the setup
  });
});
