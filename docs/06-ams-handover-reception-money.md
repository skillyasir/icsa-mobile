# HANDOVER — AMS changes the ICSA app's Reception screens need (S5, S10)

**Written 13 Nov 2026** in the ICSA app chat, for the **AMS chat**. The app half is the app chat's; this file is only what the AMS must add.
Specs from the app's `docs/03-ams-server-changes.md` §S5 and §S10 (written 3 Nov 2026), made exact here.

---

## 1. Why now

- **Yasir ruled, 13 Nov 2026:** every role works in the app before the closed test ends, released **together** in one Play and one Apple update. Order: staff check-in (built) → **Reception** → Marketers → Managers.
- Reception registers students, enrols them and **takes payments** from a phone. The app's rule (its `CLAUDE.md`): **money never queues offline** — every payment, enrolment and registration write needs a live connection **and carries an idempotency key**, so a phone that retries on a weak signal can never record a payment twice.
- The app builds the Reception screens that need **no** AMS change first (Today, Students, Follow-ups, payment-proof approvals). **Register, Enrol, Take payment and the receipt wait for S5 and S10 below to be live.**

## 2. S5 — idempotent creation and money writes

### What the app will send

- Header **`Idempotency-Key: <uuid v4>`**, one new key per **press of the button**; a retry of that same press re-sends the same key.
- On exactly these routes (all POST):
  - `/api/students` (register)
  - `/api/enrollments`, `/api/enrollments/full`, `/api/payments/schedule` (enrol)
  - `/api/payments` (take a payment)
  - `/api/students/:studentId/charges`
  - `/api/refunds`
  - `/api/payment-proofs` (a student's proof)
- **No header → today's behaviour, unchanged.** The website sends none.

### What the AMS must do

- **Table `idempotency_keys`** — `key` (uuid), `user_id`, `method`, `path` (the route as matched, e.g. `/api/payments`), `body_sha256`, `state` (`in_flight` | `done`), `status` (int), `response_json` (jsonb), `created_at`, `finished_at`. **Unique on (`user_id`, `key`).** Kept 7 days (a sweep inside the SCHEDULERS block).
- **Same user, same key, same method and path, same body:**
  - `done` → answer the **stored status and body**; run nothing.
  - `in_flight` → **409** `{ code: 'IN_PROGRESS', error: 'This is already being saved. Wait a moment, then check before trying again.' }`.
- **Same key, different body or path** → **422** `{ code: 'IDEMPOTENCY_MISMATCH', error: … }` — the app is wrong, never a second write.
- **Store** every 2xx and every 4xx (a refusal is an answer). **Do not store a 5xx**: delete the row so a retry runs again.
- ⚠️ **The edge that matters — decide it in the AMS chat:** a handler that COMMITs the money and then the process dies before the response is stored leaves an `in_flight` row behind. **Recommended:** an `in_flight` row is never retried by itself, however old — it answers 409 with "check the student's payments", so a person looks. Re-running it is the double payment S5 exists to prevent.
- **Who:** the key belongs to the signed-in user; another user's key is a different key.
- **The audit tiers stand** (AMS `CLAUDE.md`): a replay writes **no** new audit row — nothing happened again.
- **Migration first, to BOTH databases** (`icsa_db`, `icsa_subtest`), idempotent, with a `-DOWN.sql` that refuses while rows exist — the house pattern.
- **Check** (a `*.check.js`, stubbed database): a replay with the same key creates **no second `actual_transactions` row**; a different body is 422; an in-flight key is 409; a 5xx leaves no row; no header behaves as today; each of the eight routes is wrapped (a census — a ninth money route added later without it should go red).

## 3. S10 — the receipt as a PDF for the share sheet

- **`GET /api/enrollments/:id/receipt.pdf`** — the receipt the website prints (`client/src/pages/students/EnrollmentReceipt.js`, data from `GET /api/enrollments/:id/receipt-data`), rendered through **`services/pdfRender`** as the person asking — the referrals / custom-report pattern (the print page stamps what it rendered; the server compares before answering).
- **The same scope as `receipt-data`** — whoever may read the receipt data may fetch the PDF, nobody else.
- **Answer:** `application/pdf`, `Content-Disposition: attachment; filename="ICSA receipt <EN-number> <13 Nov 2026>.pdf"` (dates in Yasir's style).
- The app downloads it with the Bearer token and opens the phone's share sheet (WhatsApp, email, Files). Nothing is stored on the server.
- **Check:** the route's scope equals `receipt-data`'s; the PDF names the enrolment asked for.

## 4. What to send back to the app chat

- The commit(s), and **"deployed"** with the migration applied to both databases.
- The **header name** as built (expected `Idempotency-Key`) and the **409 / 422 codes** as built.
- The PDF route as built.
- The app's checks read the AMS copy on the Mac (`~/Projects/icsa-system`) — **Yasir pulls it** (`git pull --ff-only`) once pushed.

## 5. For You (Yasir)

1. Give this file to the **AMS chat**.
2. When it is **deployed**, pull the Mac copy: **Run on Mac:** `cd ~/Projects/icsa-system && git pull --ff-only`.
3. Tell the app chat "S5 and S10 live".
