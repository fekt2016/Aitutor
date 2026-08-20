import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Skill — the unit of mastery (plan §6, §12, §27).
 * `code` unique (e.g. "add-subtract-within-20"); carries a default difficulty
 * and (from Phase 3) a `requiresSkillId` prerequisite. Mastery is tracked per
 * skill, so skill names must be stable, single-responsibility concepts.
 */
const skillSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 60,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    contentStandardId: {
      type: Schema.Types.ObjectId,
      ref: "ContentStandard",
      required: true,
    },
    /** Phase 3 prerequisite graph (§12.1) — null until then. */
    requiresSkillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      default: null,
    },
    description: {
      type: String,
      default: "",
      maxlength: 500,
    },
    defaultDifficulty: {
      type: Number,
      default: 3,
      min: 1,
      max: 5,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

skillSchema.index({ contentStandardId: 1 });
skillSchema.index({ requiresSkillId: 1 });
skillSchema.index({ active: 1 });

export type Skill = InferSchemaType<typeof skillSchema>;

export const SkillModel =
  (mongoose.models.Skill as Model<Skill> | undefined) ??
  mongoose.model<Skill>("Skill", skillSchema);