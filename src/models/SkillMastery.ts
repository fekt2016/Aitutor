import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * SkillMastery — the core permanent learning record (plan §12.1).
 * A transparent weighted score 0–100 per (student, skill) with an evidence
 * gate: a skill is only "Mastered" (≥80) when it also has ≥3 recent correct
 * answers at appropriate difficulty and one spaced re-test.
 *
 * Bands (config, not hard-coded into logic):
 *   0–30 Needs support · 31–60 Developing · 61–80 Progressing · 81–100 Mastered
 */
export const MASTERY_BANDS = [
  "needs_support",
  "developing",
  "progressing",
  "mastered",
] as const;

export type MasteryBand = (typeof MASTERY_BANDS)[number];

export const MASTERY_BAND_LIMITS: Record<MasteryBand, { min: number; max: number }> = {
  needs_support: { min: 0, max: 30 },
  developing: { min: 31, max: 60 },
  progressing: { min: 61, max: 80 },
  mastered: { min: 81, max: 100 },
};

export function masteryBandForScore(score: number): MasteryBand {
  if (score <= 30) return "needs_support";
  if (score <= 60) return "developing";
  if (score <= 80) return "progressing";
  return "mastered";
}

const skillMasterySchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    band: {
      type: String,
      enum: {
        values: MASTERY_BANDS,
        message: "Unknown mastery band.",
      },
      default: "needs_support",
    },
    /** Number of graded answers that contributed to the score. */
    evidenceCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Recent correct answers (last ≤10) — feeds the evidence gate. */
    recentCorrect: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** Times the skill was re-tested after first reaching a band. */
    retests: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastTestedAt: {
      type: Date,
      default: null,
    },
    /** Next spaced-review due date (Phase 3 queue; set now, used later). */
    reviewDueAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// UNIQUE (studentId, skillId) — one mastery record per skill per student (§27).
skillMasterySchema.index({ studentId: 1, skillId: 1 }, { unique: true });
skillMasterySchema.index({ studentId: 1, reviewDueAt: 1 });

export type SkillMastery = InferSchemaType<typeof skillMasterySchema>;

export const SkillMasteryModel =
  (mongoose.models.SkillMastery as Model<SkillMastery> | undefined) ??
  mongoose.model<SkillMastery>("SkillMastery", skillMasterySchema);