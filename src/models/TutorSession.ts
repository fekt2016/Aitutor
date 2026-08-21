import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * TutorSession — skeleton for Phase 0 (plan §17, §27).
 * Fields grow with the tutor pipeline (summary, signals, stats) in Phase 1.
 */
const tutorSessionSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      default: null,
    },
    goal: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },
    status: {
      type: String,
      enum: {
        values: ["active", "ended", "abandoned"],
        message: "Unknown session status.",
      },
      default: "active",
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 3,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    completionReason: {
      type: String,
      enum: {
        values: ["completed", "student_ended", "timeout", "abandoned"],
        message: "Unknown completion reason.",
      },
      // null until the session ends — "" would fail its own enum validation
      // on create() (defaults are validated), which 400'd every new session.
      default: null,
    },
    summary: {
      type: String,
      default: "",
    },
    aiCostTokens: {
      type: Number,
      min: 0,
      default: 0,
    },
    stats: {
      type: new Schema(
        {
          messages: { type: Number, default: 0 },
          correct: { type: Number, default: 0 },
          wrong: { type: Number, default: 0 },
          hintsUsed: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

tutorSessionSchema.index({ studentId: 1, startedAt: -1 });
tutorSessionSchema.index({ status: 1, startedAt: -1 });

export type TutorSession = InferSchemaType<typeof tutorSessionSchema>;

/** A hydrated/lean session doc carrying `_id` (what routes/services pass around). */
export type TutorSessionDoc = TutorSession & { _id: mongoose.Types.ObjectId };

export const TutorSessionModel =
  (mongoose.models.TutorSession as Model<TutorSession> | undefined) ??
  mongoose.model<TutorSession>("TutorSession", tutorSessionSchema);
