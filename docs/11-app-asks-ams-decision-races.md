# For the AMS chat — two decisions that can be made twice (from the ICSA app chat, 15 Nov 2026)

**Found while building the app's manager Approvals; not fixed — the app chat does not edit the AMS.** Read at AMS `06702735`. Neither moves money twice; one can **take a second copy of a book out of stock**.

## 1. Free book: Reject can undo an Approve that already took the book out of stock — fix first

`server/src/controllers/enrollmentBooksController.js`

- **`approveFree`** is right: `BEGIN` → `SELECT … FOR UPDATE OF r` → status check → stock out → `status='released_free'` → `COMMIT`.
- **`rejectFree`** is not:
  - reads with a plain `SELECT * FROM enrollment_book_releases WHERE id=$1 AND enrollment_id=$2` — **no `FOR UPDATE`**;
  - checks `rel.status !== 'approval_pending'` on that read;
  - writes `UPDATE … SET status='pending', reject_reason=… WHERE id=$3` — **no status in the `WHERE`**.
- **The race:** manager A presses Approve, manager B presses Reject at the same moment.
  - B's plain read is not blocked by A's lock, so it sees `approval_pending`.
  - B's `UPDATE` waits for A's lock, then runs after A commits.
  - **Result:** the copy has left stock (A's movement stands), but the request says `pending` again — so it can be requested and **released a second time**, taking **a second copy** out.
- **Fix:** in `rejectFree`, `SELECT … FOR UPDATE` (as `approveFree` does) **and** `WHERE id=$3 AND status='approval_pending'`, checking `rowCount` (0 → 409 `Not awaiting approval`, the words the app already reads).
- **Also:** both `approveFree` and `rejectFree` call `logAudit(req, {…})` **without the transaction's client**, so the audit row is written on another connection — it stands even if the `COMMIT` then fails. Pass `client` (as `paymentTransfersController` does).

## 2. Refunds: Approve and Reject check, then write, with no lock (noted 14 Nov 2026)

`server/src/controllers/refundsController.js` — `approveRefund` and `rejectRefund`:

- `SELECT * FROM refunds WHERE id = $1` (no lock) → `status !== 'initiated'` check → `UPDATE refunds … WHERE id = $3` (**no status in the `WHERE`**) → `logAudit` after, outside any transaction.
- **Two approves at once:** both pass the check. Approving moves no money (the money moves at `/complete`, with the proof), so **nothing is paid twice** — but the record and the audit say two approvals.
- **An approve and a reject at once:** the last write wins — a refund can end `rejected` after it was approved, or the reverse.
- **Fix (money tier):** one transaction; `SELECT … FOR UPDATE`; `UPDATE … WHERE id = $3 AND status = 'initiated'`; the audit on the client before `COMMIT`. Keep the refusal words — the app reads `Cannot approve: refund is in status '…'` / `Cannot reject: …` as "already decided".

## What the app does meanwhile

- Every decision the app sends is one press; a second press, or another manager first, is shown in the AMS's own words ("This refund is already approved.", "This free book is already decided.") — never as this press's success.
- The app's check (`src/manager/approvals.check.ts`) reads these controllers. **Keep the refusal words as they are**, or tell the app chat.

## Tell the app chat when done

- The AMS commit id and that it is deployed; Yasir pulls `~/Projects/icsa-system` on the Mac. The app chat re-runs its checks and adds the lock to what they assert.
