import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * ContentStandard — a NaCCA content standard, grade-specific (plan §6, §27).
 * `code` is unique + human-readable, e.g. "B1.1.1.1" (Basic 1, strand 1,
 * substrand 1, indicator 1). The objective is the teaching target.
 */
const contentStandardSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    substrandId: {
      type: Schema.Types.ObjectId,
      ref: "SubStrand",
      required: true,
    },
    gradeLevelId: {
      type: Schema.Types.ObjectId,
      ref: "GradeLevel",
      required: true,
    },
    objective: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    exemplars: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

contentStandardSchema.index({ substrandId: 1, gradeLevelId: 1 });
contentStandardSchema.index({ gradeLevelId: 1 });

export type ContentStandard = InferSchemaType<typeof contentStandardSchema>;

export const ContentStandardModel =
  (mongoose.models.ContentStandard as Model<ContentStandard> | undefined) ??
  mongoose.model<ContentStandard>("ContentStandard", contentStandardSchema);