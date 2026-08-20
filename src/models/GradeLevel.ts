import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * GradeLevel — Ghana primary bands (plan §4).
 * No hard-coded age behavior: adaptive parameters (vocabulary, depth,
 * style, reading level) live here and are resolved at runtime.
 */
const gradeLevelSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      enum: {
        values: ["KG1", "KG2", "KG3", "Basic1", "Basic2", "Basic3", "Basic4", "Basic5", "Basic6"],
        message: "Unknown grade level code.",
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 40,
    },
    minAge: { type: Number, required: true, min: 4, max: 14 },
    maxAge: { type: Number, required: true, min: 4, max: 14 },
    vocabularyLevel: { type: Number, required: true, min: 1, max: 5 },
    explanationDepth: { type: Number, required: true, min: 1, max: 5 },
    readingLevel: { type: String, default: "" },
    interactionStyle: {
      type: String,
      enum: {
        values: ["playful", "guided", "independent"],
        default: "playful",
        message: "Unknown interaction style.",
      },
      default: "playful",
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

export type GradeLevel = InferSchemaType<typeof gradeLevelSchema>;

export const GradeLevelModel =
  (mongoose.models.GradeLevel as Model<GradeLevel> | undefined) ??
  mongoose.model<GradeLevel>("GradeLevel", gradeLevelSchema);
