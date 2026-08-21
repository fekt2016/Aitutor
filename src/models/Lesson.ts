import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Lesson — the teaching content for a skill (plan §6, §27).
 * `markdownBody` is the grounding material the orchestrator feeds the model —
 * the model reasons over THIS, never invents curriculum.
 */
const lessonSchema = new Schema(
  {
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    markdownBody: {
      type: String,
      required: true,
      maxlength: 12000,
    },
    examples: {
      type: [String],
      default: [],
    },
    sortOrder: {
      type: Number,
      default: 0,
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

lessonSchema.index({ skillId: 1, sortOrder: 1 });

export type Lesson = InferSchemaType<typeof lessonSchema>;

export const LessonModel =
  (mongoose.models.Lesson as Model<Lesson> | undefined) ??
  mongoose.model<Lesson>("Lesson", lessonSchema);