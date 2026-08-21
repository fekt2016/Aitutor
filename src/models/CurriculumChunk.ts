import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * CurriculumChunk — retrievable unit of curriculum content (plan §6.2, §14).
 * One row per lesson body / definition / example / practice explanation so
 * the tutor can semantically find supporting material beyond the current
 * lesson. The AI reasons over these chunks; it never invents curriculum.
 *
 * NOTE (§14): Atlas Search + Vector Search indexes are created OUT OF BAND
 * (Atlas console / scripts/atlas-search-indexes.json) — Mongoose cannot
 * create them. On clusters without them (M0 free tier) retrieval falls back
 * to $text / regex queries (see features/tutor/curriculum/retrieval.ts).
 */

export const CHUNK_SOURCE_TYPES = ["lesson", "definition", "example", "practice"] as const;
export type ChunkSourceType = (typeof CHUNK_SOURCE_TYPES)[number];

const curriculumChunkSchema = new Schema(
  {
    sourceType: {
      type: String,
      required: true,
      enum: {
        values: CHUNK_SOURCE_TYPES,
        message: "Unknown chunk source type.",
      },
    },
    /** Lesson/Skill/PracticeItem this chunk was derived from. */
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    skillId: {
      type: Schema.Types.ObjectId,
      ref: "Skill",
      default: null,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: "Subject",
      default: null,
    },
    gradeLevelId: {
      type: Schema.Types.ObjectId,
      ref: "GradeLevel",
      default: null,
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    /** text-embedding-3-small vector (1536-dim). null until embeddings are backfilled. */
    embedding: {
      type: [Number],
      default: null,
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

curriculumChunkSchema.index({ skillId: 1, active: 1 });
curriculumChunkSchema.index({ subjectId: 1, gradeLevelId: 1, active: 1 });
curriculumChunkSchema.index({ sourceType: 1, sourceId: 1 });
/** Standard text index — the relevance fallback on clusters without Atlas Search. */
curriculumChunkSchema.index({ title: "text", content: "text" });

export type CurriculumChunk = InferSchemaType<typeof curriculumChunkSchema>;

export const CurriculumChunkModel =
  (mongoose.models.CurriculumChunk as Model<CurriculumChunk> | undefined) ??
  mongoose.model<CurriculumChunk>("CurriculumChunk", curriculumChunkSchema);
