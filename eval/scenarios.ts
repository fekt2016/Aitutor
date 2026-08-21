/**
 * Golden retrieval + grounding scenarios (plan §36, Phase 2 deliverable).
 *
 * These encode the eval rubric as DATA so the same expectations drive:
 *  - the live runner (`npm run eval:retrieval`, against real Atlas), and
 *  - hermetic scorer tests (`tests/eval-score.test.ts`).
 *
 * Queries are written child-style on purpose: the corpus must serve the way
 * an 8-year-old actually asks, not the way the seed file phrases things.
 *
 * Keyword groups: a hit counts as RELEVANT when its title+content contains
 * every term of at least one group (case-insensitive). Groups are OR'd.
 */

export interface RetrievalScenario {
  id: string;
  /** §36 dimension this scenario guards. */
  dimension: string;
  query: string;
  /** Subject scope resolved to an id by the live runner (name must exist in DB). */
  subjectName?: string;
  /** OR'd AND-groups of terms that mark a hit relevant. */
  expectAny: string[][];
  /** Minimum relevant hits in top-k for a pass. 0 = negative control. */
  minRelevant: number;
}

export interface GroundingScenario {
  id: string;
  dimension: string;
  /** Thin-lesson bundle fields (grounding queries from these when thin). */
  skillName: string;
  objective: string;
  lessonTitle: string;
  /** Length of the synthetic lesson body: "thin" (<600 chars) or "full". */
  lessonSize: "thin" | "full";
  userMessage?: string;
  subjectName?: string;
  /** At least one group must appear inside SUPPORTING MATERIAL after augment. */
  expectInSupport?: string[][];
  /** When true, the body must NOT gain a SUPPORTING MATERIAL section. */
  expectNoSupport?: boolean;
}

/* ------------------------------------------------------------------ */
/* Retrieval — natural-language queries over the seeded NaCCA corpus   */
/* ------------------------------------------------------------------ */

export const RETRIEVAL_SCENARIOS: RetrievalScenario[] = [
  {
    id: "numerator-definition",
    dimension: "curriculum alignment",
    query: "What is a numerator?",
    expectAny: [["numerator"]],
    minRelevant: 1,
  },
  {
    id: "make-ten-strategy",
    dimension: "curriculum alignment",
    query: "how do I add 9 plus 4?",
    expectAny: [["make ten"], ["make 10"], ["9 + 4"]],
    minRelevant: 1,
  },
  {
    id: "equivalent-fractions-concept",
    dimension: "curriculum alignment",
    query: "tell me about equivalent fractions",
    expectAny: [["equivalent"]],
    minRelevant: 1,
  },
  {
    id: "half-same-amount",
    dimension: "curriculum alignment",
    query: "which fraction is the same as one half?",
    expectAny: [["2/4"], ["same amount"], ["simplest"]],
    minRelevant: 1,
  },
  {
    id: "consonant-blends",
    dimension: "curriculum alignment",
    query: "words that start with bl and st",
    // "bl"/"st" are sub-3-char terms the regex tier drops — the lesson chunk
    // must still surface via "words start … consonant sounds".
    expectAny: [["blend"], ["consonant"], ["blue"], ["star"], ["stop"]],
    minRelevant: 1,
  },
  {
    id: "literal-comprehension",
    dimension: "curriculum alignment",
    query: "what colour is Ama's bicycle?",
    expectAny: [["red"], ["ama"]],
    minRelevant: 1,
  },
  {
    id: "subtraction-hop-back",
    dimension: "curriculum alignment",
    query: "15 take away 9",
    expectAny: [["15 - 9"], ["hop back"]],
    minRelevant: 1,
  },
  {
    id: "simplest-form",
    dimension: "curriculum alignment",
    query: "how do I write 4/8 in simplest form?",
    expectAny: [["simplest"]],
    minRelevant: 1,
  },
  {
    id: "off-corpus-geography",
    dimension: "hallucination control",
    query: "who is the president of Ghana?",
    expectAny: [["president"], ["government"], ["election"]],
    minRelevant: 0,
  },
  {
    id: "gibberish",
    dimension: "hallucination control",
    query: "zzz qqq xxxvvv",
    expectAny: [["zzz"], ["qqq"]],
    minRelevant: 0,
  },
];

/* ------------------------------------------------------------------ */
/* Grounding — augmentation policy over real retrieval results         */
/* ------------------------------------------------------------------ */

export const GROUNDING_SCENARIOS: GroundingScenario[] = [
  {
    id: "thin-fractions-lesson",
    dimension: "grounded support",
    skillName: "Equivalent fractions",
    objective: "Identify and represent equivalent fractions using diagrams.",
    lessonTitle: "Fractions that look different but are the same",
    lessonSize: "thin",
    subjectName: "Mathematics",
    expectInSupport: [["numerator"], ["equivalent"]],
  },
  {
    id: "full-lesson-numerator-question",
    dimension: "question-aware retrieval",
    skillName: "Equivalent fractions",
    objective: "Identify and represent equivalent fractions using diagrams.",
    lessonTitle: "Fractions that look different but are the same",
    lessonSize: "full",
    userMessage: "What is a numerator in a fraction?",
    subjectName: "Mathematics",
    expectInSupport: [["numerator"]],
  },
  {
    id: "full-lesson-tiny-message",
    dimension: "retrieval policy",
    skillName: "Equivalent fractions",
    objective: "Identify and represent equivalent fractions using diagrams.",
    lessonTitle: "Fractions that look different but are the same",
    lessonSize: "full",
    userMessage: "ok",
    expectNoSupport: true,
  },
  {
    id: "off-corpus-question",
    dimension: "hallucination control",
    skillName: "Equivalent fractions",
    objective: "Identify and represent equivalent fractions using diagrams.",
    lessonTitle: "Fractions that look different but are the same",
    lessonSize: "thin",
    userMessage: "who is the president of Ghana?",
    // Thin lessons ALWAYS augment from skill context (never the question), so
    // support IS expected — but it must stay on-curriculum: the off-topic
    // question must not drag unrelated material into the lesson body.
    expectInSupport: [["fraction"], ["equivalent"]],
  },
];

/** Release gate per §36 — regressions block merge. */
export const EVAL_GATE = {
  /** ≥80% of positive retrieval scenarios must find a relevant top-k hit. */
  MIN_HIT_RATE: 0.8,
  /** Every grounding scenario must pass — policy violations are regressions. */
  GROUNDING_PASS_RATE: 1.0,
} as const;

/** Top-k the runner evaluates at (matches grounding's MAX_SUPPORT_CHUNKS). */
export const EVAL_TOP_K = 3;
