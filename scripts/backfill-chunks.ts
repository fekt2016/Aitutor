/**
 * Curriculum chunk backfill (plan §14) — derives CurriculumChunk documents
 * from the seeded curriculum and optionally embeds them for Vector Search.
 *
 * Idempotent: re-running replaces each skill's chunks (delete + insert).
 * Embedding is opt-in (--embed) so chunking works without an OpenAI key;
 * unembedded chunks still serve Tier B/C text retrieval on any cluster.
 *
 * Run:  npm run backfill:chunks            # chunks only
 *       npm run backfill:chunks -- --embed # chunks + embeddings
 */
import mongoose from "mongoose";
import { substitutePassword } from "../src/server/env";
import { CurriculumChunkModel } from "../src/models";
import {
  reindexAllCurriculum,
  findUnembeddedChunks,
  saveEmbeddings,
} from "../src/features/tutor/curriculum/chunker";
import { getProvider } from "../src/features/tutor/providers";

const EMBED_BATCH = 100;
/** The shared key throttles easily (see §18 moderation fix) — retry with backoff. */
const RETRIES = 5;
const BACKOFF_MS = [2_000, 5_000, 10_000, 20_000, 40_000];

async function embedWithRetry(texts: string[]): Promise<{ vectors: number[][]; model: string }> {
  const provider = getProvider();
  for (let attempt = 0; ; attempt++) {
    try {
      return await provider.embed({ texts });
    } catch (error) {
      if (attempt >= RETRIES || !(error instanceof Error) || error.message !== "provider_rate_limited") {
        throw error;
      }
      const wait = BACKOFF_MS[attempt] ?? 60_000;
      console.warn(`  rate limited — retry ${attempt + 1}/${RETRIES} in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}

async function main(): Promise<void> {
  const embed = process.argv.includes("--embed");
  const mongoUrl = substitutePassword(process.env.MONGO_URL ?? "", process.env.DATABASE_PASSWORD);
  if (!mongoUrl) {
    console.error("MONGO_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });
  console.log("Connected. Re-indexing curriculum chunks…");

  const { skills, chunks } = await reindexAllCurriculum();
  console.log(`Re-indexed ${chunks} chunks across ${skills} skills.`);

  if (!embed) {
    const pending = await CurriculumChunkModel.countDocuments({ embedding: null });
    if (pending > 0) {
      console.log(
        `${pending} chunks await embeddings (re-run with --embed once OPENAI_API_KEY is set).`
      );
    }
    await mongoose.disconnect();
    return;
  }

  let done = 0;
  for (;;) {
    const batch = await findUnembeddedChunks(EMBED_BATCH);
    if (batch.length === 0) break;
    const { vectors, model } = await embedWithRetry(batch.map((c) => c.content));
    await saveEmbeddings(batch, vectors);
    done += batch.length;
    console.log(`  embedded ${done} chunks (${model})`);
  }

  console.log(`Backfill complete ✓ (${done} embeddings written)`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
