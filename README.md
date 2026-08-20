# EazWorld AI Tutor

A safe, personalized, adaptive AI tutor for children aged 5–11 (primary school),
aligned to the Ghana NaCCA curriculum. **Teacher, not chatbot** — it teaches,
checks understanding, and decides what's next.

- Plan: [`EazWorld-AI-Tutor-Plan.md`](./EazWorld-AI-Tutor-Plan.md)
- Work tracker: [`tasks.md`](./tasks.md)

## Stack

- Next.js 16 (App Router) + TypeScript · Turbopack
- **styled-components** (SSR registry) + design tokens in `src/styles/tokens.ts`
- MongoDB Atlas + Mongoose (validation lives in schemas — no Zod/Prisma)
- NextAuth v5 (credentials, JWT in httpOnly cookie) + `lib/authorize.ts` permission helpers
- Vitest (unit) · Playwright (e2e, later phases) · GitHub Actions CI

## Getting started

1. `cp .env.example .env` and fill in:
   - `MONGO_URL` — MongoDB Atlas connection string
   - `AUTH_SECRET` — `openssl rand -base64 32`
2. `npm install`
3. `npm run dev` → http://localhost:3000

Register a parent account → log in → add a child (creates + links the child) →
log in as the child. See `scripts/verify-phase0.sh` for the scripted flow.

## Checks

```bash
npm run lint        # ESLint
npm run typecheck   # next typegen + tsc
npm test            # Vitest
npm run build       # production build
```

## Safety & privacy (non-negotiable)

- Multi-layer safety is enforced in code, never only a system prompt.
- Student isolation is a hard invariant (`lib/authorize.ts`).
- No PII in logs; `.env` is gitignored; `.env.example` is the committed template.
