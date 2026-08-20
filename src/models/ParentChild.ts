import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * ParentChild — enrollment link (plan §27, §3).
 * A child has exactly one parent link in MVP (unique on childId).
 */
const parentChildSchema = new Schema(
  {
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    childId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // a child has one parent (MVP)
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

parentChildSchema.index({ parentId: 1, childId: 1 });

export type ParentChild = InferSchemaType<typeof parentChildSchema>;

export const ParentChildModel =
  (mongoose.models.ParentChild as Model<ParentChild> | undefined) ??
  mongoose.model<ParentChild>("ParentChild", parentChildSchema);
