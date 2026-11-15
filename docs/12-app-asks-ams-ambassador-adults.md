# For the AMS chat — the Ambassador for students 18 and over only (from the ICSA app chat, 15 Nov 2026)

**The app chat does not edit the AMS: this note is the hand-off.** Read at AMS `06702735`.

## What Yasir decided (15 Nov 2026)

- The **Student Ambassador** (a student gives a friend a voucher: the friend's name and WhatsApp number, with a reward) is for **students aged 18 and over**.
- **A student with no date of birth on file is not offered it** until the front desk adds one.
- **Enforced by the AMS** — not only hidden in the app.
- **Why:** the app's Google Play target audience includes children (6+), so Google's **Families policy** applies; the Ambassador asks for **another person's** contact details, with a reward. ICSA certified COPPA/GDPR compliance on 11 Nov 2026.

## The change (server — and the website's two places)

1. **One rule, in one place** (e.g. `services/couponRules.js`): `studentIsAdult(dateOfBirth, kuwaitToday)` — 18 or over on Kuwait's date; **null or unreadable → not adult**; a 29 Feb birthday comes of age on 1 Mar (compare `YYYY+18-MM-DD <= today` as text, as the app does).
2. **`rewardsController`** — for `role === 'student'`, in **`getMine`** and **`issueCode`** (and the old `createMyVoucher` / `getMyAmbassador` the `either()` falls back to): read `students.date_of_birth` for `myStudentId(req)`; if not adult answer
   - **403** `{ error: 'The Ambassador programme is for students aged 18 and over.', code: 'AMBASSADOR_ADULTS_ONLY' }`
   - **Keep the code exactly `AMBASSADOR_ADULTS_ONLY`** — the app reads it (`src/student/ambassador.ts`), and its check asserts the AMS uses the same code and 18 once it appears.
3. **Website:** `StudentHome.js` shows the Ambassador card only to an adult (its own profile or `/ambassador/me`'s answer); `StudentAmbassador.js` shows the 403's words instead of the page.
4. **Already-issued codes from under-18 students:** Yasir's call (leave them, or void them with a reason). The rule above stops new ones.
5. **A check** (`__checks__`): the rule on the birthday, the day before, 29 Feb, null; both endpoints refuse with the code.

## What the app does meanwhile (built 15 Nov 2026)

- Reads `GET /auth/student/profile` → `profile.date_of_birth`; shows Home's Ambassador card and opens the screen **only for an adult**; for anyone else it does not even ask `/ambassador/me`.
- Honours the AMS's 403 `AMBASSADOR_ADULTS_ONLY` as soon as it exists.

## Tell the app chat when done

- The AMS commit id and that it is deployed; Yasir pulls `~/Projects/icsa-system` on the Mac. The app's check (`src/student/ambassador.check.ts` §7) then holds the AMS's code and age to the app's.
