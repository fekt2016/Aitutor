import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * StudentProfile — permanent, minimal per-student learning record (plan §11).
 * Exactly what the tutor needs; nothing more. No birthdate, no address.
 */
const studentProfileSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    gradeLevelId: {
      type: Schema.Types.ObjectId,
      ref: "GradeLevel",
      default: null,
    },
    language: {
      type: String,
      default: "en",
      enum: {
        values: ["en", "tw"],
        message: "Unsupported language.",
      },
    },
    preferences: {
      type: Map,
      of: String,
      default: () => new Map(),
    },
    dailySessionLimit: {
      type: Number,
      default: 3,
      min: 1,
      max: 20,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

export type StudentProfile = InferSchemaType<typeof studentProfileSchema>;

export const StudentProfileModel =
  (mongoose.models.StudentProfile as Model<StudentProfile> | undefined) ??
  mongoose.model<StudentProfile>("StudentProfile", studentProfileSchema);
