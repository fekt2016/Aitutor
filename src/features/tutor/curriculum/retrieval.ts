/**
 * Curriculum retrieval (plan §14) — hybrid-ready with graceful degradation.
 *
 * Tier A: Atlas Search ($search) — needs M10+ and a search index named
 *   "curriculum_chunks" (created out of band; see models/CurriculumChunk.ts).
 * Tier B: standard $text index search — works on ANY cluster including M0.
 * Tier C: escaped-regex term match — last resort if the text index is missing.
 *
 * Vector Search joins as Tier A+ once embeddings are backfilled (Phase 2);
 * the caller contract below does not change. Never throws to callers — a
 * retrieval problem must not break a child's turn (§37); empty hits are fine.
 */
import mongoose from "mongoose";
import { CurriculumChunkModel, type CurriculumChunk } from "@/models";

export const ATLAS_SEARCH_INDEX = "curriculum_chunks";
/** Per-hit clamp — the memory builder owns the total curriculum budget (§13). */
const MAX_CONTENT_CHARS = 1200;
const MAX_TERMS = 5;

export interface CurriculumHit {
  chunkId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  content: string;
  score?: number;
}

export interface SearchCurriculumInput {
  query: string;
  subjectId?: string | null;
  skillId?: string | null;
  gradeLevelId?: string | null;
  limit?: number;
}

export async function searchCurriculum(input: SearchCurriculumInput): Promise<CurriculumHit[]> {
  const limit = Math.min(Math.max(input.limit ?? 3, 1), 10);
  try {
    return await atlasSearch(input, limit);
  } catch {
    return await fallbackSearch(input, limit);
  }
}

/* ---------------------------- Tier A: $search ---------------------------- */

async function atlasSearch(input: SearchCurriculumInput, limit: number): Promise<CurriculumHit[]> {
  const rows = await CurriculumChunkModel.aggregate([
    {
      $search: {
        index: ATLAS_SEARCH_INDEX,
        text: { query: input.query, path: ["title", "content"] },
      },
    },
    { $match: { active: true, ...idFilters(input) } },
    { $limit: limit },
    {
      $project: {
        sourceType: 1,
        sourceId: 1,
        title: 1,
        content: 1,
        score: { $meta: "searchScore" },
      },
    },
  ]);
  return rows.map((row: Record<string, unknown>) => toHit(row, row.score as number | undefined));
}

/* --------------------- Tiers B/C: text index → regex --------------------- */

function escapeRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fallbackSearch(input: SearchCurriculumInput, limit: number): Promise<CurriculumHit[]> {
  const filters = { active: true, ...idFilters(input) };

  // Tier B — real relevance scoring from the standard text index.
  try {
    const docs = await CurriculumChunkModel.find({ $text: { $search: input.query }, ...filters })
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();
    return docs.map((doc) => toHit(doc));
  } catch {
    // fall through to regex
  }

  // Tier C — deterministic term matching (works even with no text index).
  const terms = input.query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
    .slice(0, MAX_TERMS);

  const query = terms.length
    ? {
        ...filters,
        $or: terms.flatMap((term) => {
          const rx = new RegExp(escapeRegex(term), "i");
          return [{ title: rx }, { content: rx }];
        }),
      }
    : filters;

  const docs = await CurriculumChunkModel.find(query).sort({ createdAt: -1 }).limit(limit).lean();
  return docs.map((doc) => toHit(doc));
}

/* -------------------------------- helpers -------------------------------- */

function idFilters(input: SearchCurriculumInput): Record<string, mongoose.Types.ObjectId> {
  const filters: Record<string, mongoose.Types.ObjectId> = {};
  for (const key of ["subjectId", "skillId", "gradeLevelId"] as const) {
    const value = input[key];
    if (value && mongoose.Types.ObjectId.isValid(value)) {
      filters[key] = new mongoose.Types.ObjectId(value);
    }
  }
  return filters;
}

type ChunkLike = CurriculumChunk | Record<string, unknown>;

function toHit(doc: ChunkLike, score?: number): CurriculumHit {
  const d = doc as {
    _id: { toString(): string };
    sourceType?: string;
    sourceId?: { toString(): string };
    title?: string;
    content?: string;
  };
  const content = d.content ?? "";
  return {
    chunkId: d._id.toString(),
    sourceType: d.sourceType ?? "lesson",
    sourceId: d.sourceId?.toString() ?? "",
    title: d.title ?? "",
    content: content.length > MAX_CONTENT_CHARS ? `${content.slice(0, MAX_CONTENT_CHARS)}…` : content,
    ...(score !== undefined ? { score } : {}),
  };
}
