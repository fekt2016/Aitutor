import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * UsageLog — AI cost attribution per provider call (plan §29, §30).
 * Written for every provider call: task, model, tokens, costUsd.
 * NO message content, NO PII — ids + counts only. Daily rollup in Phase 6.
 */
const usageLogSchema = new Schema(
  {
    date: {
      type: String, // YYYY-MM-DD for cheap daily rollups
      required: true,
    },
    task: {
      type: String,
      required: true,
      maxlength: 40,
    },
    model: {
      type: String,
      default: "",
      maxlength: 60,
    },
    tokensIn: {
      type: Number,
      default: 0,
      min: 0,
    },
    tokensOut: {
      type: Number,
      default: 0,
      min: 0,
    },
    costUsd: {
      type: Number,
      default: 0,
      min: 0,
    },
    latencyMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      default: "ok",
      maxlength: 20,
    },
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
  },
  {
    timestamps: true,
    strict: true,
  }
);

usageLogSchema.index({ date: 1, task: 1 });
usageLogSchema.index({ sessionId: 1 });

export type UsageLog = InferSchemaType<typeof usageLogSchema>;

export const UsageLogModel =
  (mongoose.models.UsageLog as Model<UsageLog> | undefined) ??
  mongoose.model<UsageLog>("UsageLog", usageLogSchema);