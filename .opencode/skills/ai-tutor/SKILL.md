---
name: ai-tutor
description: Guide for building the EazWorld AI Tutor. Use when implementing any feature in this repo — tutor orchestration, curriculum, adaptive engine, safety, conversation models, tutor API routes, child UI, evals, or provider wiring. Trigger keywords: tutor, orchestrator, curriculum, skill, mastery, learning signal, safety, moderation, session, message, streaming, provider, prompt, evaluation.
---

# EazWorld AI Tutor — build guide

This project is a greenfield, child-safe (ages 5–11), adaptive AI tutor aligned to the Ghana NaCCA curriculum. The authoritative plan is `EazWorld-AI-Tutor-Plan.md`; work is tracked in `tasks.md`.

## Architecture map (plan §7, §34)

Server-side orchestration — never Frontend → AI API:

```
Route Handler → Tutor Orchestrator
  ├─ Student Context resolver      (profile, grade, mastery, streaks)
  ├─ Learning Context resolver     (current lesson/skill/objective)
  ├─ Curriculum Retriever          (DB read + Atlas Vector Search)
  ├─ Memory Builder                (short/session/long-term, budgeted)
  ├─ Prompt Composer               (versioned template blocks, §35)
  ├─ Safety Gate (in)              (input moderation)
  ├─ AI Provider (abstraction)     (model routing, streaming)
  ├─ Response Validator            (JSON schema + safety + grounding)
  ├─ Learning Signal Extractor
  └─ Persistence + async jobs
```

Key locations (adapt to what exists):

- `src/features/tutor/orchestrator/` — decision state machine (explain/ask/hint/practice/correct/recommend/smalltalk/session_end/unsafe)
- `src/features/tutor/providers/` — `AiProvider` interface + adapters (OpenAI first). Never import the provider SDK elsewhere.
- `src/features/tutor/safety/` — input/output moderation, deflections, keyword classifier
- `src/features/tutor/memory/` — context budget builder + session summarizer
- `src/features/tutor/curriculum/` — retrieval (Atlas Search + Vector Search hybrid)
- `src/features/tutor/engine/` — mastery scoring, adaptation, review queue
- `src/features/tutor/prompts/` — versioned prompt templates (§35)
- `src/models/` — Mongoose schemas + indexes (§27)
- `eval/` — golden scenarios + LLM-as-judge rubrics (§36)

## Golden rules when building

1. **Safety layers are code, not prompts** (§18): input validation → input moderation → prompt restrictions → curriculum gating → output moderation → response validation → rate/caps → monitoring. Wire each layer; if the model can't be trusted for a turn, the safe fallback wins.
2. **Ground the AI**: retrieve the authoritative lesson/items and put them in the curriculum context block; add a grounding check. The model reasons over the knowledge base, never invents curriculum.
3. **Mastery is explicit** (§12): weighted decay score 0–100 + evidence gate (≥3 recent correct at appropriate difficulty + one re-test) + prerequisite graph (`requiresSkillId`). Bands 0–30 / 31–60 / 61–80 / 81–100.
4. **Memory is budgeted** (§13): short-term (~~6 messages), session running summary, long-term highlights (≤3 lines), curriculum chunk (~~≤1200 tokens). Never unbounded history.
5. **Structured output via JSON schema** (§16): tutor action envelope, evaluate_answer, learning signals, moderation verdicts. Validate before persisting; malformed → one retry then friendly fallback.
6. **Child-friendly failures** (§37): provider down / timeout / unsafe output / malformed JSON / DB failure / rate limit — always a warm message, never a stack trace. Log without PII.
7. **Mongoose everywhere**: strict mode, custom validators, reject unknown fields; indexes per §27.
8. **No PII in logs**: ids and counts only.

## Evaluations (§36)

- Unit: orchestrator decisions, mastery math, authz, validation, moderation classifier.
- Integration: API flows with a mocked provider; safety paths; rate limits.
- E2E (Playwright): login → pick topic → answer → hint → finish.
- Eval harness: golden scenarios scored by LLM-as-judge + rubric. Safety must be 100% before merge; correctness ≥ 95%.

## Definition of done

- [ ] Works end-to-end against the real API
- [ ] Input validated via Mongoose/JSON schemas; errors via central handler
- [ ] Auth/authorization correct; student isolation verified
- [ ] Lists paginated; new filter fields indexed
- [ ] Styling uses design tokens (no hard-coded values)
- [ ] `.env.example` updated if new config added
- [ ] `tasks.md` updated; lint + typecheck + tests green
