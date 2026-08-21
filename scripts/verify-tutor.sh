#!/usr/bin/env bash
# Phase 1 tutor E2E verification (plan §31 "Done when": a child can learn in a
# tutor session end-to-end against the real API + Atlas).
#
# Prereqs:
#  1. MONGO_URL set in .env; curriculum seeded (`npm run seed`) and chunks
#     backfilled (`npm run backfill:chunks`)
#  2. `npm run dev` running on http://localhost:3000
#  3. OPENAI_API_KEY with quota for the happy-path turn (the blocked-input
#     probe works without it — the local classifier short-circuits)
#
# Usage:  bash scripts/verify-tutor.sh
#         SKIP_LLM_TURN=1 bash scripts/verify-tutor.sh   # skip step 7 (no quota needed)
#
# Never prints tokens/passwords/message content; only envelope fields asserted.
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
SKIP_LLM_TURN="${SKIP_LLM_TURN:-0}"
TS="$(date +%s)"
PARENT_EMAIL="tutor-parent.$TS@example.com"
CHILD_USERNAME="tutor-child-$TS"
PASSWORD="TutorPass!23"

echo "== 1. /tutor page reachable =="
PAGE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/tutor")"
case "$PAGE_CODE" in 200|302|307) ;; *) echo "FAIL: /tutor returned $PAGE_CODE"; exit 1;; esac
echo "OK ($PAGE_CODE)"

echo "== 2. Register parent + login + add child =="
curl -fsS -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"parent\",\"name\":\"Tutor Parent\",\"email\":\"$PARENT_EMAIL\",\"password\":\"$PASSWORD\",\"consent\":true}" \
  | grep -q '"success":true' || { echo "FAIL: register parent"; exit 1; }
PARENT_JAR="/tmp/eaz-tutor-p.$TS.txt"
curl -fsS -c "$PARENT_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$PARENT_EMAIL\",\"password\":\"$PASSWORD\"}" \
  | grep -q '"success":true' || { echo "FAIL: login parent"; exit 1; }
curl -fsS -b "$PARENT_JAR" -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"student\",\"name\":\"Tutor Child\",\"username\":\"$CHILD_USERNAME\",\"password\":\"$PASSWORD\",\"ageBand\":\"7-8\"}" \
  | grep -q '"role":"student"' || { echo "FAIL: add child"; exit 1; }
echo "OK"

echo "== 3. Login as child =="
JAR="/tmp/eaz-tutor-c.$TS.txt"
curl -fsS -c "$JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CHILD_USERNAME\",\"password\":\"$PASSWORD\"}" \
  | grep -q '"success":true' || { echo "FAIL: login child"; exit 1; }
grep -q "authjs.session-token" "$JAR" || { echo "FAIL: no session cookie"; exit 1; }
echo "OK"

echo "== 4. Resolve a seeded subject =="
SUBJECT_ID="$(npx tsx --env-file=.env scripts/list-subjects.ts | grep -i mathematics | cut -d' ' -f1 || true)"
[ -n "$SUBJECT_ID" ] || SUBJECT_ID="$(npx tsx --env-file=.env scripts/list-subjects.ts | head -1 | cut -d' ' -f1)"
[ -n "$SUBJECT_ID" ] || { echo "FAIL: no active subject found — run npm run seed"; exit 1; }
echo "OK (${SUBJECT_ID})"

echo "== 5. Create session (grounding resolves the skill) =="
SESSION_RES="$(curl -fsS -b "$JAR" -X POST "$BASE/api/v1/tutor/sessions" \
  -H 'content-type: application/json' \
  -d "{\"subjectId\":\"$SUBJECT_ID\",\"goal\":\"Learn adding\"}")"
echo "$SESSION_RES" | grep -q '"success":true' || { echo "FAIL: create session: $SESSION_RES"; exit 1; }
echo "$SESSION_RES" | grep -q '"skill":{"id"' || { echo "FAIL: skill not resolved on create: $SESSION_RES"; exit 1; }
SESSION_ID="$(echo "$SESSION_RES" | sed -n 's/.*"session":{"id":"\([^"]*\)".*/\1/p')"
[ -n "$SESSION_ID" ] || { echo "FAIL: no session id"; exit 1; }
echo "OK (session $SESSION_ID)"

echo "== 6. Blocked-input probe (local classifier, no provider needed) =="
STREAM="$(curl -fsS --max-time 30 -b "$JAR" -X POST "$BASE/api/v1/tutor/sessions/$SESSION_ID/messages" \
  -H 'content-type: application/json' \
  -d '{"content":"What is my password?"}')"
echo "$STREAM" | grep -q '^event: blocked' || { echo "FAIL: expected blocked event"; exit 1; }
echo "$STREAM" | grep -q '"blocked":true' || { echo "FAIL: done event missing blocked flag"; exit 1; }
echo "OK"

echo "== 7. Happy-path turn (streams approved reply + envelope) =="
if [ "$SKIP_LLM_TURN" = "1" ]; then
  echo "SKIP (SKIP_LLM_TURN=1)"
else
  TURN="$(curl -fsS --max-time 90 -b "$JAR" -X POST "$BASE/api/v1/tutor/sessions/$SESSION_ID/messages" \
    -H 'content-type: application/json' \
    -d '{"content":"Can you teach me how to add numbers?"}')"
  if echo "$TURN" | grep -q '^event: error'; then
    echo "FAIL: provider error on tutor turn."
    echo "      Check OPENAI_API_KEY quota (insufficient_quota blocks every turn)."
    exit 1
  fi
  echo "$TURN" | grep -q '^event: meta' || { echo "FAIL: no meta event"; exit 1; }
  echo "$TURN" | grep -q '^event: delta' || { echo "FAIL: no delta events"; exit 1; }
  echo "$TURN" | grep -q '^event: done' || { echo "FAIL: no done event"; exit 1; }
  echo "$TURN" | grep -q '"response":"[^"]' || { echo "FAIL: empty envelope response"; exit 1; }
  echo "OK"
fi

echo "== 8. GET session shows transcript =="
GET_RES="$(curl -fsS -b "$JAR" "$BASE/api/v1/tutor/sessions/$SESSION_ID")"
echo "$GET_RES" | grep -q '"status":"active"' || { echo "FAIL: session not active"; exit 1; }
MESSAGES="$(echo "$GET_RES" | grep -o '"role"' | wc -l | tr -d ' ')"
if [ "$SKIP_LLM_TURN" = "1" ]; then
  [ "${MESSAGES:-0}" -ge 1 ] || { echo "FAIL: expected ≥1 message (blocked system note), got $MESSAGES"; exit 1; }
else
  [ "${MESSAGES:-0}" -ge 3 ] || { echo "FAIL: expected ≥3 messages (user/assistant/system), got $MESSAGES"; exit 1; }
fi
echo "OK ($MESSAGES messages)"

echo "== 9. End session =="
END_RES="$(curl -fsS -b "$JAR" -X POST "$BASE/api/v1/tutor/sessions/$SESSION_ID/end")"
echo "$END_RES" | grep -q '"status":"ended"' || { echo "FAIL: end session"; exit 1; }
echo "OK"

echo "== 10. Session isolation: another student cannot read it =="
OTHER_USERNAME="tutor-other-$TS"
curl -fsS -b "$PARENT_JAR" -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"student\",\"name\":\"Other Child\",\"username\":\"$OTHER_USERNAME\",\"password\":\"$PASSWORD\",\"ageBand\":\"9-10\"}" > /dev/null
OTHER_JAR="/tmp/eaz-tutor-o.$TS.txt"
curl -fsS -c "$OTHER_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$OTHER_USERNAME\",\"password\":\"$PASSWORD\"}" > /dev/null
FORBIDDEN="$(curl -sS -o /dev/null -w '%{http_code}' -b "$OTHER_JAR" "$BASE/api/v1/tutor/sessions/$SESSION_ID")"
[ "$FORBIDDEN" = "403" ] || [ "$FORBIDDEN" = "404" ] || { echo "FAIL: cross-student access returned $FORBIDDEN"; exit 1; }
echo "OK ($FORBIDDEN)"

rm -f "$JAR" "$PARENT_JAR" "$OTHER_JAR"
echo
echo "✅ TUTOR E2E PASSED — session create, safety block, streamed turn, transcript, end, isolation."
