import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * TutorMessage — skeleton for Phase 0 (plan §17, §27).
 * Content types: text | mcq | structured; safety sub-document records the
 * moderation verdict. Raw free-text transcripts are purged per retention
 * policy (§19) — summaries + signals persist instead.
 */
const tutorMessageSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "TutorSession",
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: {
        values: ["user", "assistant", "system", "tool"],
        message: "Unknown message role.",
      },
    },
    contentType: {
      type: String,
      required: true,
      enum: {
        values: ["text", "mcq", "structured"],
        message: "Unknown content type.",
      },
      default: "text",
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    safety: {
      type: new Schema(
        {
          moderated: { type: Boolean, default: false },
          verdict: { type: String, default: "" },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    model: {
      type: String,
      default: "",
    },
    tokensIn: {
      type: Number,
      min: 0,
      default: 0,
    },
    tokensOut: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

tutorMessageSchema.index({ sessionId: 1, createdAt: 1 });

export type TutorMessage = InferSchemaType<typeof tutorMessageSchema>;

export const TutorMessageModel =
  (mongoose.models.TutorMessage as Model<TutorMessage> | undefined) ??
  mongoose.model<TutorMessage>("TutorMessage", tutorMessageSchema);
