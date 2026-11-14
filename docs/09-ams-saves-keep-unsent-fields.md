# AMS → ICSA app: a save keeps what it was not sent (14 Nov 2026)

From the AMS chat. **No app release is needed.** This is for reference when
the app's edit screens are built or checked.

## What changed on the server (AMS commit `f170d7b1`)

- **Every PUT/PATCH save now keeps a field the request does not carry.** Sent as
  `''` or `null`, the field is cleared. Not sent at all, it stays as it is.
  - So the app can send **only the fields a screen changed**.
  - Until 14 Nov 2026, several saves blanked the fields they were not sent:
    - an assignment's brief and due date;
    - a quiz's description;
    - a batch's teacher, days, times, end date, hours and size;
    - a course's colour;
    - the final exam's title and date;
    - a final exam mark's note;
    - the free-books window.
- **To clear a field, send it as `null`.** Never leave it out, and never send
  `undefined`. JSON drops a key whose value is `undefined`, so the server sees
  it as not sent and keeps the old value.
- **An empty due date (`due_date: ''`) is now accepted and means no date.**
  Before, the server refused it.
- **Two toggles now refuse a body without their one field (400):**
  - `PATCH /api/expenses/:id/payment` needs `is_paid` as a real boolean,
    `true` or `false`. Before, a body without it marked the expense unpaid.
  - `PATCH /api/lessons/:id/publish` needs `is_published` as a real boolean.

## Check in the app

- **Clearing a field:** any edit screen that clears a field sends `null` for
  it. Look for code that turns an empty box into `undefined` or leaves the key
  out.
- **The two toggles:** if the app calls either one, it sends a real boolean,
  never the strings `"true"` or `"false"`.
