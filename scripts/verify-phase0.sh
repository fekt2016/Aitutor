#!/usr/bin/env bash
# Phase 0 end-to-end verification (plan §31 "Done when": login as parent/student works).
#
# Prereqs:
#  1. MONGO_URL set in .env (a real MongoDB / Atlas cluster)
#  2. `npm run dev` running on http://localhost:3000
#
# Usage:  bash scripts/verify-phase0.sh
#
# This script performs the full flow and exits non-zero on any failure.
# It never prints tokens/passwords; it prints only the envelope fields we assert.
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
TS="$(date +%s)"
PARENT_EMAIL="parent.$TS@example.com"
PASSWORD="Phase0Pass!23"

echo "== 1. Health: landing + login pages respond =="
curl -fsS -o /dev/null "$BASE/"
curl -fsS -o /dev/null "$BASE/login"
curl -fsS -o /dev/null "$BASE/register"
echo "OK"

echo "== 2. Register parent (public, consent required) =="
REG="$(curl -fsS -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"parent\",\"name\":\"Ama Test\",\"email\":\"$PARENT_EMAIL\",\"password\":\"$PASSWORD\",\"consent\":true}")"
echo "$REG" | grep -q '"success":true' || { echo "FAIL: register parent"; exit 1; }
echo "$REG" | grep -q '"role":"parent"' || { echo "FAIL: role not parent"; exit 1; }
echo "OK"

echo "== 3. Register parent without consent is rejected =="
NO_CONSENT="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"parent\",\"name\":\"No Consent\",\"email\":\"noconsent.$TS@example.com\",\"password\":\"$PASSWORD\",\"consent\":false}")"
[ "$NO_CONSENT" = "400" ] || { echo "FAIL: expected 400 without consent, got $NO_CONSENT"; exit 1; }
echo "OK"

echo "== 4. Login as parent (cookie set) =="
COOKIE_JAR="/tmp/eazworld-cookies.$TS.txt"
LOGIN="$(curl -sS -c "$COOKIE_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$PARENT_EMAIL\",\"password\":\"$PASSWORD\"}")"
echo "$LOGIN" | grep -q '"success":true' || { echo "FAIL: login parent"; exit 1; }
grep -q "authjs.session-token" "$COOKIE_JAR" || { echo "FAIL: no session cookie"; exit 1; }
echo "OK"

echo "== 5. GET /me as parent =="
ME="$(curl -fsS -b "$COOKIE_JAR" "$BASE/api/v1/auth/me")"
echo "$ME" | grep -q '"role":"parent"' || { echo "FAIL: me role"; exit 1; }
echo "OK"

echo "== 6. Add child (parent session required, username only — no email) =="
CHILD_USERNAME="kofi$TS"
ADD_CHILD="$(curl -fsS -b "$COOKIE_JAR" -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"student\",\"name\":\"Kofi Test\",\"username\":\"$CHILD_USERNAME\",\"password\":\"$PASSWORD\",\"ageBand\":\"7-8\"}")"
echo "$ADD_CHILD" | grep -q '"success":true' || { echo "FAIL: add child"; exit 1; }
echo "$ADD_CHILD" | grep -q '"role":"student"' || { echo "FAIL: role not student"; exit 1; }
echo "$ADD_CHILD" | grep -q "\"username\":\"$CHILD_USERNAME\"" || { echo "FAIL: username not stored"; exit 1; }
echo "OK"

echo "== 7. Adding a child without a parent session is rejected =="
NO_SESSION_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"student\",\"name\":\"Orphan\",\"email\":\"orphan.$TS@example.com\",\"password\":\"$PASSWORD\",\"ageBand\":\"5-6\"}")"
[ "$NO_SESSION_CODE" = "401" ] || { echo "FAIL: expected 401, got $NO_SESSION_CODE"; exit 1; }
echo "OK"

echo "== 8. Login as child (by username) =="
CHILD_JAR="/tmp/eazworld-child-cookies.$TS.txt"
CHILD_LOGIN="$(curl -sS -c "$CHILD_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$CHILD_USERNAME\",\"password\":\"$PASSWORD\"}")"
echo "$CHILD_LOGIN" | grep -q '"success":true' || { echo "FAIL: login child by username"; exit 1; }
echo "OK"

echo "== 9. GET /me as child includes student profile =="
CHILD_ME="$(curl -fsS -b "$CHILD_JAR" "$BASE/api/v1/auth/me")"
echo "$CHILD_ME" | grep -q '"role":"student"' || { echo "FAIL: child me role"; exit 1; }
echo "$CHILD_ME" | grep -q '"profile"' || { echo "FAIL: child me has no profile"; exit 1; }
echo "OK"

echo "== 10. Wrong password login rejected (401) =="
BAD="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$PARENT_EMAIL\",\"password\":\"wrong-pass-123\"}")"
[ "$BAD" = "401" ] || { echo "FAIL: expected 401, got $BAD"; exit 1; }
echo "OK"

echo "== 11. /me without session rejected (401) =="
UNAUTH="$(curl -sS -o /dev/null -w '%{http_code}' "$BASE/api/v1/auth/me")"
[ "$UNAUTH" = "401" ] || { echo "FAIL: expected 401, got $UNAUTH"; exit 1; }
echo "OK"

echo "== 12. Passwords with leading/trailing spaces round-trip (no trimming) =="
SPACED_EMAIL="spaced.$TS@example.com"
SPACED_PASSWORD="  spaced pass 42  "
SPACED_REG="$(curl -fsS -X POST "$BASE/api/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"accountType\":\"parent\",\"name\":\"Spaced Test\",\"email\":\"$SPACED_EMAIL\",\"password\":\"$SPACED_PASSWORD\",\"consent\":true}")"
echo "$SPACED_REG" | grep -q '"success":true' || { echo "FAIL: register spaced-password parent"; exit 1; }
SPACED_JAR="/tmp/eazworld-spaced-cookies.$TS.txt"
SPACED_LOGIN="$(curl -sS -c "$SPACED_JAR" -X POST "$BASE/api/v1/auth/login" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$SPACED_EMAIL\",\"password\":\"$SPACED_PASSWORD\"}")"
echo "$SPACED_LOGIN" | grep -q '"success":true' || { echo "FAIL: login with spaced password (registration must not trim)"; exit 1; }
echo "OK"

echo
echo "✅ PHASE 0 E2E PASSED — login as parent/student works end-to-end."
rm -f "$COOKIE_JAR" "$CHILD_JAR" "$SPACED_JAR"