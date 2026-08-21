import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * PracticeItem — a seedable practice question for a skill (plan §6, §27).
 * `type`: mcq | free | step. `answer` is the canonical answer used by the
 * grading path; explanations are child-friendly. Items are validated on
 * persist: mcq must have 3–5 options and an answer that is one of them.
 */
export const PRACTICE_ITEM_TYPES = ["mcq", "free", "step"] as const;

export type PracticeItemType = (typeof PRACTICE_ITEM_TYPES)[number];

const practiceItemSchema = new Schema(
  {
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: PRACTICE_ITEM_TYPES,
        message: "Unknown practice item type.",
      },
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    options: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length === 0 || (v.length >= 3 && v.length <= 5),
        message: "Options must hold 3–5 choices (or none for free text).",
      },
    },
    answer: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    explanation: {
      type: String,
      default: "",
      maxlength: 800,
    },
    difficulty: {
      type: Number,
      required: true,
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

// (skillId, difficulty) — the practice query path (§27).
practiceItemSchema.index({ skillId: 1, difficulty: 1, active: 1 });

export type PracticeItem = InferSchemaType<typeof practiceItemSchema>;

export const PracticeItemModel =
  (mongoose.models.PracticeItem as Model<PracticeItem> | undefined) ??
  mongoose.model<PracticeItem>("PracticeItem", practiceItemSchema);