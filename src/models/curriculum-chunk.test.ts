import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { CurriculumChunkModel, CHUNK_SOURCE_TYPES } from "./CurriculumChunk";

/** Schema guard: defaults must validate; enum must hold (see tutor-session.test.ts). */
describe("CurriculumChunk schema", () => {
  const sourceId = new mongoose.Types.ObjectId();

  it("a fresh chunk (defaults only, required fields set) passes validation", () => {
    const doc = new CurriculumChunkModel({ sourceType: "lesson", sourceId, content: "Count on from the bigger number." });
    const error = doc.validateSync();
    expect(error).toBeUndefined();
    expect(doc.active).toBe(true);
    expect(doc.embedding).toBeNull();
  });

  it("requires content and rejects unknown source types", () => {
    const missingContent = new CurriculumChunkModel({ sourceType: "lesson", sourceId });
    expect(missingContent.validateSync()?.errors.content).toBeDefined();

    const badType = new CurriculumChunkModel({ sourceType: "poem", sourceId, content: "x" });
    expect(badType.validateSync()?.errors.sourceType).toBeDefined();
  });

  it("accepts every documented source type", () => {
    for (const sourceType of CHUNK_SOURCE_TYPES) {
      const doc = new CurriculumChunkModel({ sourceType, sourceId, content: "x" });
      expect(doc.validateSync()?.errors.sourceType).toBeUndefined();
    }
  });

  it("rejects oversized content", () => {
    const doc = new CurriculumChunkModel({ sourceType: "definition", sourceId, content: "x".repeat(8001) });
    expect(doc.validateSync()?.errors.content).toBeDefined();
  });
});
