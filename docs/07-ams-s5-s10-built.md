# AMS → ICSA app: S5 and S10 are built

**From:** the AMS chat · **Date:** 13 Nov 2026 · **Answers:** `06-ams-handover-reception-money.md`

> **Yasir — give this to the app chat only after the server steps have all
> succeeded** (migration on both databases, client deployed, server restarted,
> checks `exit=0`, test receipt emailed). Then tell it: **"S5 and S10 live."**

- **Commit:** `cf6f4fa1` on `master`. On the Mac: `cd ~/Projects/icsa-system && git pull --ff-only`
- **Migration:** `migrations/2026-11-13-idempotency-keys.sql`, applied to **both** `icsa_db` and `icsa_subtest`

---

## S5 — one press, one write

### The header

- **`Idempotency-Key: <uuid v4>`** (any letter case). Only a **version 4** UUID is accepted.
- **Make a new key for each PRESS** of the button. **Every retry of that press sends the same key.**
- Keep the key until the press gets a final answer (any 2xx or 4xx). Then throw it away.
- **The key belongs to the signed-in user.** Two people can't collide.
- Kept **7 days**, then swept.
- **No header means nothing changes.** The website sends none.

### The eight routes that take it

| Route | What it does |
|---|---|
| `POST /api/students` | register |
| `POST /api/students/:studentId/charges` | charge + payment |
| `POST /api/enrollments` | enrol |
| `POST /api/enrollments/full` | enrol + plan + payment |
| `POST /api/payments/schedule` | instalment plan |
| `POST /api/payments` | record payment |
| `POST /api/refunds` | refund request |
| `POST /api/payment-proofs` | proof upload (multipart, field `proof`) |

On any other route the header is **ignored**.

### What the request is compared on

- **Method + path + body.** The path is compared without its query string or trailing slash.
- **The body is compared as canonical JSON**, so key order doesn't matter, but the values must be identical.
  - **Retry with the exact same body.** Don't re-read a form field that may have changed.
- **Proof upload:** the form fields **plus the file's sha256** are compared. Retry with the same bytes.

### Answers

| You get | Means | App should |
|---|---|---|
| The route's normal answer | First press, it ran | Carry on |
| **Same status and body again**, header **`Idempotency-Replayed: true`** | The press was already done; nothing ran a second time | Treat it as the original answer |
| **409 `IN_PROGRESS`** | Still running, **or** the server may have saved it and died | **Do not auto-retry and do not mint a new key.** Show the message and point the person at the student's record |
| **422 `IDEMPOTENCY_MISMATCH`** | Same key, different method, path or body | An app bug. Nothing ran |
| **400 `IDEMPOTENCY_KEY_INVALID`** | The header isn't a v4 UUID | An app bug. Nothing ran |
| **503 `IDEMPOTENCY_UNAVAILABLE`** | The AMS couldn't check the key. **Nothing ran** | Safe to retry with the **same key** |
| Any other **5xx** from the route | It failed and **nothing is remembered** | Safe to retry with the **same key**; it runs again |

- **Body shape for the four new answers:** `{ "code": "...", "error": "..." }`.
  - Read **`code`**. The AMS's other errors are `{ "error": "..." }` only.
- **The 409 message, word for word:** "This is already being saved, or may already have been. Check the student's record before trying again."
- **Yasir's ruling (13 Nov 2026):** an in-flight press is **never re-run, however old**. A person checks. If they then decide to try again, that is a **new press with a new key**.
- **2xx and 4xx are both stored and replayed.** A refusal (say a 400 validation error) is an answer.
  - So after a 4xx, **fix the input and send it as a new press with a new key**. The same key would replay the refusal.
- **Order:** auth runs first, so a signed-out request is a plain 401 and no key is touched.

### Approving a proof — not wrapped, and why that's safe

- **`POST /api/payment-proofs/:id/approve` takes no key.** It locks the proof, and a second approval answers **409** with `{ "error": "This proof has already been reviewed" }`. **It cannot pay twice.**
- **On the Reception approvals screen:** if a retried approve gets that 409, reload the proof. It will show approved. Treat the press as done, not as an error.

---

## S10 — the receipt as a PDF

- **`GET /api/enrollments/:id/receipt.pdf`**
  - **Who:** staff, with the same scope as `GET /api/enrollments/:id/receipt-data`. Students are refused, as they are for receipt-data.
- **200:** `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="ICSA receipt EN-021001 13 Nov 2026.pdf"`.
  - The date in the name is the day the PDF was made, in Kuwait.
- **It's the website's own receipt, rendered** by the same code as the emailed attachment.
  - **Allow up to ~45 s.** It renders in a headless browser on the server; usually it takes a few seconds.
- **404** `{ "error": "Enrollment not found" }`.
- **403** `{ "error": "..." }`: not in your scope. Nothing is rendered.
- **5xx:** the render failed. Nothing to retry differently; try once more, then report it.

---

## Tested, and not

- **S5:**
  - `idempotency.check.js`: 63 assertions against a real Express server over HTTP.
  - 20 planted defects caught.
  - Real PostgreSQL 16 drill, 16/16. **Five simultaneous presses of one key wrote ONE payment** (one 201, four 409s).
- **S10:** **not rendered end to end in the AMS chat** (no built website there). It reuses the emailed receipt's renderer, which Yasir's test email proves on the live server.
  - **Please fetch one receipt.pdf from the app as your first check.**
