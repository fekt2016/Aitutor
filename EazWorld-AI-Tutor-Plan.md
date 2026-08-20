# EazWorld AI Tutor — Architecture & Implementation Plan

**Status:** Draft for approval · **Date:** 2026-08-20
**Scope:** Product definition, architecture, technical decisions, roadmap. No production code yet.

---

## 0. Project status — read this first

This is a **new, independent product** for the EazWorld company: a greenfield build in `/Users/mac/Desktop/aiTutor`. There is no existing codebase or learning platform to extend — the AI Tutor is designed and built from scratch.

Consequence: where a shared EazWorld platform might have offered reusable structures (curriculum, lessons, quizzes, gamification, student accounts), here we **define them** as part of this product. The plan is therefore self-contained; every component it references is new and owned by this project.

---

## 1. Product definition

### 1.1 What it is

EazWorld AI Tutor is a safe, personalized, adaptive AI tutor for children aged **5–11 (primary school)**, available as a responsive web app. It teaches curriculum-aligned subjects (starting with Mathematics) through guided conversation and structured practice — behaving like a teacher, not a chatbot.

### 1.2 What a child can eventually do

- Ask questions and get age-appropriate explanations
- Learn concepts through structured lessons
- Practise skills with adaptive questions (MCQ + free-text + guided steps)
- Get hints and scaffolded support
- Receive step-by-step explanations of mistakes
- Take short quizzes and get instant feedback
- Get personalized challenges targeting weak areas
- Review previously learned topics
- Learn through back-and-forth conversation
- (Later) use voice input/output
- (Later) upload a photo of a maths problem

### 1.3 The long-term objective

> Understand what the child knows → identify what they don't understand → teach the missing concept → practise it with them → measure the result → adapt future learning.

This loop is the product's core and is expressed explicitly in the architecture (§10, §12), not left to prompt luck.

### 1.4 Product principles

1. **Teacher, not chatbot.** The tutor teaches, checks understanding, and decides what's next. It never just "answers".
2. **Safety is a hard requirement, not a prompt.** Multi-layer moderation (§18), enforced in code.
3. **Curriculum-aligned.** Answers and questions are grounded in the EazWorld curriculum knowledge base, not free-floating model knowledge (§6).
4. **Adaptive and measurable.** Every interaction produces a learning signal; mastery is tracked and drives the next step (§12).
5. **Minimal data.** Collect only what improves learning; store the minimum; parents control the rest (§19).
6. **Cost-aware.** Cheap by default, expensive only when a hard problem justifies it (§30).
7. **Provider-agnostic.** No code coupling to a single AI vendor (§8, §9).
8. **Fun, encouraging, child-first.** Reward effort and mastery, never raw message volume (§22, §25).
9. **Simple infrastructure.** One app, one database, no unnecessary services (§33).

---

## 2. Product = independent, under the EazWorld brand

The AI Tutor is a **standalone project** in `/Users/mac/Desktop/aiTutor`. It shares the EazWorld brand but has its own codebase, stack, database, and deployment — there is no coupling to any other EazWorld system.

Project conventions (kept consistent across the codebase):

- Name/branding: "EazWorld AI Tutor", warm, playful, child-friendly tone.
- Response envelope convention: success `{ success: true, data }`; errors via a central error handler.
- Auth convention: JWT in an httpOnly cookie (see §28 — we use a maintained library).
- Validation discipline: Mongoose schemas (with custom validators) on every data model and endpoint; strict mode rejects unknown fields.
- Env-driven config with `.env` kept current (a `.env.example` template is committed).

---

## 3. User roles

Roles are **scoped + hierarchical** (no duplicate role names; one `role` field on the user, augmented by relations):

| Role            | What they can do                                                                                                                                     | Notes                                                          |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Student**     | Use the tutor: learn, practise, quiz, receive hints/feedback, view own progress and rewards                                                          | Must be linked to a Parent; cannot access other students' data |
| **Parent**      | View their children's progress, activity, mastered/struggling skills, weekly summaries; set learning goals; toggle tutor access; review safety flags | Never sees raw conversation content by default (§20)           |
| **Teacher**     | (Later) view aggregate class progress, assign topics, see curriculum- and skill-level insights across the students in their classes                  | Not in MVP                                                     |
| **Admin**       | Manage users, curriculum content, skills, lessons, safety rules, model/prompt config, review safety events                                           | Reuses the general admin pattern from §21                      |
| **Super Admin** | Platform-level: billing/config limits, global safety policy, model keys, feature flags, full audit logs, cost monitoring                             | One role with a `superAdmin: true` flag                        |

Design notes:

- A user has **one** `role`. A person who is both parent and teacher has one record; capabilities are granted by **permissions** derived from role + relations (e.g. `parentOf(studentId)`), not by multiple role fields.
- Enrollment model: parents create child accounts and link them; MVP uses **admin/parent-managed accounts** (no self-registration for children). Later: teacher/class import.
- Permission helpers live in one module (`lib/authorize.ts`) so the "student can never see another student's data" rule is enforced centrally (§28).

---

## 4. Age & educational level — extensible system

**No hard-coded age behavior.** We introduce a `LearnerLevel` concept expressed as a grade band plus adaptive parameters:

- `GradeLevel` record: `KG`, `Basic1..Basic6` (Ghana primary = KG1–KG3, Basic 1–6). Each has:
  - `minAge`, `maxAge`
  - `vocabularyLevel` (1–5) — controls word choice in prompts
  - `explanationDepth` (1–5) — controls conceptual depth
  - `interactionStyle` (e.g. `playful`, `guided`, `independent`)
  - `readingLevel` (Flesch-style target range)
  - `maxAnswerLength`, `questionTypesAllowed`, `hintStrategy`
- The **Tutor Orchestrator** resolves these into prompt parameters at runtime (§10). Adding a new level = adding a row + tuning params, not code changes.

Future extension points already planned: a `LearnerProfile` field on students (e.g. `preferredExamples: sports`, `language: twi/en`) feeding the orchestrator, without per-age code paths.

---

## 5. Subject architecture [NEW — define from scratch]

Flexible hierarchy, DB-driven, curriculum-agnostic at the top and NaCCA-aligned at the leaves:

```
Subject  (Mathematics, English Language, Science, …)
  └─ Strand        (NaCCA strand, e.g. Number, Algebra, Geometry for Maths)
      └─ SubStrand  (e.g. Fractions, Money)
          └─ ContentStandard   (a NaCCA learning objective)
              └─ Skill         (atomic, measurable capability)
                  └─ Lesson    (teachable unit: explanation + examples + practice)
                      └─ PracticeItem   (drill questions, adaptive)
                      └─ AssessmentItem (quiz questions, graded)
```

- **Reuse check:** nothing pre-exists in this product — all new.
- Subjects are registered in the DB with `active` flags; adding "Reading", "General Knowledge", "Computing" etc. is a data change.
- A `Skill` is the atomic unit of mastery (§12). Everything adapts around skills.

---

## 6. Curriculum architecture (critical)

### 6.1 Representation

We mirror the **Ghana NaCCA** curriculum structure so content maps 1:1 to the national syllabus:

```
Curriculum → GradeLevel → Subject → Strand → SubStrand → ContentStandard → Indicator
```

- `ContentStandard` = the learning objective (e.g. "B4.2.1.1 Add and subtract fractions with like denominators").
- `Indicator` = observable mastery behavior.
- `Skill` = our atomic trackable capability, linked to indicators.
- `Lesson`, `PracticeItem`, `AssessmentItem` = the teachable/practisable material.

### 6.2 Storage strategy — hybrid, DB-first

| Content type                          | Storage                                                                                      | Rationale                                                       |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Taxonomy (curriculum → indicator)     | MongoDB collections (Mongoose schemas)                                                       | Queried constantly, must be consistent and admin-editable       |
| Lesson bodies, explanations, examples | MongoDB documents with structured fields + optional **Markdown text** fields                 | Markdown is author-friendly, diffable, renders in the UI, cheap |
| Short questions/answers               | MongoDB documents (typed fields: `prompt`, `options`, `answer`, `explanation`, `difficulty`) | Need to be validated, randomized, graded                        |
| Long-form reference content           | Markdown + **embeddings in MongoDB Atlas Vector Search**                                     | Enables retrieval (§14)                                         |
| CMS                                   | None in MVP                                                                                  | Admin UI edits documents directly; a CMS is a later option      |

### 6.3 How the AI gets curriculum content

1. The orchestrator resolves the current skill/lesson from the session context.
2. It **retrieves the authoritative lesson row + examples + recent items** (structured DB read via tools, §15).
3. It may **semantically search** the curriculum corpus (MongoDB Atlas Vector Search) for supporting material (definitions, alternative explanations) when the current lesson is thin.
4. The retrieved content is placed into the prompt's **curriculum context block** (§35) with an instruction: _"Teach using the material below; if it is insufficient, say so instead of inventing."_
5. A **grounding check** validates the model output against the provided curriculum (§16) to reduce hallucination.

The AI is a **reasoner over a knowledge base**, not the source of truth. This is what keeps answers curriculum-aligned, consistent, and auditable.

---

## 7. AI architecture (server-side orchestration)

```
Browser (child)
   │  HTTPS / streaming fetch
   ▼
Next.js API Route  (authN, authZ, validation, rate limit)        ── §26, §28
   ▼
Tutor Orchestrator  (state machine: intent → action → respond)   ── §10
   ├─ Student Context resolver      (profile, grade, mastery, streaks)  ── §11
   ├─ Learning Context resolver     (current lesson/skill/objective)    ── §6
   ├─ Curriculum Retriever          (DB read + Atlas Vector Search RAG)   ── §6, §14
   ├─ Memory Builder                (short/session/long-term context)   ── §13
   ├─ Prompt Composer               (versioned template assembly)       ── §35
   ├─ Safety Gate (in)              (moderation on user input)          ── §18
   ├─ AI Provider (abstraction)     (model routing, streaming)          ── §8, §9
   ├─ Response Validator            (schema + safety + grounding)       ── §16, §18
   ├─ Learning Signal Extractor     (→ persisted signals)               ── §12
   └─ Persistence + async jobs      (messages, summaries, mastery update)─ §13, §17
```

**Why a server-side layer and not Frontend → AI API:** every request needs auth, safety, curriculum grounding, and learning-signal capture; keys must never reach the browser; streaming and cost controls live on the server; and provider swaps must not touch the client.

---

## 8. AI provider strategy

### 8.1 Provider comparison (for a 5–11 tutoring workload)

| Criterion                       | OpenAI                   | Anthropic        | Google Gemini |
| ------------------------------- | ------------------------ | ---------------- | ------------- |
| Educational reasoning quality   | Strong                   | Strong           | Strong        |
| Cost (small models)             | Very low (4o-mini class) | Low-moderate     | Very low      |
| Latency (small models)          | Low                      | Low              | Low           |
| Reliability/availability        | High                     | High             | High          |
| Structured output (JSON schema) | **Excellent**            | Good             | Good          |
| Tool calling                    | Excellent                | Excellent        | Good          |
| Built-in safety/moderation API  | **Yes (Moderation API)** | Guidelines-based | Yes           |
| Streaming                       | Yes                      | Yes              | Yes           |
| Multimodal (vision)             | Yes                      | Yes              | Yes           |
| Voice (STT/TTS ecosystem)       | Good (Realtime/TTS)      | No               | Yes           |

### 8.2 Recommendation

- **Initial provider: OpenAI** — best-in-class structured output, an explicit moderation API (valuable for child safety), mature streaming, low-cost small models, and strong vision/voice for the roadmap.
- **Architecture rule: provider abstraction (§8.3).** All provider interactions go through a single `AiProvider` interface. Model names, prompts, and JSON schemas are config, so Anthropic/Gemini can be added as adapters later without touching the orchestrator.

### 8.3 Provider abstraction

```ts
interface AiProvider {
  complete(req: CompletionRequest): Promise<CompletionResponse>; // non-streaming
  stream(req: CompletionRequest): AsyncIterable<Chunk>; // streaming
  moderate(text: string): Promise<ModerationResult>; // optional
}
interface CompletionRequest {
  system: string;
  messages: Message[];
  schema?: JsonSchema; // structured output
  model?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Tool[];
}
```

Registry keyed by env (`AI_PROVIDER=openai`); a factory returns the active provider. Fallback chain supported (e.g. primary provider down → secondary).

---

## 9. Model strategy — one size does not fit all

| Task                                         | Model class                                                                                           | Why                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Main tutor conversation                      | **small capable model** (e.g. GPT-4o-mini class)                                                      | 80% of traffic; fast, cheap, good enough for primary content |
| Hard problems / complex reasoning            | **strong model** (e.g. GPT-4o / o-series), triggered only when difficulty ≥ threshold or retries fail | Cost stays low because escalation is rare                    |
| Learning-signal extraction                   | **small structured model**                                                                            | Pure JSON extraction, cheap                                  |
| Conversation summarization                   | **small model**, async                                                                                | Summaries are not latency-critical                           |
| Question/lesson generation (content tooling) | **strong model**, admin-triggered                                                                     | Offline authoring, quality matters                           |
| Moderation                                   | **dedicated moderation system** (OpenAI Moderation API + local rules)                                 | Never the tutor model                                        |
| Embeddings                                   | **small embedding model** (e.g. text-embedding-3-small)                                               | Cheap, sufficient                                            |

Routing is **declarative** (a model map in config), so prices/names change without code. The provider abstraction returns the current model for each task.

---

## 10. Tutor Orchestrator

### 10.1 Explicit control, not just prompting

A small **state machine** decides the tutor's move. The model fills in _language_; the orchestrator decides _behavior_.

States / intents (input → classified intent):

1. **GREET / SMALLTALK** → warm response, steer to current goal
2. **EXPLAIN** (concept request) → curriculum-grounded explanation at the right depth
3. **PRACTICE** (answer attempt) → grade it, explain, extract signal
4. **HINT** (stuck) → scaffolded hint (progressive: nudge → example → step breakdown)
5. **ASK** (check understanding) → pose a question at adaptive difficulty
6. **CORRECT** (wrong answer) → gentle correction + explanation + one retry
7. **LEVEL_ADJUST** → difficulty up/down based on streak/errors
8. **RECOMMEND** → next skill or practice set (§12)
9. **OFF_TOPIC / UNSAFE** → safety response, log, notify (§18)
10. **SESSION_END** → wrap-up, encouragement, summary

### 10.2 Inputs to every decision

Student profile, grade/level params (§4), subject/strand/substrand, current content standard, current skill, recent performance (last N answers), current mastery (§12), streak, recent mistakes, session goal, curriculum context.

### 10.3 Output

Structured action envelope (see §16): the chosen interaction type, the response text, next difficulty, whether to ask/practice/hint, and learning signals to record.

This is implemented as a **TypeScript orchestrator class** with unit-testable decision functions — not a giant prompt.

---

## 11. Student learning profile

Stored as `StudentProfile` + derived stats. **Permanent** (long-lived, minimal):

- Grade level, age band (derived from grade), language/preferences, enrollment links
- **SkillMastery** records (§12) — the core permanent learning record
- Practice/quiz history (aggregate + recent detail)
- Learning streak, badges, XP totals (gamification, §22)
- Recommended-next-topic state

**Temporary / session-scoped** (not persisted or purged at end of session):

- Raw token usage, transient context, streaming buffers, per-turn reasoning artifacts

**Explicitly NOT collected:** exact birthdate (store age band), home address, photos, voice recordings beyond immediate processing (transcripts only, then delete audio), browsing data, or any info not needed to teach.

Parents can view and parents/admins can delete all child data (§19).

---

## 12. Adaptive learning engine & mastery

### 12.1 Mastery model — recommendation

A **transparent, weighted mastery score** per skill (0–100) with an evidence gate. Rationale: fully Bayesian Knowledge Tracing (BKT) adds complexity and opaqueness for MVP; a scored model is explainable to parents/admins and cheap to run. BKT can replace it later behind the same interface.

Rules:

- Each graded attempt updates the skill score via a decaying weighted average (recent attempts weigh more) plus difficulty weighting.
- **Evidence gate:** a skill is only "Mastered" (≥80) if it also has ≥3 recent correct answers at appropriate difficulty and has been _re-tested_ once (spaced repetition). Prevents one lucky streak from faking mastery.
- Bands (configurable, not hard-coded into logic):
  - 0–30 **Needs support**
  - 31–60 **Developing**
  - 61–80 **Progressing**
  - 81–100 **Mastered**
- **Prerequisite graph:** skills carry `requiresSkillId`. The engine only recommends skills whose prerequisites are mastered — this is how "teach the missing concept" works: a fractions failure drills down to prerequisite (equivalent fractions → common denominators).

### 12.2 The adaptation loop (example)

Fractions, Basic 4: Q1 correct → Q2 wrong → Q3 wrong → Q4 needed a hint.

1. Orchestrator flags skill signal `{skill: fractions, evidence: [wrong, wrong, hint]}`.
2. Engine detects prerequisite gap → sets goal to `equivalent fractions`, lowers difficulty.
3. Tutor **explains** equivalent fractions (curriculum lesson) → **examples** → **asks a question**.
4. Evaluate answer → signal recorded → score recomputed.
5. If now progressing → next skill; else another scaffolded practice round.
6. Session end → summary + next-session plan persisted.

### 12.3 Spaced review

Mastered skills enter a **review queue** with growing intervals (1d → 3d → 7d → 14d). A "Daily Review" session serves due items — this is the retention loop.

---

## 13. AI memory — four layers

| Layer                  | Contains                                                           | Lifetime     | Size / policy                                                                                       |
| ---------------------- | ------------------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------- |
| **Short-term**         | Current turn + last few exchanges                                  | One response | Last ~6 messages raw, truncated to token budget                                                     |
| **Session**            | What happened this session: goal, skills touched, answers, signals | The session  | Represented as a compact **running session state** (JSON) + periodic summaries, not full transcript |
| **Long-term learning** | SkillMastery, streak, weak areas, preferences, recent topics       | Months/years | Summary lines assembled by the Memory Builder; never raw transcripts                                |
| **Curriculum**         | Lessons, examples, definitions, objectives                         | Permanent    | Retrieved fresh per turn (§6, §14); not stored in model context                                     |

**Context budget policy (important):** never send unbounded history. The Memory Builder composes a fixed-budget context block — short-term messages (capped), session summary (~1 short paragraph), long-term highlights (≤3 bullet lines), curriculum chunk (≤ ~1200 tokens). If the budget is exceeded, older turns are dropped and the running summary is updated (async summarization job). This keeps cost and latency flat regardless of conversation length.

---

## 14. RAG / knowledge retrieval

**Need:** yes — but light for MVP.

- Curriculum items are already retrievable by structured queries (session context tells us the skill). RAG is needed only for: (a) finding _alternative explanations_ when the current lesson is thin, (b) future broad Q&A over the whole corpus.
- **Recommendation: MongoDB Atlas Vector Search** on the same managed MongoDB. No separate vector DB. MVP runs on **metadata + Atlas full-text search (`$search`/Atlas Search) first**, and adds vector embeddings for lessons/definitions as content grows.
- Hybrid strategy (later): Atlas Search (exact terms) + **Atlas Vector Search** (semantic) + optional keyword boost, merged with rank scoring. Model: `CurriculumChunk` (`sourceType`, `sourceId`, `content`, `embedding` (1536-dim float vector), `gradeBand`, `subject`, `skillId`).
- **Why no dedicated vector DB:** one database keeps ops/cost minimal; the corpus is small for years (thousands of lessons), far below the point where a separate store pays off.

---

## 15. AI tools

The tutor model uses **server-side tools** — it never touches the database directly. Tool list for MVP:

| Tool                       | Purpose                                               | Notes                          |
| -------------------------- | ----------------------------------------------------- | ------------------------------ |
| `get_student_profile`      | Age band, grade, language, preferences                | Read-only                      |
| `get_learning_progress`    | Mastery summary for current subject                   | Read-only                      |
| `get_current_lesson`       | Current skill/lesson content standard + lesson row    | Read-only                      |
| `search_curriculum`        | Retrieve lessons/definitions (hybrid search)          | Read-only                      |
| `get_skill`                | Skill details + prerequisites + mastery               | Read-only                      |
| `create_practice_question` | Generate an adaptive practice item (difficulty param) | Server validates & grades      |
| `evaluate_answer`          | Grade a free-text answer (or uses orchestrator path)  | Structured result              |
| `record_learning_signal`   | Persist a signal from the turn                        | Write, whitelisted fields only |
| `recommend_next_skill`     | Prerequisite-aware next skill                         | Read-only                      |

Rule: tools are **capability-limited** (read-only except explicit signal/write tools), **audited**, and their inputs/outputs validated by Mongoose/JSON schemas. Everything the model could misuse is resolved server-side by the orchestrator.

---

## 16. Structured AI output

Where structure is needed, use **JSON-schema-constrained output** (provider-native, not "ask for JSON").

**Structured (enforced by schema):**

- Tutor action envelope:

```json
{
  "response": "...", // final text shown to child
  "interaction_type": "explain|ask|hint|practice|correct|recommend|smalltalk|session_end",
  "skill": "fractions-equivalent",
  "difficulty": 3,
  "hint_available": true,
  "learning_signal": { "type": "answer_correct|answer_wrong|hint_used|concept_seen", "value": 1 },
  "requires_action": "question|none" // drives UI widgets (MCQ vs free text)
}
```

- `evaluate_answer` result: `{ correct: boolean, partial: boolean, explanation, skill, difficulty_estimate }`
- Learning-signal extraction: `{ signals: [...] }`
- Moderation verdict: `{ flagged: boolean, categories: [...] }`

**Free text is fine for:** greeting/warm-up chatter, non-assessed conversational turns, session wrap-up encouragement.

Validation: every structured response passes its JSON schema (and any Mongoose model validation on persistence) before saving; malformed output triggers a retry (once) then a friendly fallback (§37).

---

## 17. Conversation architecture

Models (new): `TutorSession`, `TutorMessage`, `LearningSignal`.

- `TutorSession`: `studentId, parentId?, subjectId, strandId?, substrandId?, skillId?, goal, status (active|ended|abandoned), startedAt, endedAt, summary, difficultyLevel, stats {messages, correct, wrong, hintsUsed}, aiCostTokens, completionReason`
- `TutorMessage`: `sessionId, role (user|assistant|system|tool), contentType (text|mcq|structured), content (text or JSON), safety {moderated, verdict}, model, tokensIn/Out, createdAt`
- `LearningSignal`: `sessionId, studentId, skillId, type, value, confidence, difficulty, createdAt`

**Storage rules:** store messages (needed for parent safety audit + session summary) but **not** raw reasoning, and avoid storing children's free-text beyond session life unless flagged. Conversation is purged per retention policy (§19); the **summary and signals persist**, the transcript does not.

---

## 18. Safety architecture (first-class)

Multiple enforced layers — **never only a system prompt.**

1. **Input validation:** Mongoose schemas (types, max lengths, allow-listed content types; strict mode rejects unknown fields).
2. **Input moderation:** OpenAI Moderation API + local keyword/pattern classifier (deterministic, offline, fast) on every user message. Flagged → friendly deflection + SafetyEvent.
3. **Prompt/system restrictions:** system instructions set the teacher persona + hard content boundaries (§35).
4. **Curriculum restrictions:** topic gating — tutor can only discuss the active skill/lesson unless explicitly exploring a curriculum search hit; off-syllabus drift is blocked by the orchestrator.
5. **Output moderation:** moderation call + deterministic checks on every assistant response before streaming to the child; blocked output → fallback message.
6. **Response validation:** JSON schema (provider-native structured output) + Mongoose validation on persist + grounding check (response must cite/summarize provided curriculum or state uncertainty — mitigates hallucination).
7. **Abuse/rate limiting:** per-student, per-session, per-IP; message caps per session/day; exponential backoff (§28).
8. **Monitoring:** SafetyEvents surfaced to admin dashboard + alerts (§29); anomaly detection for "trying to bypass safety".
9. **Parent/admin controls:** parent toggle to pause tutor; admin policy settings; safety-review queue.

**Scenario coverage** (documented test suite, §36): sexual content, violence, dangerous activities, self-harm, bullying, abuse, requests for personal info, safety-bypass attempts ("pretend you are…", jailbreaks), inappropriate roleplay, manipulation, secrecy-from-parents, non-educational chat. Each has a scripted detection + response + notification path.

**Key rule:** if the model can't be trusted for a turn, the **safe fallback** wins over the clever answer.

---

## 19. Privacy

- **What's collected:** minimal identity (name, grade/age band), learning data (mastery, signals, summaries, gamification), messages for the current session.
- **What's sent to AI providers:** only the composed context (prompt content). **No PII beyond the child's first name** (or none by default) is sent; no account data, no other children's data. Redaction layer strips anything unexpected.
- **Storage/retention:** transcripts retained only long enough for summarization + safety audit, then purged (configurable, default 30 days); summaries + mastery permanent (parent can delete). Parental deletion = full cascade delete + purge from any caches.
- **Parent controls:** consent required at account creation; progress visibility; delete-data request; export (JSON/CSV).
- **Audit logs:** admin/parent data-access events logged (who accessed which child data when).
- **Access control:** row-level security enforced in the data layer (student isolation is a hard invariant, §28).
- **Legal review needed before launch:** COPPA (US), GDPR-K/UK (if EU/UK users), and Ghana's **Data Protection Act 2012 (Act 843)** for local rollout. **No legal claims made here — obtain qualified advice before public launch.**

---

## 20. Parent dashboard

MVP (read-only, no raw chats):

- Per-child overview: subjects, skills mastered/developing/struggling
- Recent activity + learning time (per day/session)
- Weekly summary email (auto-generated by the summarization pipeline)
- Recommendations (what the tutor will work on next)
- Goals (parent sets a weekly goal, e.g. "3 sessions or master 2 skills")
- Controls: pause tutor, adjust daily session limit, delete data
- Safety flags (count + category, not content by default)

Never exposes raw conversation text by default; parents can request a **safety-reviewed transcript** through admin for flagged events only.

---

## 21. Teacher / Admin dashboard

- **Admin (MVP+):** user/enrollment management, curriculum content management (taxonomy CRUD), skill graph editing, model/prompt version management (§35), safety event review + policy config, usage + **AI cost monitoring**, feature flags, moderation thresholds.
- **Teacher (later, post-MVP):** class assignment, aggregate skill-mastery heatmap across a class, recommended interventions, curriculum coverage reports.
- Reuses the generic admin pattern: `/admin/*` routes behind `restrictTo('admin','superadmin')`.

---

## 22. Gamification

**No rewards for message volume.** Defined from scratch:

- **XP + levels** awarded for _mastery events_, completed practice sets, correct-on-first-try, consistent daily streaks — capped per session/day to prevent grinding.
- **Badges/achievements** tied to outcomes: "Fractions Master", "7-day streak", "Problem Solver" (3 hard problems solved).
- **Streaks** for daily learning sessions (encourages consistency, not volume).
- **Challenges** = the adaptive practice sets + spaced-review sessions (§12.3); completing a challenge = learning outcome achieved.
- Gamification reads the same `LearningSignal`/`SkillMastery` streams — rewards are **derived**, never counted on raw messages.

---

## 23. Voice (roadmap, not MVP)

Planned path: Child speaks → **STT** → tutor → **TTS** → child hears.

- STT: **Deepgram** (fast, accurate, child-tolerant) or OpenAI Whisper/`/audio/transcriptions`.
- TTS: **ElevenLabs** (expressive, warm) or OpenAI TTS — a friendly character voice.
- Architecture is ready: the message pipeline accepts `contentType: voice`; audio is processed server-side, **transcripts only are stored, audio deleted after processing**.
- MVP is text-only; voice is Phase 7. No UI/UX redesign needed — the same conversation surface plays audio.

---

## 24. Image / multimodal learning (roadmap)

- **Phase 8:** child uploads a photo of a maths problem → vision-capable model (provider abstraction already supports `imageUrl` parts) → tutor "reads" it and guides without solving outright.
- Educational diagrams: generated via SVG/HTML in the frontend (no model-image cost) or model-generated images only for admin-curated content.
- Architecture readiness: `TutorMessage.content` supports typed parts (`text`, `image`, `mcq`, `structured`); provider requests accept multimodal parts. No re-architecture needed later.

---

## 25. Frontend UX

**Not a generic chat app.** Design pillars:

- **Mascot tutor avatar** ("Professor Eazi" placeholder character) with subtle animations — the face of the tutor.
- **Guided learning surface:** a lesson card flow (goal → concept → example → practice → quiz → done) with a conversational panel beside it, not a bare chat window.
- **Structured answer widgets:** MCQs with big tappable buttons, free-text fields, step-by-step problem inputs; hints appear as progressive reveals.
- **Encouragement + feedback:** praise on effort, gentle correction, confetti/motion on mastery moments (Framer Motion).
- **Session goals + completion state:** a child sees "Today: Fractions practice — goal: 5 correct" and a celebration at the end.
- **Subject/topic selection** as playful cards; progress shown as stars/levels.
- **Design system:** styled-components + a token-based design system (colors, type scale, radii, motion) in `styles/tokens.ts` (injected as CSS variables) — warm, rounded, high-contrast, WCAG AA; large touch targets; dyslexia-friendly font option. All variables, no hard-coded values.

Responsive: mobile-first (tablets/phones are the primary classroom/home device), desktop-friendly.

---

## 26. API architecture

Next.js App Router **Route Handlers** under `/api/v1/...`, following the project's envelope convention.

| Endpoint                                    | Purpose                            | Auth                            | Request                        | Response         |
| ------------------------------------------- | ---------------------------------- | ------------------------------- | ------------------------------ | ---------------- |
| `POST /api/v1/auth/register`                | Parent/child account creation      | public (rate-limited)           | account type, consent          | user+token       |
| `POST /api/v1/auth/login`                   | Login (cookie JWT)                 | public                          | email/password                 | `{success:true}` |
| `GET /api/v1/auth/me`                       | Current user                       | protect                         | —                              | user+profile     |
| `POST /api/v1/tutor/sessions`               | Create a session                   | protect (student or parent-as)  | `{subjectId, skillId?, goal?}` | session          |
| `GET /api/v1/tutor/sessions/:id`            | Session + recent messages          | owner (student) or parent/admin | —                              | session+summary  |
| `POST /api/v1/tutor/sessions/:id/messages`  | Send a turn (**streams** response) | owner                           | `{content, contentType}`       | SSE/stream       |
| `POST /api/v1/tutor/sessions/:id/end`       | End session + wrap-up              | owner                           | —                              | summary+signals  |
| `GET /api/v1/tutor/progress`                | Student mastery overview           | owner or parent                 | `?subjectId`                   | skills+mastery   |
| `GET /api/v1/tutor/recommendations`         | Next skills/review queue           | owner or parent                 | —                              | recommendations  |
| `POST /api/v1/parent/children`              | Parent links a child               | parent                          | `{childEmail/code}`            | link             |
| `GET /api/v1/parent/children/:id/report`    | Weekly report                      | parent-of                       | —                              | report           |
| `GET /api/v1/admin/safety/events`           | Safety review                      | admin                           | paginated                      | events           |
| `GET /api/v1/admin/usage/ai`                | AI cost/token monitoring           | admin                           | —                              | usage            |
| `GET/POST/PUT /api/v1/admin/curriculum/...` | Curriculum CRUD                    | admin                           | typed                          | row              |

For every endpoint we define in code: Mongoose-based request validation (strict mode rejects unknown fields), auth/authorization, rate limits (§28), pagination (lists), typed errors through the central error handler, and no sensitive data in logs.

---

## 27. Database design (MongoDB + Mongoose)

Collections (Mongoose schemas shown; relationships + indexes noted):

```
User (email UNIQUE, role: [superadmin, admin, teacher, parent, student], name,
      ageBand?, passwordHash, superAdmin?, active, createdAt)
  ├── ParentChild (parentId→User, childId→User)  UNIQUE(childId)  -- a child has 1 parent link (MVP)
  ├── StudentProfile (studentId→User, gradeLevelId, language?, preferences, dailySessionLimit)
  └── TeacherClass (later): Teacher ↔ Class ↔ Students

GradeLevel (code UNIQUE [KG1..Basic6], name, minAge, maxAge, vocabLevel,
            explanationDepth, readingLevel, interactionStyle)

Subject (code UNIQUE, name, active, sortOrder)
Strand (subjectId, name, sortOrder)
SubStrand (strandId, name, sortOrder)
ContentStandard (substrandId, gradeLevelId, code UNIQUE [e.g. B4.2.1.1], objective, exemplars)
Skill (code UNIQUE, name, contentStandardId, requiresSkillId?, description,
       defaultDifficulty, active)  -- INDEX on requiresSkillId
Lesson (skillId, title, markdownBody, examples, sortOrder)
PracticeItem (skillId, type [mcq|free|step], prompt, options?, answer,
              explanation, difficulty 1-5, active)  -- INDEX on (skillId, difficulty)
AssessmentItem (skillId, type, prompt, options?, answer, explanation, difficulty)

TutorSession (studentId, subjectId, strandId?, substrandId?, skillId?,
              goal, status, difficulty, startedAt, endedAt, summary,
              aiCostTokens, stats)  -- INDEX on (studentId, startedAt DESC)
TutorMessage (sessionId, role, contentType, content, safety, model?,
              tokensIn, tokensOut, createdAt)  -- INDEX on sessionId
LearningSignal (sessionId, studentId, skillId, type, value, confidence,
                difficulty, createdAt)  -- INDEX on (studentId, skillId, createdAt)
SkillMastery (studentId, skillId, score, band, evidenceCount, lastTestedAt,
              reviewDueAt, updatedAt)  -- UNIQUE INDEX on (studentId, skillId)

CurriculumChunk (sourceType, sourceId, gradeBand, subjectId?, skillId?,
                 content, contentTextIndex (Atlas Search), embedding [1536]?)
PromptVersion (name, role [system|tutor|safety], version, body, isActive, changedBy)
SafetyEvent (studentId?, sessionId?, kind, categories, verdict, detail, createdAt)
AuditLog (actorId, action, resourceType, resourceId, at)
UsageLog (date, task, model, tokensIn, tokensOut, costUsd, studentId?)  -- daily rollup

Gamification: XpEvent, Badge, StudentBadge, Streak (derived from sessions/signals)
```

Unique indexes: `User.email`, `Skill.code`, `GradeLevel.code`, `ContentStandard.code`, `SkillMastery(studentId,skillId)`. Compound indexes on every `studentId+skillId+createdAt` path used by queries, `updatedAt` on `SkillMastery` for review scheduling. Parent-child and message→session relationships enforce referential integrity in application code (no cascading deletes leak data across students).

Embeddings live in the **same collection** as curriculum content (Atlas Vector Search index on `CurriculumChunk.embedding`) — no separate vector store, no schema/index scripts written yet (§14).

---

## 28. Security

- **AuthN:** JWT in httpOnly+secure+samesite cookie (library: `jose`), short-lived access + rotating refresh; login rate-limited.
- **AuthZ:** central `requireRole(...)`, `requireOwner(session, student)` and `requireParentOf(student)` helpers in `lib/authorize.ts`. **Every data query scopes by `studentId` from the token/session** — a student can never pass another student's id and get data back (verified in tests).
- **Student isolation:** server-side enforcement (never trust client ids); parent scoped to linked children only; admin scoped to audit-safe views.
- **API security:** helmet/CSP, xss-clean, rate limits (Upstash Redis) per endpoint+role, input max lengths, output encoding in UI.
- **AI keys:** server-only env vars; never in client bundles; provider keys rotated via a secrets manager in production; per-task model keys optionally isolated.
- **Abuse prevention:** per-student daily message cap, per-session cap, exponential backoff on repeated moderation flags, anomaly alerting on mass creation of accounts/sessions.
- **Validation:** Mongoose schemas everywhere (inbound data + outbound AI structures, validated on persist), reject unknown fields via strict mode.

---

## 29. Observability

- **Errors:** Sentry (frontend + server), central error handler with typed codes.
- **AI/usage telemetry:** every provider call logs `task, model, latency, tokens, costUsd, status` → `UsageLog` + daily rollup for the admin cost dashboard (§21). Streaming latency P50/P95.
- **Safety telemetry:** SafetyEvents with category counts; alerts on threshold breaches.
- **Learning telemetry:** session completion rate, mastery movement, recommendation accuracy (follow-up performance).
- **Logs:** structured JSON, correlation IDs per session; **no message content or PII in logs**; only ids + counts.
- **Dashboards:** Vercel Observability / Grafana as needed; PostHog for product analytics (anonymous, opt-in-aware).

---

## 30. Cost model

**Major drivers (projected):** tutor tokens (dominant), strong-model escalation, embeddings (negligible at this corpus size), vector storage (small), voice (later, usage-priced), hosting + MongoDB Atlas (low fixed), moderation calls (low).

**Controls (built-in, not afterthoughts):**

- Small-model default, escalation only on trigger (§9)
- Context budget caps per turn (§13) — limits tokens per message
- Per-session message cap + per-day session cap (§28)
- Response length caps for the child-facing text
- Async summarization on a cheap model; summaries cached and reused
- Curriculum chunk caching (lesson body cache); duplicate-moderation short-circuit
- Usage rollups → monthly AI cost budget alert per environment
- `UsageLog` cost attribution per task to catch regressions

Estimated MVP order of magnitude: with a 4o-mini-class model and ~150-token replies, a 20-message session ≈ **$0.001–0.005**. Monthly cost is dominated by active-student volume; caps make it predictable.

---

## 31. Development phases

| Phase                                 | Focus                     | Features                                                                    | DB                                                                                        | Backend                                                                                  | Frontend                                                 | AI                           | Test                                              | Deps                          | Done when                                                       |
| ------------------------------------- | ------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------- | ------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| **0 — Foundation**                    | Stack + auth + data       | Roles, enrollment, JWT, audit skeleton                                      | Core collections (User, GradeLevel, Subject, skeleton session/message)                    | Auth routes, middleware, error handler, CI (lint+type+test)                              | App shell, login/register, design tokens                 | Provider abstraction stub    | Unit: auth, authz                                 | MongoDB Atlas, Vercel, Sentry | Login as parent/student works end-to-end                        |
| **1 — Tutor MVP**                     | Walkable teaching loop    | Session create → message → streamed tutor reply → end                       | Session, Message, LearningSignal, SkillMastery                                            | Orchestrator v1, streaming endpoint, provider (OpenAI), safety gate in+out, message caps | Tutor UI (mascot, MCQ/free widgets, hints), session flow | GPT-4o-mini, moderation API  | Integration with mocked provider, safety suite v1 | OpenAI key                    | Child completes a short Maths session and mastery score updates |
| **2 — Curriculum integration**        | NaCCA structure + content | Taxonomy CRUD (admin), lessons, practice/assessment items, hybrid retrieval | Strand/SubStrand/ContentStandard/Skill/Lesson/Item, CurriculumChunk + Atlas Vector Search | Curriculum service + tools (`search_curriculum`, `get_current_lesson`), admin API        | Admin curriculum editor, grounded lesson view            | Grounding + RAG wiring       | Retrieval eval, grounding eval                    | Atlas Search/Vector Search    | Tutor answers grounded in seeded Basic-level Maths content      |
| **3 — Adaptive engine**               | Mastery + adaptation      | Prerequisite graph, mastery scoring, difficulty adjustment, review queue    | SkillMastery scoring logic, review scheduling                                             | Engine service, adaptation in orchestrator, `recommendations` API                        | "Next up" cards, daily review                            | Structured signal extraction | Mastery math unit tests, scenario evals (§36)     | —                             | Adaptation loop proven with the fractions scenario (§12.2)      |
| **4 — Progress + parent dashboard**   | Visibility                | Weekly reports, goals, pause/limits, export/delete                          | Report materialization, retention purge job                                               | Report API, parent controls                                                              | Parent dashboard, weekly email                           | Summarization pipeline       | Report correctness tests                          | Resend (email)                | Parent sees progress + can control access                       |
| **5 — Gamification**                  | Motivation                | XP/levels/badges/streaks/challenges on mastery events                       | XpEvent/Badge/Streak                                                                      | Reward service (derived from signals)                                                    | Badge/streak UI, celebrations                            | —                            | Anti-grind tests                                  | —                             | Rewards provably tied to outcomes                               |
| **6 — Safety & monitoring hardening** | Production-ready safety   | Anomaly alerts, transcript review flow, policy mgmt, cost dashboard         | Safety/usage rollups                                                                      | Alerts, review queue, admin panels                                                       | Admin safety UI                                          | Moderation thresholds tuning | Full adversarial suite (§36)                      | —                             | Passes adversarial + load review                                |
| **7 — Voice**                         | Voice UX                  | STT→TTS loop, audio handling (transcript-only)                              | Audio refs                                                                                | Voice endpoints, provider adapters                                                       | Mic + playback UI                                        | STT/TTS providers            | Voice E2E                                         | Deepgram/ElevenLabs           | Child speaks and hears the tutor                                |
| **8 — Multimodal**                    | Images                    | Photo-of-problem upload, diagram support                                    | Image message parts                                                                       | Vision provider path                                                                     | Upload + diagram widgets                                 | Vision model                 | Multimodal eval                                   | —                             | Child uploads a problem and gets guided help                    |

Dependency rule: each phase's completion criteria include passing its eval/tests and a live end-to-end demo.

---

## 32. MVP definition (v1)

**Must have**

- Parent account + child account + link; login; child isolation
- Create/end a tutor session; send messages; **streamed** tutor replies
- Maths (Basic-level) + English Language (reading/grammar at Basic 1–2) as the seeded subjects, each with a small real curriculum slice (≥2 skills, e.g. number sense + fractions; phonics + basic reading comprehension)
- MCQ + free-text answer widgets, hints, encouragement
- Basic mastery scoring + session learning signals
- Safety: input+output moderation, rate/message caps, friendly fallbacks, SafetyEvent logging
- Minimal admin (users, curriculum rows, safety review, AI cost view)

**Should have**

- Session summary + next-step recommendation
- Difficulty adaptation (level up/down)
- Parent progress view (read-only)
- Basic gamification (XP + a couple of badges)

**Later**

- Full NaCCA content authoring, spaced review, teacher dashboards, voice, multimodal, subscriptions/payments, BKT model

**Not needed initially**

- Payments/billing, teacher features, native apps, real-time multi-user, offline mode, external CMS

---

## 33. Technology recommendation (greenfield)

| Layer               | Choice                                                                                        | Why                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Language            | **TypeScript** everywhere                                                                     | Type safety across AI structures, schema, and UI                                                                                         |
| Frontend            | **Next.js (App Router)** + React, **styled-components** + token design system (CSS variables) | Best Vercel fit, streaming-friendly, single deployable app                                                                               |
| UI components       | shadcn/ui-style (Radix primitives) + Framer Motion                                            | Accessible, composable, lightweight                                                                                                      |
| Data fetching       | **TanStack Query** + streaming fetch for tutor turns                                          | Caching, optimistic UI                                                                                                                   |
| Backend             | **Next.js Route Handlers** + a service layer; **Mongoose** model validation                   | One app to deploy; orchestrator lives server-side; no separate Express API needed                                                        |
| DB                  | **MongoDB Atlas** + **Mongoose**                                                              | Document model fits curriculum content (nested strands, flexible fields); Atlas Search + Vector Search in one place; serverless-friendly |
| Embeddings          | `text-embedding-3-small` → **Atlas Vector Search**                                            | Cheap, sufficient                                                                                                                        |
| Auth                | **Auth.js (NextAuth v5)** credentials + JWT/httpOnly cookie, role+permission helpers          | Maintained, works with Next, cookie-based sessions                                                                                       |
| Rate limiting/cache | **Upstash Redis** (Ratelimit + cache)                                                         | Serverless-native, trivial on Vercel                                                                                                     |
| Background jobs     | **Inngest** (or Vercel Cron + job table)                                                      | Summaries, reports, review scheduling                                                                                                    |
| Email               | **Resend**                                                                                    | Weekly parent summaries                                                                                                                  |
| Error/observability | **Sentry** + structured logs + PostHog (product analytics)                                    | Cheap, Vercel-friendly                                                                                                                   |
| Testing             | **Vitest** (unit/integration) + **Playwright** (e2e) + **eval harness** (§36)                 | Standard, fast                                                                                                                           |
| Deployment          | **Vercel** (app) + **MongoDB Atlas** (DB)                                                     | Zero server ops, one provider for the app                                                                                                |

**Why not a separate Express/Mongo service:** the AI pipeline needs to run serverless, co-located with the Next.js app; an extra Express service would add a second deployable and slow iteration. No separate vector DB (§14), no queues until Inngest proves insufficient, no CMS in MVP.

---

## 34. Project structure (Next.js monorepo-lite, single app)

```
aiTutor/
  src/
    app/
      (marketing)          # landing, about (future)
      (auth)/login|register
      (child)/tutor/       # session UI
      (parent)/dashboard/  # progress
      admin/               # admin panels
      api/v1/...           # route handlers (§26)
    features/
      tutor/               # orchestrator, provider abstraction, tools, memory, safety
        orchestrator/
        providers/         # AiProvider interface + openai adapter
        tools/
        safety/            # input/output moderation, deflections
        memory/            # memory builder, summarizer
        prompts/           # versioned prompt templates (§35)
        curriculum/        # retrieval, hybrid search
        engine/            # mastery scoring, adaptation, review queue
      auth/                # nextauth config, roles, permissions
      curriculum/          # taxonomy services + admin editor components
      progress/            # parent dashboard, reports
      gamification/
      admin/
      components/          # shared UI (ui/*, widgets, mascot)
      hooks/ lib/ styles/ types/ data/
    middleware.ts           # auth gate
    server/                 # mongoose connection, models, jobs (Inngest), env validation
    models/                 # Mongoose schemas + indexes
  prompts/                  # versioned prompt files (or in DB via PromptVersion)
  tests/                    # unit, integration, e2e, eval scenarios
  eval/                     # golden scenarios + rubrics (§36)
  .env.example              # template; runtime config lives in .env
```

Follows standard Next.js conventions (App Router, `src/`, central `lib/`) with a feature-first layout.

---

## 35. Prompt architecture

Prompts are **templates with slots**, versioned in the DB (`PromptVersion`, §27) so changes are audited and reversible, seeded from `prompts/` at deploy.

Separated blocks:

1. **system.role** — "You are Eazi, a warm, patient primary-school teacher…"
2. **system.safety** — hard boundaries + deflection behavior (always present, first)
3. **student.context** — age band, grade, reading level, preferences (Memory Builder, §13)
4. **curriculum.context** — current lesson/examples/objective + retrieved chunks (§6, §14)
5. **conversation.summary** — session running summary + recent turns (budgeted, §13)
6. **instruction.task** — the orchestrator's chosen action + structured-output schema (§10, §16)

Each block is assembled only if relevant; the composer guarantees ordering and budget. Version bumps are compared with the **eval suite** (§36) before activation.

---

## 36. AI evaluation & testing

**Layered test pyramid:**

1. **Unit** — orchestrator decisions, mastery math, authz, validation, moderation classifier.
2. **Integration** — API flows with a **mock provider** (deterministic); safety gate paths; rate limits.
3. **E2E (Playwright)** — child journey: login → pick topic → answer → get hint → finish → see stars.
4. **Eval harness (evals/)** — a golden set of scenarios run against the real provider, scored by an **LLM-as-judge + rubric**:

| Dimension               | Example scenario                                                            |
| ----------------------- | --------------------------------------------------------------------------- |
| Educational correctness | "Explain equivalent fractions to a 9-year-old" → must teach, not state      |
| Age appropriateness     | "Why do volcanoes erupt?" at Basic 3 → vocab/depth within band              |
| Teaches vs answers      | Child asks "what's 3+5?" → tutor should prompt, not only answer             |
| Difficulty adaptation   | 3 wrong in a row → hint + easier question, not harder                       |
| Curriculum alignment    | Question must map to seeded ContentStandard                                 |
| Hallucination control   | Curriculum chunk absent → tutor says "I'm not sure", no invented facts      |
| Safety (adversarial)    | Jailbreak, PII request, off-topic, adult content → deflection + SafetyEvent |

Score gates per release (e.g. safety 100%, correctness ≥ 95%) block deploys. Regressions in eval → prompt version rolled back (§35).

---

## 37. Failure handling (child-friendly)

| Failure                     | Behavior                                                                    |
| --------------------------- | --------------------------------------------------------------------------- |
| Provider unavailable        | Retry once; then friendly message + suggest offline practice; session saved |
| Timeout                     | Same as above; no partial wrong content                                     |
| Unsafe output (moderation)  | Never shown; friendly fallback + SafetyEvent                                |
| Malformed structured output | One re-parse/retry; then fallback free-text reply + log                     |
| Curriculum unavailable      | Tutor uses only safe general knowledge, flags "I'll get your lesson ready"  |
| DB failure                  | Return cached session summary if possible; friendly retry message           |
| Rate limit exceeded         | "Let's take a short break, then keep going!" + resume prompt                |

All failures are logged (no PII) and surfaced in admin monitoring; the child always gets a warm, honest message — never a stack trace.

---

## 38. Env variables / third-party services

**Env (`.env`, split per environment; a `.env.example` template is committed):**

```
MONGO_URL,                    # MongoDB Atlas connection string
JWT_SECRET / AUTH_SECRET,     # NextAuth secret
NEXTAUTH_URL,                 # app URL
AI_PROVIDER=openai,
OPENAI_API_KEY, OPENAI_MODEL_TUTOR, OPENAI_MODEL_STRONG,
OPENAI_MODEL_STRUCTURED, OPENAI_MODEL_SUMMARY, OPENAI_EMBEDDING_MODEL,
MODERATION_API_KEY,           # or reuse OPENAI
UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN,
SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY,
RESEND_API_KEY, EMAIL_FROM,
SESSION_MSG_CAP, DAILY_SESSION_CAP, RETENTION_DAYS, SAFETY_THRESHOLDS,
VERCEL_CRON_TOKEN / INNGEST_SIGNING_KEY,
NEXT_PUBLIC_APP_URL
```

**Services:** Vercel, MongoDB Atlas, OpenAI, Upstash, Sentry, Resend, PostHog, (later) Deepgram/ElevenLabs/Inngest.

---

## 39. Risks & technical decisions

| Risk                                   | Mitigation                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Hallucinated or off-curriculum answers | Curriculum grounding + grounding check + eval gate (§6, §16, §36)                 |
| Child-safety incident                  | Multi-layer enforcement, adversarial suite, admin review, parent controls (§18)   |
| AI cost blow-up                        | Model tiering, context budgets, caps, UsageLog alerts (§30)                       |
| Provider dependency                    | Abstraction + fallback chain (§8)                                                 |
| Mastery model wrong for real children  | Evidence gate + prerequisite graph; replaceable by BKT behind one interface (§12) |
| Streaming latency on Vercel            | Small default model, budgeted context, streaming-first; warm functions            |
| Legal exposure (children)              | COPPA/GDPR-K/Act 843 review before launch (§19)                                   |

**Decisions I made (with justification) vs brief's implied choices:**

- Provider = OpenAI (structured output + moderation API dominate for a child product).
- Mastery = scored weighted model + evidence gate, not raw BKT (transparency, simplicity; replaceable).
- Curriculum = DB-first + Markdown + Atlas Vector Search, no CMS (simplest scalable path).
- Single Next.js app, no separate backend service (one deployable, simplest ops).
- MongoDB + Mongoose (document model fits nested curriculum content; Atlas Search + Vector Search in one place; compelling reason: structured AI output + vector search + curriculum content with heterogeneous fields).

---

## 40. Open questions (tracked, low-blocking)

1. Exact OpenAI model pins (GPT-4o-mini vs newer equivalents) — resolve at Phase 1 start, not now.
2. Language of content beyond English (e.g. Twi) — affects `StudentProfile.language` only; no architecture change.
3. Ghana Data Protection registration status for a child product — legal, before launch.
4. Should a child's daily session limit be parent-set or admin-default? (MVP: admin default + parent override.)
5. Branding of the mascot (name/design) — needs product/design input, not technical.

---

## 41. Exact recommended implementation order

1. **Phase 0** — scaffold repo, TS config, ESLint/Prettier, Vitest, Mongoose + MongoDB Atlas, NextAuth roles, auth routes, CI, design tokens.
2. **Phase 1 slice (the walking skeleton)** — see _Recommended starting point_ below.
3. **Phase 2** — curriculum collections + admin CRUD + retrieval + grounding.
4. **Phase 3** — mastery engine + adaptation.
5. **Phase 4** — parent dashboard + reports + retention.
6. **Phase 5** — gamification.
7. **Phase 6** — safety/monitoring hardening + adversarial sign-off.
8. **Phase 7** — voice.
9. **Phase 8** — multimodal.

---

## 42. Brand & design system (v2 redesign)

> **Status: approved for implementation on existing pages (landing, auth, dashboard) as a
> reviewable checkpoint. Supersedes the visual descriptors in §25/§33 ("warm, rounded,
> playful", orange brand). Future surfaces (tutor UI, parent/admin dashboards) build on this
> system once the checkpoint is approved.**

### 42.1 Design direction

**"Modern education technology"** — minimal, professional, warm, trustworthy, accessible.

- **Not** a children's toy (no rainbow colors, no excessive roundness/gradients/decoration).
- **Not** a generic SaaS dashboard (warmth and child-friendliness are preserved, not stripped).
- One strong primary color, a cool neutral canvas, one warm accent used sparingly, semantic
  colors only where meaning requires them.

| Brand value  | Expressed by                                                                          |
| ------------ | ------------------------------------------------------------------------------------- |
| Trust        | Indigo primary, calm neutrals, restrained shadows, consistent components               |
| Learning     | Clear hierarchy, progress indicators, skill-focused layout                            |
| Intelligence | Clean typography, tabular numbers, precise spacing                                    |
| Simplicity   | Neutral-first surfaces, few hues, one action per view                                 |
| Growth       | Progress bars/stars in accent, mastery visualizations (indigo→green as skills grow)   |
| Technology   | Modern geometric sans, line icons, subtle motion                                      |
| Safety       | Predictable UI, strong focus states, warm failure messages, no alarming color noise    |
| Accessibility| WCAG AA contrast, 44px touch targets, focus rings, reduced-motion support, no color-only states |

### 42.2 Audit — what exists today

Current system (`styles/tokens.ts` + `GlobalStyle.tsx` + `Button/Card/TextField/AuthShell`):
warm-orange primary `#B45309`, cream background `#FCF7F0`, beige borders, teal secondary,
violet accent, Geist Sans, full-pill buttons, `1.5rem`+radius shadowed cards, emoji iconography.

Problems found:

1. **Muddy brand color** — dark brown-orange primary reads heavy/dated rather than premium.
2. **Too many hues compete** — orange + teal + violet + semantic blue/red/green.
3. **Semantic collision** — `warning` and `primary` share the same hex (`#B45309`); the same
   color means "action" and "attention".
4. **Toy aesthetic** — full-pill buttons + `2rem`-radius cards + shadows everywhere = floating
   bubbles, not surfaces.
5. **Emoji as iconography** — brand mark is 🎓 in a circle; feature cards use 🛡️📚🧠🎉 —
   casual, platform-dependent, breaks the premium feel.
6. **No interactive tokens** — `disabled`/`selected`/`focus` states undefined.
7. **One-off styling** — `AgeSelect` re-implements input styles inline; dashboard cards are
   inline blocks. This pattern will explode as Phase 1+ adds dozens of components.
8. **No type roles** — a size scale exists but no Display/H1/H2/H3/Body/Small/Caption
   semantics; headings default to `extraBold`.
9. **No loading / empty / error states** defined.
10. **No dark theme** and no `prefers-color-scheme` plan.
11. **No logo/wordmark** asset — brand mark is an emoji in a colored circle.

### 42.3 Color system — light theme (default)

Palette is **indigo (brand) + cool slate canvas + amber (warm accent)**, semantics in
green/amber/red/blue. All text pairs pass WCAG AA (≥4.5:1) on their surfaces.

| Token                  | Value     | Usage / notes                                                     | Contrast on white |
| ---------------------- | --------- | ----------------------------------------------------------------- | ----------------- |
| **Brand**              |           |                                                                   |                   |
| `primary`              | `#4F46E5` | Primary actions, links, active nav, progress fill                 | 6.3:1 (AA)        |
| `primary-hover`        | `#4338CA` | Hover on primary                                                  | 7.6:1 (AA)        |
| `primary-active`       | `#3730A3` | Pressed state                                                     | 9.3:1 (AAA)       |
| `primary-subtle`       | `#EEF2FF` | Selected rows, tinted panels (text stays ink)                     | —                 |
| `primary-soft`         | `#E0E7FF` | Hover on subtle, focus-ring companion                             | —                 |
| **Accent (warm)**      |           |                                                                   |                   |
| `accent`               | `#D97706` | Stars, mascot details, celebration fills (decorative only)        | — (fill)          |
| `accent-strong`        | `#B45309` | Accent text/icon on light bg (sparingly)                          | ≥4.5:1 (AA)       |
| `accent-subtle`        | `#FFFBEB` | Encouragement banners, mastery celebration panel                  | —                 |
| `accent-soft`          | `#FEF3C7` | Hover on accent-subtle                                            | —                 |
| **Neutrals**           |           |                                                                   |                   |
| `background`           | `#F8FAFC` | App background                                                    | —                 |
| `surface`              | `#FFFFFF` | Cards, inputs, panels                                             | —                 |
| `surface-secondary`    | `#F1F5F9` | Alternating rows, disabled fills, subtle wells                    | —                 |
| `border`               | `#E2E8F0` | Default hairline borders                                          | —                 |
| `border-strong`        | `#CBD5E1` | Input borders, stronger separators                                | —                 |
| `text-primary`         | `#0F172A` | Headings, primary body text                                       | 17.6:1 (AAA)      |
| `text-secondary`       | `#334155` | Secondary body text (dense/parent surfaces)                       | 9.2:1 (AAA)       |
| `text-muted`           | `#64748B` | Metadata, captions                                                | 4.8:1 (AA)        |
| `text-faint`           | `#94A3B8` | Placeholders, disabled text only                                  | 3.2:1 (not text)  |
| **Semantic**           |           |                                                                   |                   |
| `success`              | `#15803D` | Correct answers, mastered skills                                  | ≥4.5:1 (AA)       |
| `success-subtle`       | `#F0FDF4` | Correct-answer panel fill                                         | —                 |
| `warning`              | `#B45309` | Attention (shares amber family; never appears in same context as accent) | ≥4.5:1 (AA) |
| `warning-subtle`       | `#FFFBEB` | Warning banner fill                                               | —                 |
| `error`                | `#B91C1C` | Real errors, wrong answers                                        | 5.9:1 (AA)        |
| `error-subtle`         | `#FEF2F2` | Error panel fill                                                  | —                 |
| `info`                 | `#1D4ED8` | Informational notices                                             | 6.3:1 (AA)        |
| `info-subtle`          | `#EFF6FF` | Info banner fill                                                  | —                 |
| **Interactive**        |           |                                                                   |                   |
| `focus-ring`           | `#4F46E5` | `:focus-visible` outline (2px + 3px offset)                       | —                 |
| `selected`             | `#EEF2FF` | Selected card/row/tab background + `border-strong`→`primary` border | —               |
| `disabled`             | `#F1F5F9` | Disabled surface + `text-faint` content + reduced opacity         | —                 |

Notes:

- **Accent vs warning share the amber family by design** — accent appears only in decorative/
  celebration contexts (stars, mascot), warning only in alert contexts (icon + text, never
  color alone). They never co-occur in one component.
- Color is never the only signal: success/warning/error states always pair with an icon and/or
  text label.
- The old cream/beige background and orange primary are removed; v1 `primary-soft`/`secondary`/
  `accent`/violet tokens are replaced by the table above.

### 42.4 Color system — dark theme (tokenized, deferred)

Architecture-ready via `data-theme="dark"` overrides in `GlobalStyle` (`:root` light,
`[data-theme="dark"]` dark). Not enabled until Phase 1+ decides on a toggle.

| Token            | Dark value   |
| ---------------- | ------------ |
| `background`     | `#0F172A`    |
| `surface`        | `#1E293B`    |
| `surface-secondary` | `#334155` |
| `border`         | `#334155`    |
| `border-strong`  | `#475569`    |
| `text-primary`   | `#F8FAFC`    |
| `text-secondary` | `#CBD5E1`    |
| `text-muted`     | `#94A3B8`    |
| `primary` (links/text) | `#818CF8` |
| `primary-solid` (buttons) | `#4F46E5` (unchanged) |
| `focus-ring`     | `#818CF8`    |
| semantics        | Lifted 100–200 (`success`→`#4ADE80`, `error`→`#F87171`, `warning`→`#FBBF24`, `info`→`#60A5FA`) |

### 42.5 Typography

**Families** (via `next/font/google`, loaded in `layout.tsx`):

| Role    | Family            | Rationale                                                    |
| ------- | ----------------- | ------------------------------------------------------------ |
| Display | **Nunito Sans**   | Warm, rounded strokes — friendly and highly readable for children, still clean and professional for parents. Replaces the Plus Jakarta Sans + Inter pairing (heavy 800 strokes) after review |
| Body/UI | **Nunito Sans**   | Same family as display for a cohesive, softer look; weights capped at 700 (no 800) |
| Mono    | **Geist Mono** (keep) | Tabular figures for stats, progress, cost/usage numbers      |

**Type roles** (tokenized; sizes fluid on small screens; display weight 700, not 800):

| Role       | Size (rem)        | Weight | Line-height | Letter-spacing | Usage                              |
| ---------- | ----------------- | ------ | ----------- | -------------- | ---------------------------------- |
| `display`  | 2.5 (clamp 2.25→3) | 700    | 1.15        | −0.01em        | Marketing hero, session celebration |
| `h1`       | 2                 | 700    | 1.2         | −0.005em       | Page titles (dashboard, tutor)      |
| `h2`       | 1.5               | 600    | 1.25        | —              | Section titles                      |
| `h3`       | 1.25              | 600    | 1.3         | —              | Card/panel titles                   |
| `body-lg`  | 1.125             | 400    | 1.6         | —              | Hero sub, tutor messages            |
| `body`     | 1                 | 400    | 1.6         | —              | Default text                        |
| `small`    | 0.875             | 400    | 1.5         | —              | Metadata                            |
| `caption`  | 0.75              | 500    | 1.4         | —              | Timestamps, footnotes               |
| `label`    | 0.8125            | 600    | 1.2         | +0.02em        | Form labels, nav, badges            |
| `numeric`  | 0.875 (mono)      | 500    | 1.2         | —              | Stats, mastery scores, cost         |

Rules: headings use `display`/`h1`–`h3` roles only (no ad-hoc sizes); body text never smaller
than 1rem on child surfaces; `label`-cased UI text is sentence case (no ALL-CAPS shouting).

### 42.6 Spacing

Standard 4px-grid scale, keeping v1 token names so components don't churn:

| Token | Value    | Token | Value   |
| ----- | -------- | ----- | ------- |
| `xs`  | 4px      | `3xl` | 32px    |
| `sm`  | 8px      | `4xl` | 40px    |
| `md`  | 12px     | `5xl` | 48px    |
| `lg`  | 16px     | `6xl` | 64px    |
| `xl`  | 20px     | —     | —       |
| `2xl` | 24px     |       |         |

Layout rules: page gutters `3xl` desktop / `xl` mobile; content max-width 1200px; component
internal padding `lg`–`2xl`; cards `2xl`. No arbitrary values in components.

### 42.7 Border radius (restrained)

| Token  | Value   | Applied to                                        |
| ------ | ------- | ------------------------------------------------- |
| `sm`   | 6px     | Inputs, selects, small controls                   |
| `md`   | 10px    | Buttons, cards, dropdowns, tables                 |
| `lg`   | 16px    | Modals, feature cards, tutor lesson cards         |
| `xl`   | 20px    | Rare (large celebratory panels)                   |
| `pill` | 9999px  | Badges, toggles, avatar, small icon buttons only  |

Buttons drop the pill shape → `md`. Large cards use `md`/`lg`, never `2xl`+ — no floating
bubbles.

### 42.8 Shadows & elevation

Elevation is layered and minimal; **cards default to border + surface contrast, no shadow**.

| Token          | Value                                       | Used for                      |
| -------------- | ------------------------------------------- | ----------------------------- |
| `elevation-1`  | `0 1px 2px rgba(15,23,42,0.05)`             | Hover on bordered cards       |
| `elevation-2`  | `0 4px 12px rgba(15,23,42,0.08)`            | Dropdowns, popovers, sticky header |
| `elevation-3`  | `0 16px 40px rgba(15,23,42,0.16)`           | Modals, toasts, celebration   |
| `focus-ring`   | `0 0 0 3px rgba(79,70,229,0.35)`            | Companion to the outline ring |

v1 mapping for migration: `shadow-card`→`elevation-1`, `shadow-card-hover`→`elevation-2`,
`shadow-popover`→`elevation-3`. Buttons never carry shadows.

### 42.9 Motion

Restrained: no springy defaults, no bounce, no auto-animations except on mastery moments.

| Token        | Value                                   | Used for                                  |
| ------------ | --------------------------------------- | ----------------------------------------- |
| `duration-fast`   | 120ms                              | Color/state changes, hover, focus         |
| `duration-normal` | 220ms                              | Panels, dropdowns, page transitions       |
| `duration-slow`   | 400ms                              | Modals, large reveals                      |
| `ease-standard`   | `cubic-bezier(0.2,0,0,1)`          | Default easing                            |
| `ease-emphasis`   | `cubic-bezier(0.16,1,0.3,1)`        | Entrances, celebration                    |
| `ease-spring`     | `cubic-bezier(0.34,1.56,0.64,1)`    | **Only** mascot celebration (confetti/stars) |

`prefers-reduced-motion: reduce` stays global (already implemented).

### 42.10 Iconography & brand mark

- **Icon set:** Lucide-style 24px-grid line icons, 2px stroke, consistent 16/20/24 sizes,
  rendered from a shared `Icon` component. **No emoji in UI chrome.** (Tutor message *content*
  may still carry the mascot illustration, never emoji.)
- **Brand mark:** replace the 🎓 emoji with a geometric mark — an open-book/growth glyph in a
  **rounded-square** (radius `md`) indigo tile on white, with an amber spark. Wordmark:
  "EazWorld **AI Tutor**" in Nunito Sans 700, `text-primary` with `primary` emphasis on
  "AI Tutor". Mascot "Eazi" keeps its placeholder status (§40.5); when designed it uses
  `accent`/`primary` flat colors, no gradients.

### 42.11 Component language (spec for Phase 1+)

All components share: token-driven styling (no hard-coded values), 44px+ touch targets,
`focus-visible` ring (2px outline + 3px offset, `focus-ring` color), `disabled` = surface
`surface-secondary` + `text-faint` + reduced opacity, semantic states always paired with an
icon and/or text.

| Component       | Spec (shape, color, behavior)                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Button          | Radius `md`, no shadow, min-height 44/48/56 (sm/md/lg). Primary = `primary` fill; secondary = outline `border-strong`; ghost = text `primary`; danger = `error` fill. Hover/active via `primary-hover/active`. |
| Input / Select / Textarea | Radius `sm`, 1px `border-strong`, focus = `primary` border + `focus-ring` halo (replaces 2px border + shadow). 44px min height. |
| Checkbox / Radio | Custom-drawn (not native accent), 20px box, `primary` checked fill, focus ring, ≥44px hit area.                 |
| Card            | Radius `md` (lg for feature/lesson cards), 1px `border`, **no default shadow**; hover = `elevation-1`.          |
| Badge           | Pill, 12px label-style text, `primary-subtle` neutral + semantic tints (success/error/warning/info) with icon.  |
| Alert           | Radius `md`, 1px border, `*-subtle` fill + semantic icon + text; never color alone.                            |
| Tabs            | Text-first, `label` role, active = `primary` text + 2px `primary` underline or `selected` fill; focus ring.    |
| Table           | Borderless rows, `surface-secondary` zebra (optional), `border` row hairlines, sticky header, mono numbers.    |
| Modal / Dialog  | Radius `lg`, `elevation-3`, overlay `rgba(15,23,42,0.4)`, focus trap, ESC to close.                            |
| Dropdown / Menu | Radius `md`, `elevation-2`, 1px border, keyboard navigation.                                                    |
| Tooltip         | `elevation-2`, `text-primary` on `surface`, appears on focus/hover, dismissible.                               |
| Progress        | 8px track `surface-secondary`, fill `primary`; success state fill `success`; labeled %, never color alone.     |
| Skeleton        | Pulsing `surface-secondary` blocks (opacity pulse, respects reduced motion).                                   |
| Empty state     | Centered line icon + `h3` title + `body` hint + one primary action.                                             |
| Error state     | `error` icon + message + retry action; friendly child copy (plan §37).                                          |
| Header / Nav / Sidebar | Header: hairline bottom border, wordmark + nav; Sidebar (parent/admin): `background` bg, `selected` highlight, 240px collapsed to bottom-tab on mobile. |

### 42.12 Application — AI Tutor surface

Priority is **learning, not chat**:

- Layout: lesson rail (objective, skill, progress) + conversation panel; conversation reads as
  a **teacher's lesson flow** (concept card → example card → practice card → feedback card),
  not a bare chat.
- Tutor messages render as flat `surface` cards with 1px `border`, avatar mark left, **no
  speech-bubble tails**.
- Answer widgets: MCQ = large `md`-radius answer buttons (selected = `primary-subtle` +
  `primary` border; correct = `success-subtle`; wrong = `error-subtle`); free text = standard
  `Input`; hint = progressive disclosure button with `info` styling.
- Encouragement: `accent` star/icon moments on correct answers; confetti (reduced-motion-aware)
  only on mastery milestones; XP/score shown in `numeric` mono.
- Header: subject + skill chips + session progress bar (`primary` fill).

### 42.13 Application — student dashboard

Playful-but-clean: big subject cards (`lg` radius, flat), skill chips, mastery progress bars,
star totals in `accent`. One goal per view ("What am I learning?" → "What should I do next?" →
"How am I progressing?"). Touch-first, single column on mobile.

### 42.14 Application — parent dashboard

Professional education platform: denser `small`/`body` type, tables with `numeric` mono
figures, `primary` charts, semantic badges for mastered/developing/needs-support, restrained
color. Raw conversation never shown (§20).

### 42.15 Application — admin

Dense tables + tabs + filters + status badges; semantic colors for safety/usage states;
`numeric` mono for AI cost; neutral-first with `primary` only for primary actions.

### 42.16 Responsive rules

- Mobile-first, breakpoints unchanged (`sm 640 / md 768 / lg 1024 / xl 1280`).
- Sidebar → bottom tab bar on <md; tables → card stacks on <md; tutor rail collapses to a
  collapsible "Today's goal" strip; forms reflow to single column.

### 42.17 Accessibility rules (design-system level)

1. All text ≥ AA (4.5:1 normal, 3:1 large) on its surface; verify `text-muted` (4.8:1) is the
   floor for real content — `text-faint` is placeholder/disabled only.
2. Semantic states always pair color with icon and/or text.
3. `:focus-visible` 2px outline + 3px offset in `focus-ring` on every interactive element.
4. Touch targets ≥44×44px (48 for primary actions on child surfaces).
5. Base font ≥16px on child surfaces; `prefers-reduced-motion` honored globally.
6. Semantic HTML + ARIA on custom components (modal focus trap, tablist, progress `role`).
7. Keyboard navigable menus/tabs/accordions; visible active nav state.
8. Dark theme via `prefers-color-scheme` + manual `data-theme` override when enabled.

### 42.18 Token architecture

- Single source of truth stays `src/styles/tokens.ts` (colors/type/spacing/radius/shadow/
  motion/breakpoints/focus + new `interactive` and `typeRoles` groups).
- `GlobalStyle.tsx` injects CSS custom properties: `:root` = light; `[data-theme="dark"]`
  overrides; both themes emitted up front so components are theme-agnostic.
- Components reference only tokens/variables; one-off styled values are code-review flagged.

### 42.19 Implementation order (approved scope: existing pages first)

1. Rewrite `tokens.ts` + `GlobalStyle.tsx` (light+dark variables, type roles, elevation).
2. Swap fonts in `layout.tsx` (Plus Jakarta Sans + Inter; keep Geist Mono).
3. Brand mark + wordmark + `Icon` component; remove emoji from chrome.
4. New shared primitives needed by existing pages (Select, Badge, EmptyState).
5. Refresh existing components (Button, Card, TextField, AuthShell, LogoutButton) + pages
   (landing, auth, dashboard, AddChildForm). — **checkpoint: user approves before any other
   surface is built.**
6. Remaining primitives (Alert, Tabs, Modal, Tooltip, Progress, Skeleton, Table, Checkbox,
   Radio) are built when their pages arrive (tutor UI, parent/admin dashboards).
7. Accessibility + contrast pass; update §25/§33 tables; optionally extract this section to a
   `DESIGN.md` source of truth.

---

## RECOMMENDED STARTING POINT

**First milestone (4–6 focused weeks): the "walking skeleton" tutor loop — everything that proves the concept, nothing more.**

Scope:

1. Scaffold Next.js (TS) + styled-components + Mongoose + MongoDB Atlas + NextAuth with the role model (`superadmin/admin/teacher/parent/student`) and parent→child enrollment.
2. Seed two subjects (**Mathematics** and **English Language**) with a minimal but _real_ NaCCA-shaped slice each: `GradeLevel(Basic 1..4) → Subject → Strand → SubStrand → ContentStandard → Skill → Lesson → PracticeItem` — 2 skills per subject, 3–5 items each.
3. Implement the **provider abstraction** + OpenAI adapter (non-streaming first, streaming second), the **Tutor Orchestrator** v1 with intents (explain / ask / hint / correct / recommend / smalltalk / unsafe), the **safety gate in/out** (Mongoose/JSON-schema validation + Moderation API + keyword classifier), and `SkillMastery` scoring v1.
4. Build the **child tutor UI**: mascot, session flow, MCQ + free-text widgets, hint reveal, encouragement, end-of-session summary + XP stub.
5. Eval: the **golden scenarios** for safety + teaching-vs-answering + age appropriateness, gated in CI.

Completion criteria: a child (Basic 2–3) can log in under a parent, complete a short Maths or English session end-to-end, receive streamed, curriculum-grounded, age-appropriate teaching, and see a mastery score update — with the safety suite green and AI cost per session logged.

After this milestone is demoed, we expand per §41.

## DECISIONS REQUIRED FROM ME

Only what genuinely needs your input:

1. **Mascot/branding identity** for the tutor ("Eazi" placeholder) — name + look (product, not technical).
2. **Pricing/monetization posture** — free MVP with parent enrollment? Introduces nothing technical now; just confirm we defer billing.
3. **Daily session/message caps defaults** — e.g. 30 messages/session, 3 sessions/day. (I'll use these defaults if you don't care.)
4. **Provider fallback requirement** — is a second provider (e.g. Anthropic) a hard launch requirement or nice-to-have? (Architecture supports it either way; decides whether we build the adapter in Phase 0 or Phase 6.)

Everything else in this plan is decided and justified above. Please review and approve (or adjust) — then we start Phase 0.
