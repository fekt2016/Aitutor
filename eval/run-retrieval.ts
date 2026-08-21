/**
 * Retrieval + grounding eval runner (plan §36, Phase 2 deliverable).
 *
 * Runs the golden scenarios in eval/scenarios.ts against the REAL database:
 *  1. Retrieval — each query goes through searchCurriculum's live tier chain
 *     (Atlas $search → $text → regex), scored by hit-rate + MRR.
 *  2. Grounding — each scenario builds a synthetic CurriculumBundle and runs
 *     the real augmentWithSupportingMaterial policy (thin→skill query,
 *     full+question→question query, never-throw), asserting what lands in the
 *     lesson body.
 *
 * No OpenAI calls: text tiers serve without embeddings, so this runs even
 * while the quota blocker stands. Exit code 0 only above the §36 gate.
 *
 * Run:  npm run eval:retrieval
 */
import mongoose from "mongoose";
import { substitutePassword } from "../src/server/env";
import { SubjectModel } from "../src/models";
import { searchCurriculum, type CurriculumHit } from "../src/features/tutor/curriculum/retrieval";
import {
  augmentWithSupportingMaterial,
  SUPPORT_MARKER,
} from "../src/features/tutor/curriculum/grounding";
import type { CurriculumBundle } from "../src/features/tutor/curriculum/service";
import {
  RETRIEVAL_SCENARIOS,
  GROUNDING_SCENARIOS,
  EVAL_GATE,
  EVAL_TOP_K,
  type GroundingScenario,
} from "./scenarios";
import { scoreRetrievalScenario, summarize, textMentions } from "./score";

const THIN_BODY = "Fractions show parts of a whole.";
const FULL_BODY = "A complete lesson body sentence. ".repeat(60); // > THIN_LESSON_CHARS

function bundleFor(scenario: GroundingScenario): CurriculumBundle {
  return {
    subjectName: scenario.subjectName ?? "Mathematics",
    skillId: "",
    skillCode: "eval",
    skillName: scenario.skillName,
    objective: scenario.objective,
    lessonTitle: scenario.lessonTitle,
    lessonBody: scenario.lessonSize === "thin" ? THIN_BODY : FULL_BODY,
    examples: [],
    items: [],
    masteryLines: [],
  };
}

async function resolveSubjectIds(): Promise<Map<string, string>> {
  const subjects = await SubjectModel.find({ active: true }).lean();
  return new Map(subjects.map((s) => [s.name, s._id.toString()]));
}

async function runRetrieval(subjects: Map<string, string>): Promise<boolean> {
  console.log(`\n── Retrieval (${RETRIEVAL_SCENARIOS.length} scenarios, top-${EVAL_TOP_K}) ──`);
  const verdicts = [];
  for (const scenario of RETRIEVAL_SCENARIOS) {
    const subjectId = scenario.subjectName ? (subjects.get(scenario.subjectName) ?? null) : null;
    let hits: CurriculumHit[];
    try {
      hits = await searchCurriculum({ query: scenario.query, subjectId, limit: EVAL_TOP_K });
    } catch {
      hits = []; // retrieval must never throw; a throw here is a failed scenario
    }
    const verdict = scoreRetrievalScenario(scenario, hits);
    verdicts.push(verdict);
    const mark = verdict.passed ? "PASS" : "FAIL";
    const detail =
      verdict.relevantRanks.length > 0
        ? `relevant @ rank ${verdict.relevantRanks.join(",")}`
        : "no relevant hit";
    console.log(`  [${mark}] ${scenario.id.padEnd(30)} "${scenario.query}" → ${detail}`);
    if (!verdict.passed && hits.length > 0) {
      for (const hit of hits) console.log(`         got: "${hit.title}" — ${hit.content.slice(0, 90)}…`);
    }
  }

  const summary = summarize(verdicts);
  console.log(
    `\n  hit@k ${(summary.hitRate * 100).toFixed(0)}% · MRR ${summary.mrr.toFixed(2)} · ` +
      `${summary.passed}/${summary.total} scenarios pass`
  );
  return summary.hitRate >= EVAL_GATE.MIN_HIT_RATE && summary.failed === 0;
}

async function runGrounding(subjects: Map<string, string>): Promise<boolean> {
  console.log(`\n── Grounding (${GROUNDING_SCENARIOS.length} scenarios) ──`);
  let passed = 0;
  for (const scenario of GROUNDING_SCENARIOS) {
    const bundle = bundleFor(scenario);
    const before = bundle.lessonBody;
    try {
      await augmentWithSupportingMaterial(bundle, {
        userMessage: scenario.userMessage,
        subjectId: scenario.subjectName ? (subjects.get(scenario.subjectName) ?? null) : null,
      });
    } catch {
      console.log(`  [FAIL] ${scenario.id.padEnd(32)} augment threw — grounding must never throw`);
      continue;
    }

    const gainedSupport = bundle.lessonBody.includes(SUPPORT_MARKER);
    let ok: boolean;
    let detail: string;

    if (scenario.expectNoSupport) {
      ok = !gainedSupport;
      detail = gainedSupport ? "support added but none expected" : "no support (as expected)";
    } else {
      const support = bundle.lessonBody.split(SUPPORT_MARKER)[1] ?? "";
      const groups = scenario.expectInSupport ?? [];
      ok = gainedSupport && groups.some((group) => textMentions(support, group));
      detail = !gainedSupport
        ? "expected support in body, got none"
        : ok
          ? "support landed with expected content"
          : "support landed but missed expected keywords";
    }
    // The original lesson text must always survive intact.
    if (!bundle.lessonBody.startsWith(before)) {
      ok = false;
      detail = "original lesson body was altered";
    }
    if (ok) passed += 1;
    console.log(`  [${ok ? "PASS" : "FAIL"}] ${scenario.id.padEnd(32)} ${detail}`);
  }

  const rate = passed / GROUNDING_SCENARIOS.length;
  console.log(`\n  ${passed}/${GROUNDING_SCENARIOS.length} grounding scenarios pass`);
  return rate >= EVAL_GATE.GROUNDING_PASS_RATE;
}

async function main(): Promise<void> {
  const mongoUrl = substitutePassword(process.env.MONGO_URL ?? "", process.env.DATABASE_PASSWORD);
  if (!mongoUrl) {
    console.error("MONGO_URL is not set. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 10_000 });

  try {
    const subjects = await resolveSubjectIds();
    const retrievalOk = await runRetrieval(subjects);
    const groundingOk = await runGrounding(subjects);

    const allOk = retrievalOk && groundingOk;
    console.log(
      `\n${allOk ? "✅ EVAL PASS" : "❌ EVAL FAIL"} — gate: hit@k ≥ ` +
        `${EVAL_GATE.MIN_HIT_RATE * 100}%, grounding ${EVAL_GATE.GROUNDING_PASS_RATE * 100}%`
    );
    process.exitCode = allOk ? 0 : 1;
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error("Eval runner crashed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
