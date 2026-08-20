import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * LearningSignal — one graded piece of evidence from a tutor turn (plan §17).
 * Feed into SkillMastery scoring (§12): a signal only exists for real,
 * validated learning moments (answer graded, hint revealed, concept shown).
 * Never stores message content or PII.
 */
export const SIGNAL_TYPES = [
  "answer_correct",
  "answer_wrong",
  "hint_used",
  "concept_seen",
] as const;

export type SignalType = (typeof SIGNAL_TYPES)[number];

export function isSignalType(value: string): value is SignalType {
  return (SIGNAL_TYPES as readonly string[]).includes(value);
}

const learningSignalSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TutorSession",
      required: true,
    },
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
    type: {
      type: String,
      required: true,
      enum: {
        values: SIGNAL_TYPES,
        message: "Unknown signal type.",
      },
      validate: {
        validator: (v: string) => isSignalType(v),
        message: "Unknown signal type.",
      },
    },
    /** Signal strength (correct=1, wrong=0, hint=0.5, concept_seen=0.25). */
    value: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    /** Model confidence in the grade (0.5 deterministic default → 1.0). */
    confidence: {
      type: Number,
      default: 0.8,
      min: 0,
      max: 1,
    },
    /** Difficulty of the practice item / turn (1–5, adaptive). */
    difficulty: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

learningSignalSchema.index({ studentId: 1, skillId: 1, createdAt: -1 });
learningSignalSchema.index({ sessionId: 1 });

export type LearningSignal = InferSchemaType<typeof learningSignalSchema>;

export const LearningSignalModel =
  (mongoose.models.LearningSignal as Model<LearningSignal> | undefined) ??
  mongoose.model<LearningSignal>("LearningSignal", learningSignalSchema);