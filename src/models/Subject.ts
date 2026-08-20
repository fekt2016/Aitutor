import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Subject — top of the curriculum hierarchy (plan §5, §6).
 * Active subjects are selectable by students; adding a subject is a data
 * change, never a code change.
 */
const subjectSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      maxlength: 20,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    active: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

subjectSchema.index({ active: 1, sortOrder: 1 });

export type Subject = InferSchemaType<typeof subjectSchema>;

export const SubjectModel =
  (mongoose.models.Subject as Model<Subject> | undefined) ??
  mongoose.model<Subject>("Subject", subjectSchema);
