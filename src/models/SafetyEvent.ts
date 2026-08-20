import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * SafetyEvent — every moderation verdict worth remembering (plan §18.8).
 * Stores category counts and a verdict, NEVER the offending content or PII
 * (parents/admins see counts + category, not transcripts, by default).
 */
const SAFETY_KINDS = ["input_moderation", "output_moderation", "rate_limit", "bypass_attempt"] as const;

export type SafetyKind = (typeof SAFETY_KINDS)[number];

const safetyEventSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TutorSession",
      default: null,
    },
    kind: {
      type: String,
      required: true,
      enum: {
        values: SAFETY_KINDS,
        message: "Unknown safety event kind.",
      },
    },
    /** Moderation categories that fired (e.g. ["harassment", "sexual"]). */
    categories: {
      type: [String],
      default: [],
    },
    verdict: {
      type: String,
      required: true,
      maxlength: 20,
    },
    /** Machine detail only — counts/hashes, no content. */
    detail: {
      type: String,
      default: "",
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

safetyEventSchema.index({ createdAt: -1 });
safetyEventSchema.index({ kind: 1, createdAt: -1 });
safetyEventSchema.index({ studentId: 1, createdAt: -1 });

export type SafetyEvent = InferSchemaType<typeof safetyEventSchema>;

export const SafetyEventModel =
  (mongoose.models.SafetyEvent as Model<SafetyEvent> | undefined) ??
  mongoose.model<SafetyEvent>("SafetyEvent", safetyEventSchema);