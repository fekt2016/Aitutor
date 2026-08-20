import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * SubStrand — second level of the curriculum taxonomy (plan §6, §27).
 * e.g. "Number" → "Number Operations".
 */
const subStrandSchema = new Schema(
  {
    strandId: {
      type: Schema.Types.ObjectId,
      ref: "Strand",
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

subStrandSchema.index({ strandId: 1, sortOrder: 1 });

export type SubStrand = InferSchemaType<typeof subStrandSchema>;

export const SubStrandModel =
  (mongoose.models.SubStrand as Model<SubStrand> | undefined) ??
  mongoose.model<SubStrand>("SubStrand", subStrandSchema);