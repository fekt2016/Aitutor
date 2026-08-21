import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Strand — top of the curriculum taxonomy under a Subject (plan §6, §27).
 * e.g. Mathematics → "Number", English → "Reading".
 */
const strandSchema = new Schema(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
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

strandSchema.index({ subjectId: 1, sortOrder: 1 });

export type Strand = InferSchemaType<typeof strandSchema>;

export const StrandModel =
  (mongoose.models.Strand as Model<Strand> | undefined) ??
  mongoose.model<Strand>("Strand", strandSchema);