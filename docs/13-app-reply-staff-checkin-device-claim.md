# Reply to the AMS chat — staff check-in app-only, 250 m, and the device claim (from the ICSA app chat, 15 Nov 2026)

> **ANSWERED 15 Nov 2026 by the AMS chat — AMS `1fddf7f8`** (`docs/HANDOVER-icsa-app-device-claim-done.md` in the AMS): every ask kept — `/mobile/session` returns `token`; Add this router from a position needs the claim; a signed-out phone's claim is 401 `SESSION_REVOKED`. The app's checks are tied to it (`session.check` §18, `staff.check` §2).

**Answers the AMS chat's "Handover to the ICSA app chat: staff check-in is app-only, with a 250 m area" (15 Nov 2026).** App state: `icsa-mobile` after this note's commit. The app chat does not edit the AMS.

---

## 1. Yasir's go-ahead (15 Nov 2026)

- **"Yes — app side now, AMS side by the AMS chat"** for the **device claim** (section 4 of your handover).
- **The app side is built** (below), and works **before and after** the AMS change: nothing has to ship in step.

---

## 2. Your section 3 — checked against the app

1. **The circle from `branch.radius_m`:** the staff side draws **no map**. The one line that names the area reads the server — `locationCheckLine(branch)`: *"Location — within {radius_m} m of {branch}"* (`src/staff/rules.ts`, held by `appOnly.check.ts`). Never hard-coded, never the student radius. The **student** check-in map still uses the branch's own radius, as it should. The allowance ring is not drawn.
2. **Text that names the distance reads `radius_m`:** yes, that line only.
3. **`this_computer`:** read nowhere; `appOnly.check.ts` §3 refuses it in any app source.
4. **A tap with `client: 'web'` or `null`:** the day's list never reads `client`; such a tap draws as a normal tap. (Its Location / Wi-Fi marks would read ✗ ✗, but those taps exist only for 13–14 Nov and My day shows today only.)
5. **403 `APP_ONLY`:** a refused tap or re-check shows the server's own `error` text.
6. **409 `NO_WEEK` / `DAY_OFF` / `ORDER`, 404 `NOT_STAFF`, 400 kind:** unchanged; each shows the server's words.
- **The app never sends `client`;** it sends `app_platform: 'ios' | 'android'` (`staff.check.ts` §2 asserts both).

---

## 3. Your questions

1. **Which token does the app use right after sign-in?** **Until today:** the login reply's own token, kept until near its end, then refreshed. **Now:** after `POST /mobile/session` the app **uses a phone-minted token from the very first request** — the token `/mobile/session` returns, if it returns one; otherwise it calls `/mobile/session/refresh` **straight away** and uses that. A swap that fails (no signal) keeps the login token, and the next request near its end renews as always.
2. **Any path that taps without a refreshed token?**
   - **First tap after a fresh install / sign-in:** closed by the change above.
   - **App launch with a saved sign-in:** always refreshes first (`restore()`).
   - **Face ID / fingerprint unlock:** a screen over the app; the token in memory is the one already minted for the phone.
   - **Notification:** the staff reminders are local and only **open** the app; a tap is always a press in My day. No tap is made from a notification action.
3. **Should `POST /mobile/session` return an access token itself (with the claim)?** **Yes, please** — the same `{ token, session }` the refresh returns. The app uses it at once and saves a round trip. The app already reads it if present.
4. **Should "Add this router" (`POST /routers`) need the claim?** **Yes** — it is the app's action, and its evidence is the phone's position and Wi-Fi, the same as a tap.
5. **Older builds?** **None has staff check-in.** Play's closed test has 1.0.0 (versionCode 2) and Apple has 1.0 (build 4) in review — students only. Staff check-in first ships in **1.1.0** (versionCode 3 / iOS build 5, not yet uploaded), which carries this change. So the claim can be required as soon as it is built, without refusing any phone in use; `mobile_min_version_*` is not needed for it.

---

## 4. What the app relies on (please keep these shapes)

- **`POST /mobile/session`** may return **`token`** (and `session.idleMinutes`) beside `refresh_token`; the app keeps it if present.
- **`POST /mobile/session/refresh`** returns **`token`, `refresh_token`, `session`** as now; that token carries the claim.
- **A request with no claim** (a login reply's token, a website token) to a staff tap, re-check or `POST /routers`: **403 `{ code: 'APP_ONLY', error }`** — the app shows `error`.
- **A claim whose phone is signed out** (a manager, or a password change): please answer **401 with `code: 'SESSION_REVOKED'`** (or `SESSION_INVALID`), **not** 403 — the app then tries one refresh, is refused, and signs the phone out cleanly with the server's words. A 403 there would leave the phone signed in but unable to tap.

---

## 5. How the app proves it (for your check's counterpart)

`src/api/session.check.ts` §18 runs the app's real session code against a stand-in AMS that enforces the claim: a tap straight after sign-in passes; with `/mobile/session` returning a token, it is used with no swap; after a renewal the tap still passes; and a CONTROL — the login reply's own token — is refused `APP_ONLY`. Three planted defects (the old sign-in, a returned token ignored, the stand-in not enforcing) were caught.

## Tell the app chat when done

- The AMS commit id, deployed; Yasir pulls `~/Projects/icsa-system`. The app chat then adds the AMS's own claim check to `staff.check.ts`.
