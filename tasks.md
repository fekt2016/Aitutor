# EazWorld AI Tutor — Task Tracker

Tracks all implementation work for the EazWorld AI Tutor (independent project).
Plan: [`EazWorld-AI-Tutor-Plan.md`](./EazWorld-AI-Tutor-Plan.md)
Legend: `[ ]` pending · `[x]` done · `[~]` in progress · `[!]` blocked

> **Git workflow (user-directed):** every new phase gets its **own branch** off
> `main`, named `phase/<n>-<slug>` (e.g. `phase/1-tutor-mvp`). Work happens on the
> branch and it's pushed to `origin` so progress is backed up; `main` only receives
> finished phase work. If we're mid-phase and a new phase starts, the current branch
> is completed/merged first.

---

## Current milestone: Phase 0 — Foundation (done)

> Target: Login as parent/student works end-to-end. ✅ Verified live
> (`scripts/verify-phase0.sh` against real Atlas DB, 2026-08-20).

- [x] Scaffold repo (Next.js + TypeScript, App Router) in `/Users/mac/Desktop/aiTutor`
- [x] Configure ESLint + Prettier + Vitest
- [x] Set up CI (lint + typecheck + test)
- [x] MongoDB Atlas cluster + Mongoose connection + env validation
- [x] Design tokens / base styling system (**styled-components** + CSS variables + `styles/tokens.ts`)
- [x] NextAuth v5 setup (credentials, JWT httpOnly cookie)
- [x] Role model: superadmin / admin / teacher / parent / student
- [x] Core collections: User, GradeLevel, Subject, skeleton TutorSession/TutorMessage
- [x] Parent → child enrollment
- [x] Auth routes (register / login / me) + central error handler
- [x] Unit tests: auth + authorization helpers
- [x] `lib/authorize.ts` (requireRole, requireOwner, requireParentOf)
- [x] Live end-to-end verify against real API (`scripts/verify-phase0.sh`)
- [x] Password show/hide toggle (`PasswordField` in `ui/TextField.tsx`, login + register)
- [x] Login accepts **username or email**; child accounts may have **email OR username** (email optional for students — sparse unique indexes)
- [x] Repaired legacy non-sparse unique index on `email` (blocked multiple email-less children)

> **Styling decision (user-directed):** CSS uses **styled-components** (SSR registry per
> Next 16 docs) instead of Tailwind. Design tokens (colors/type/radii/motion) stay the
> single source of truth in `src/styles/tokens.ts`, injected as CSS variables. Plan §25/§33
> table will be updated to match on confirmation.

> **Dev pitfalls (recorded for future sessions):**
> - Mongoose caches compiled models in the process — a schema change requires a dev-server
>   restart (`strict: true` silently drops new fields on the running server).
> - MongoDB indexes are NOT updated when a schema changes: `required→optional` on a unique
>   field needs the old non-sparse index dropped + a sparse one created (`scripts/…` or
>   one-off `dropIndex`/`createIndex`), else the second email-less doc 409s.

## Design System v2 — brand redesign (checkpoint: current pages)

> Plan §42. Applied to **existing pages only** (landing, auth, dashboard). Awaiting
> user approval before the system is used on future surfaces (tutor UI, parent/admin).
> Styling decision (user-directed): **react-icons** (Lucide set) for all iconography;
> brand mark is a custom SVG (open-book glyph in an indigo tile).

- [x] Design spec written into plan (§42: direction, audit, color light+dark, typography, spacing, radius, elevation, motion, iconography, components, surfaces, a11y, implementation order)
- [x] Tokens rewritten (`tokens.ts`: indigo primary, slate neutrals, amber accent, semantic + interactive groups, type roles, elevation shadows, restrained radii)
- [x] `GlobalStyle` updated (light + dark CSS-variable sets, role vars, 2px focus ring + 3px offset, reduced-motion preserved)
- [x] Fonts swapped in `layout.tsx` (Plus Jakarta Sans + Inter; Geist Mono kept for tabular numbers)
- [x] `Icon` component wrapping `react-icons/lu` (single API, no emoji in UI chrome)
- [x] `BrandMark` + `Wordmark` (replaces 🎓 emoji; open-book mark, amber spark)
- [x] Primitives: `Select`, `Badge`/`BadgeWithIcon`, `EmptyState`
- [x] Components refreshed: `Button` (radius-md, no shadow, outline secondary), `Card` (flat, radius-md), `TextField` (1px border + focus ring, icon eye toggle), `AuthShell` (brand lockup), `LogoutButton`
- [x] Pages refreshed: landing (hero + icon feature cards), login, register, dashboard (child cards + age badges + empty states), AddChildForm (shared Select)
- [x] Verified: lint + typecheck + 45 tests green; live E2E (`verify-phase0.sh`) passed; pages serve 200 + new tokens/fonts/icons in HTML
- [ ] **User approval checkpoint** — then apply system to future surfaces (tutor UI, parent/admin dashboards) and remaining primitives (Alert, Tabs, Modal, Tooltip, Progress, Skeleton, Table, Checkbox, Radio)

## Phase 1 — Tutor MVP (walking skeleton)

> Working branch: `phase/1-tutor-mvp` (merged to `main`). Test/debug on the branch before any merge to main.
> Env additions this phase (`.env*` gitignored — new vars are documented here):
> `AI_PROVIDER` (openai), `OPENAI_API_KEY`, `OPENAI_MODEL_TUTOR` (gpt-4o-mini),
> `OPENAI_MODEL_STRONG`, `OPENAI_MODEL_STRUCTURED`, `OPENAI_MODEL_SUMMARY`,
> `OPENAI_EMBEDDING_MODEL`.

- [x] Provider abstraction (`AiProvider` interface + factory + fallback)
- [x] OpenAI adapter (non-streaming structured + streaming + moderation) — `src/features/tutor/providers/`
- [x] Tutor Orchestrator v1 (intents: explain / ask / hint / practice / correct / recommend / smalltalk / session_end; envelope; retry-then-fallback)
- [x] Safety gate in/out (Mongoose/JSON-schema validation + Moderation API + keyword classifier + output leak checks) — `src/features/tutor/safety/`
- [x] TutorSession (completionReason, skillId) + TutorMessage + LearningSignal + SkillMastery + SafetyEvent + UsageLog models
- [x] SkillMastery scoring v1 (EMA + evidence gate) — `src/features/tutor/engine/mastery.ts`
- [x] Streaming message endpoint (`POST /api/v1/tutor/sessions/:id/messages`, SSE: meta/delta/blocked/done/error)
- [x] Session create / get / end endpoints
- [x] Message + session caps (DB-backed daily/session caps for MVP; Upstash later) — `src/features/tutor/caps.ts`
- [x] Tutor UI: session flow, MCQ + free-text widgets, hint reveal, encouragement, end-of-session summary — `src/app/tutor/`
- [x] Student dashboard CTA → `/tutor`
- [x] Seed Mathematics (Basic 1..4) + English Language (Basic 1..2): Subject → Strand → SubStrand → ContentStandard → Skill → Lesson → PracticeItem (4 skills, 5 items each) — `scripts/seed.ts`, run against real Atlas 2026-08-21 ✓
- [x] Golden-scenario evals (safety, teaching-vs-answering, age appropriateness) — 130 tests green
- [x] AI cost per session logged (UsageLog)
- [x] Fix: `completionReason` default `""` failed its own enum → every session create 400'd (regression test added, `src/models/tutor-session.test.ts`)
- [x] Fix: OpenAI Moderation 429 faked `flagged=true` → every benign turn blocked; now the local classifier verdict stands on provider unavailability + 60s cooldown + typed `ModerationUnavailableError` + real status/message logging + SDK timeout/retry caps (§18; 5 policy tests)
- [~] Live E2E verify — `scripts/verify-tutor.sh` added: 9/10 steps pass live
      (session create + skill grounding ✓, blocked-input safety probe ✓,
      transcript ✓, end ✓, cross-student isolation 403 ✓); only the streamed
      LLM turn awaits the OpenAI quota fix (run without SKIP_LLM_TURN=1)

## Phase 2 — Curriculum integration

> Working branch: `phase/2-curriculum`.

> **Blocker (2026-08-21):** OpenAI account is out of quota (`insufficient_quota`,
> HTTP 429 on every call). Blocks embedding backfill **and any live tutor turn**
> (same key powers chat). Needs billing top-up or a new key before E2E tutor
> verification can resume.

- [x] Strand / SubStrand / ContentStandard / Skill / Lesson / Item collections +
      admin CRUD — collections existed since Phase 0 seed; registry-driven admin
      API added (`/api/v1/admin/curriculum/tree`, `POST /[type]`,
      `PATCH|DELETE /[type]/[id]`, `GET /[type]/[id]/grounded`): §3 role gate,
      per-type field whitelist, soft delete for content rows vs guarded hard
      delete for taxonomy nodes, chunk reindex on every content write.
      15 hermetic route tests (`src/features/curriculum/admin/admin-curriculum.test.ts`)
- [~] Admin curriculum editor UI + grounded lesson view — `/admin/curriculum`
      (role-gated server page + client editor: taxonomy tree with create-then-edit
      "+ level" buttons, skill/lesson/item editors, grounded view tab showing the
      exact bundle + retrieval chunks). Code complete; **live verify pending**
      (needs dev server). Admin bootstrap: `npm run create:admin` ✓ ran on Atlas
- [~] CurriculumChunk + Atlas Search index + embeddings — model ✓, chunker ✓
      (`src/features/tutor/curriculum/chunker.ts`), backfill script ✓
      (`npm run backfill:chunks [-- --embed]`), **40 chunks live on Atlas**;
      embeddings pending quota fix; Atlas Search index "curriculum_chunks" not
      created yet ($search currently returns empty → text tiers serve)
- [x] Curriculum service + tools (`get_current_lesson`, `search_curriculum`) —
      `src/features/tutor/tools/` (§15 contract: read-only, validated, audited,
      never-throw); grounding owns per-turn retrieval policy (thin lesson →
      skill query; full lesson + question → question-aware query)
- [~] Hybrid retrieval — $text→regex fallback tiers **live-verified** (4/4 natural-language
      queries hit relevant chunks); $search fall-through fixed (empty-but-successful
      Tier A no longer short-circuits); Vector tier ready in provider (`embed()`),
      needs quota + Atlas Vector index
- [x] Grounding: thin lessons augmented from curriculum corpus, wired into orchestrator (`src/features/tutor/curriculum/grounding.ts`)
- [x] Retrieval + grounding evals (§36) — `eval/` (scenarios as data + pure scorers +
      live runner): `npm run eval:retrieval` against real Atlas — **14/14 pass,
      hit@3 100%, MRR 1.00** (8 positive NL queries incl. sub-3-char blends edge
      case; 2 negative controls return no relevant hits); grounding policy 4/4
      (thin→skill-context support, full+question→question-aware support, tiny
      message → no retrieval, off-corpus question stays on-curriculum). Gate:
      hit@k ≥ 80% + grounding 100%, non-zero exit on regression. Scorer unit
      tests in `tests/eval-score.test.ts` (180 tests green)

## Phase 3 — Adaptive engine

- [ ] Prerequisite graph (`requiresSkillId`)
- [ ] Mastery scoring (weighted decay + evidence gate + bands)
- [ ] Difficulty adjustment in orchestrator
- [ ] Review/scheduling queue (spaced repetition)
- [ ] `GET /api/v1/tutor/recommendations`
- [ ] "Next up" cards + daily review UI
- [ ] Structured learning-signal extraction
- [ ] Mastery math unit tests + scenario evals (fractions loop)

## Phase 4 — Progress + parent dashboard

- [ ] Weekly report materialization + retention purge job
- [ ] Report API + parent controls (pause tutor, session limits, export/delete)
- [ ] Parent dashboard UI (progress, skills, recommendations, safety flags)
- [ ] Weekly summary email (Resend)
- [ ] Report correctness tests

## Phase 5 — Gamification

- [ ] XpEvent / Badge / StudentBadge / Streak collections
- [ ] Reward service derived from LearningSignal / SkillMastery
- [ ] Anti-grind caps (per session/day)
- [ ] Badge/streak UI + celebrations
- [ ] Anti-grind tests

## Phase 6 — Safety & monitoring hardening

- [ ] Anomaly alerts + transcript review flow
- [ ] Admin safety review queue + policy config
- [ ] AI cost dashboard (UsageLog rollups)
- [ ] Moderation threshold tuning
- [ ] Full adversarial safety suite (jailbreaks, PII, off-topic, adult content)

## Phase 7 — Voice

- [ ] Voice message content type + audio handling (transcript-only storage)
- [ ] STT provider (Deepgram or OpenAI Whisper)
- [ ] TTS provider (ElevenLabs or OpenAI)
- [ ] Mic + playback UI
- [ ] Voice E2E test

## Phase 8 — Multimodal

- [ ] Image message parts (`contentType: image`)
- [ ] Vision provider path (photo-of-problem upload)
- [ ] Upload + diagram widgets
- [ ] Multimodal evals

---

## Notes

- Every phase's "Done when" criteria from the plan must pass (tests/evals + live end-to-end demo).
- Do not add payment/billing, teacher features, native apps, real-time multi-user, offline mode, or a CMS without reopening scope.
- Env-driven config via `.env` (user-directed: `.env*` gitignored; new config vars are documented in this tracker's phase sections).
