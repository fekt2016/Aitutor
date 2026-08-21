import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { TutorSessionModel } from "./TutorSession";

/**
 * Regression guard: schema defaults must satisfy their own validators.
 * `completionReason` used to default to "" while its enum only allowed
 * completed/student_ended/timeout/abandoned — so every create() failed
 * validation ("Unknown completion reason") and POST /tutor/sessions 400'd.
 * validateSync() runs over applied defaults, no DB connection required.
 */
describe("TutorSession schema", () => {
  const studentId = new mongoose.Types.ObjectId();

  it("a fresh session (defaults only) passes validation", () => {
    const doc = new TutorSessionModel({ studentId });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
    expect(doc.completionReason).toBeNull();
  });

  it("still rejects unknown completion reasons when set explicitly", () => {
    const doc = new TutorSessionModel({ studentId, completionReason: "whatever" });
    const error = doc.validateSync();
    expect(error?.errors.completionReason).toBeDefined();
  });

  it("accepts each documented completion reason", () => {
    for (const reason of ["completed", "student_ended", "timeout", "abandoned"] as const) {
      const doc = new TutorSessionModel({ studentId, completionReason: reason });
      expect(doc.validateSync()?.errors.completionReason).toBeUndefined();
    }
  });
});
