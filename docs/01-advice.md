# Professional advice — the ICSA app

Written 3 Nov 2026. Platform facts were checked that day (sources at the end); re-check them at release, they move every year.

## 1. The short version

- **Build one app, "ICSA", with Expo (React Native) and TypeScript.** One codebase for iPhone, iPad, Android — and Mac through the iPad app.
- **The AMS stays the brain.** The app is a new front end over the 673 endpoints that already exist; most screens need **no server change**.
- **Reuse the AMS's own logic** (enrolment sequence, instalments, WhatsApp links, referrals ordering) instead of rewriting it.
- **Add a small, well-defined set of server features** a phone needs: device sessions, push, an app version gate, idempotent payments, deep-link files (`03-ams-server-changes.md`).
- **Ship in phases**, teachers and students first (daily use, proves push and location), then reception money flows, then marketers and managers.
- **Start the Apple and Google organization accounts now** — they are the slowest part.

## 2. Which technology

| | **Expo / React Native** (recommended) | Flutter | Native (Swift + Kotlin) |
|---|---|---|---|
| Language | **TypeScript/JavaScript — what the AMS is written in** | Dart (new language) | Two languages |
| Codebases | **One** | One | **Two** — every screen built twice |
| Reuse AMS code | **Yes** — the pure `client/src/lib` files, the API module pattern, TanStack Query, react-hook-form | No | No |
| Look and feel | Real native controls; very good | Own renderer; very good | Best |
| Push, location, camera, Face ID | First-party Expo modules | Plugins | Built in |
| Cloud builds without Xcode on the Mac | **Yes (EAS Build)** | Third-party | No |
| Fixes without a store release | **EAS Update** for JS-only fixes (rules apply) | No | No |
| Fit for one developer + Claude | **Best** | Good | Poor |

- **Current release:** Expo **SDK 58**, released **15 Oct 2026**, on **React Native 0.88**, built for **iOS 27**. Notable: `expo-router` data loaders now stable; foreground notifications show by default; iOS geofencing no longer needs the location background mode.
- **Libraries to start with** (all first-party or mainstream): `expo-router` (navigation), `@tanstack/react-query` (server state, same as the AMS), `react-hook-form` (forms, same as the AMS), `expo-secure-store` (Keychain/Keystore), `expo-local-authentication` (Face ID / fingerprint), `expo-notifications`, `expo-location`, `expo-camera` + `expo-image-manipulator` (Civil ID and proof photos, converted to JPEG), `expo-document-picker` (assignment files), `react-native-webview` (interactive lessons, the captcha), `expo-print` + `expo-sharing` (receipts), `expo-haptics`, Sentry (crash reports).

## 3. The Mac

- **Expo SDK 58 has no macOS target** — support "will return when `react-native-macos` is updated" (Expo's changelog).
- **So, for now:**
  - **The iPad app runs on Apple-silicon Macs** from the Mac App Store — nearly free once the iPad layout is good (sidebar + detail).
  - **The AMS web app** is already full-featured on a Mac — Safari's **File › Add to Dock** makes it a Dock app.
- **Later:** a true Mac build when `react-native-macos` supports the React Native version Expo ships.

## 4. One app, five experiences

- **One "ICSA" app**, one login (the AMS's), and the role decides what appears — the same rule the AMS sidebar uses, read from `/api/auth/me` (primary role + overlay roles).
- **Tab bars per role** (5 tabs max, iOS rule of thumb):
  - **Student:** Home · Learn · Attendance · Fees · Me
  - **Teacher:** Today · Classes · Assignments · Students · Me
  - **Reception / Supervisor:** Today · Students · **＋** (register / take payment) · Follow-ups · Me
  - **Marketer:** Leads · Follow-ups · **＋** (new lead) · Referrals · Me
  - **Manager:** Dashboard · Approvals · Students · Reports · Me
- **Several roles** (e.g. a supervisor with the marketer overlay): a role switcher at the top of **Me** — never mixed tabs.
- **Two apps instead?** Possible later from the same code (Expo "app variants") if ICSA wants a public Student app and a private Staff app. Start with one: one listing, one review, one push setup.

## 5. Architecture

- **API client:** one module per domain (`api/students.ts`, `api/payments.ts` …), the same split as the AMS's `client/src/api/*`. Base URL `https://app.icsasystem.com/api`, `Authorization: Bearer`, and two extra headers on every request: `X-App-Version` and `X-App-Platform`.
- **Server state:** TanStack Query, with the cache persisted to disk for read-only screens (lists open instantly, then refresh).
- **Shared AMS logic:** `scripts/sync-ams-lib.js` copies the **pure** AMS libs the app needs into `src/ams-lib/`, stamped with the AMS commit and an md5 per file; a check fails when the copy and the AMS differ. Pure today: `installments`, `referrals`, `waLink`, `phonePrefix`, `leadExpiry`, `lastAction`, `paymentMethods`, `receiptLayout`, `subjectIndex`, `progressDisplay`… `enrollmentFlow` imports `../api/enrollments` and `../api/payments` — the app provides modules at those names so the **AMS's own money sequence** runs unchanged.
- **No business rule only on the phone.** A phone can run a months-old version; the AMS already learned that lesson with stale web bundles. The **app version gate** (`GET /api/mobile/config` → minimum version) lets the server refuse an app too old to be safe.
- **Navigation:** file-based routes (`expo-router`) that mirror AMS paths where they can (`/students/[id]`), so a notification's existing `link` (an AMS path) opens the matching screen.
- **Quality gate:** the AMS's discipline carries over — `npm run checks` runs every `*.check.ts`, each check self-tests, a negative assertion asserts its extraction first, mutations prove a check bites. TypeScript `strict`.

## 6. Login and sessions

- **The AMS login requires a Cloudflare Turnstile token** (both `/api/auth/login` and `/api/auth/student-login`). Turnstile does not run natively in apps; **Cloudflare's documented route is the widget inside a WebView**. Plan: a tiny captcha page served from `app.icsasystem.com`, opened in an invisible/compact WebView, posting the token back to the native login form. Later, replace it with **App Attest (iOS) / Play Integrity (Android)**.
- **Today's tokens live ~12 minutes** (the Settings idle timeout, 10 minutes by default, + 2 minutes grace) and are renewed on activity. Right for a shared reception PC; wrong for a personal phone.
- **Recommended for the app:** a **device session** — after login the server issues a long-lived, revocable **refresh token bound to this device**; the app keeps it in the Keychain/Keystore and gets short access tokens with it. The phone is **locked with Face ID / fingerprint** after the idle time instead of being signed out. A manager can **sign out a lost phone** from the user's page. (Server work: `03-ams-server-changes.md` S2.)
- **Google sign-in:** the AMS has it (`/api/auth/google`). If the app offers it on the login screen, Apple's guideline 4.8 may require **Sign in with Apple** too (exceptions exist for an app's own account system and for education/enterprise accounts). **Yasir ruled, 3 Nov 2026: Google sign-in is in v1, so Sign in with Apple is in v1 too** (server work S12).

## 7. Push notifications

- **The AMS already has an inbox:** a `notifications` table (recipient, type, title, body, link) written through **one helper**, `server/src/utils/notify.js` (`createNotification` / `notifyUsers` / `notifyBranchManagers`), with an `/api/notifications` API. **Push = that row, delivered to the phone.** One hook in `createNotification` sends it — every existing and future notification gets push for free.
- **Delivery:** the **Expo Push Service** (it fronts Apple APNs and Google FCM, free) — or APNs + FCM directly later. Tokens are registered per device and pruned when the service reports them invalid.
- **Lock-screen privacy:** the push text says **what happened**, not who or how much ("A payment proof is waiting for approval"); the detail opens inside the app after Face ID. A setting can relax this.
- **Students cannot read `/api/notifications` today** — it is not in the student firewall's allowlist. Add it with the push work.
- **Good first notifications** (new events marked ★):
  - **Students:** ★ class starts in 30 minutes · ★ your check-in was confirmed · assignment reviewed · ★ fee instalment due in 3 days · certificate ready.
  - **Teachers:** ★ a student checked in under you (confirm) · ★ new assignment submission · follow-up due.
  - **Reception / Supervisors:** payment proof submitted by a student · refund approved/declined · follow-up due.
  - **Marketers:** a lead was routed to you · follow-up due · referral approved/paid.
  - **Managers:** approvals waiting (refunds, discounts, certificates, transfers).
- **Ask permission at the right moment** (when the user first turns on a reminder, with a sentence saying why), not on the first launch.

## 8. Location services

- **Check-in is already geofenced on the server:** `POST /api/attendance/check-in` takes the phone's coordinates and accuracy; the server measures the distance to each branch (`branches.latitude/longitude/gps_radius_m`, falling back to the `attendance_gps_radius_m` setting), caps how much a claimed accuracy may widen the radius, and records `check_in_lat/lng` and `check_in_distance_m`. Batch students only inside the session window; individual students any day.
- **The app adds:** a precise, fresh fix (high accuracy, < 30 s old), a clear map card ("You are 42 m from ICSA City — inside"), and the **mock-location flag** Android reports, sent with the check-in so the server can flag it.
- **Permission:** "**While using the app**" first — that is all check-in needs. "**Always**" is asked only when a student turns on arrival reminders, with a sentence saying why.
- **Arrival reminders — in v1 (Yasir ruled, 3 Nov 2026):** "You've arrived at ICSA Mahboula — tap to check in", by the OS geofence around each branch (`expo-location` geofencing + `expo-task-manager`). Students only; shown only on a day they have a class; nothing leaves the phone until they tap. Needs a review justification and Play's background-location declaration with a video. **Never an automatic check-in** — the student taps.
- **No staff tracking.** Location is used for the student's own check-in, nothing else.

## 9. Money, safely

- **Online only** for payments, enrolments, registrations, refunds and approvals. If the connection drops, the screen says so and keeps the form — it does not queue.
- **Idempotency keys:** the app sends a fresh `Idempotency-Key` with each money/creation POST and reuses it on retry; the server returns the first result instead of recording twice. Phones on a weak signal retry constantly — without this, double payments are a matter of time. (Server work S5.)
- **The AMS's sequence, untouched:** enrolment → instalment plan → upfront payment through `enrollmentFlow` (outcome objects, nothing silently lost). The four "regressions that must never come back" in the AMS CLAUDE.md apply to the app too (typed amount kept, teacher guard, chips without a time saved, every failure shown).
- **Proof photos:** camera → JPEG (iPhones shoot HEIC) → `/api/uploads/payment-proof` → `proof_url`, exactly as the web form does; methods that require proof refuse without it (server rule).
- **Receipts:** share as PDF or WhatsApp straight from the payment screen.
- **Face ID before recording a payment** — optional setting, cheap to add, staff like it.

## 10. Offline

- **Readable offline:** today's classes, the student list already loaded, a student's profile last opened, follow-up worklist, lessons already opened.
- **Queued offline (safe to replay):** a follow-up note, marking a lead as contacted — each with an idempotency key.
- **Never offline:** anything in §9.

## 11. Security and privacy

- **Tokens and refresh tokens:** Keychain / Android Keystore via `expo-secure-store`; wiped on sign-out.
- **Civil ID images:** shown, never cached to the photo library; cleared from the app cache on sign-out; on Android the ID screens set `FLAG_SECURE` (no screenshots); on iOS the app blurs in the app switcher.
- **Transport:** HTTPS through Cloudflare. **No certificate pinning** — Cloudflare rotates certificates and a pinned app breaks overnight.
- **Cloudflare bot settings must not challenge `/api/*` from the app** — a native client cannot solve a JavaScript challenge, and the failure looks like "the app is down". Check WAF/Bot Fight Mode before the first TestFlight.
- **Privacy forms:** Apple's privacy "nutrition label" + the app's privacy manifest (required-reason APIs), Google Play's Data safety form, privacy policy at `icsa.us/privacy`.
- **Lost phone:** device list per user, manager can revoke (S2).

## 12. Design

- **ICSA brand:** blue `#0D47A1`, green `#16A34A`, accent yellow `#FFC107`, white; **Nunito**. A calm, light base with blue for action, green for success/present, yellow for attention, red only for real problems.
- **Native feel:** iOS large titles, tab bar, swipe-back and sheets; Android Material 3 navigation bar and back gesture. Same brand, platform-right controls.
- **Dark mode** and **Dynamic Type** from the start; 44 pt minimum touch targets.
- **RTL-ready from day one** (logical start/end, never left/right) — Arabic later is then a translation job, not a redesign.
- **Formats:** dates "3 Nov 2026", money "KD 120.000", phone numbers with the country prefix the AMS already resolves.
- **Every list has an empty state that says what to do next**, every error names what happened.
- **iPad (and so Mac):** sidebar + list + detail, keyboard shortcuts for reception (⌘K search, ⌘N new student).

## 13. App Store and Google Play (2026 rules)

- **Apple:** apps uploaded since **28 Apr 2026** must be built with **Xcode 26 or later** and an iOS 26 SDK (EAS Build handles this). Answer the **new age-rating questions** in App Store Connect.
- **Google:** since **31 Aug 2026**, new apps and updates must **target Android 16 (API level 36)**.
- **Accounts:** register both as an **organization** (needs a **D-U-N-S number**). Play **personal** accounts created after 13 Nov 2023 must run a **closed test with 12 testers for 14 days** before publishing.
- **Payments rules:** paying for **in-person classes** happens outside the app and needs no in-app purchase. **Selling online courses or recorded content inside the app** would need Apple/Google in-app purchase. v1 sells nothing in-app: students see their fees, upload a transfer proof (the AMS already supports it), or pay at reception.
- **Review:** Apple and Google log in with demo accounts — on production, because there is no staging. Prepare a **Demo branch** with made-up students for a teacher, a reception and a student login.
- **Encryption export:** standard HTTPS only → declare exempt (`ITSAppUsesNonExemptEncryption = false`).
- Full list: `04-store-checklist.md`.

## 14. Costs (no prices quoted — check at sign-up)

- **Apple Developer Program:** yearly fee. **Google Play:** one-time registration fee. **D-U-N-S:** free.
- **Expo EAS:** a free tier covers a small team's builds; a paid plan adds faster/more builds — optional, local builds on the Mac are free.
- **Push:** Expo Push, APNs and FCM are free. **Sentry:** free tier is enough to start.

## 15. Risks to manage

| Risk | Mitigation |
|---|---|
| Old app versions keep running for months | Server owns every rule; minimum-version gate; additive, backward-compatible API changes |
| Double payments on weak signal | Idempotency keys (S5); online-only money |
| Login captcha blocks the app | Turnstile in a WebView; later App Attest / Play Integrity |
| Cloudflare challenges the app | Exempt `/api/*` app traffic from JS challenges; test on mobile data |
| App Review on production data | Demo branch with fake data; reviewer notes |
| Spoofed GPS | Server-side geofence (exists) + mock flag + review of `pending_review` |
| Lost phone with a logged-in reception account | Device sessions, biometric lock, remote sign-out |
| `deploy-client.sh` wipes `server/public` | Deep-link files live in `client/public/.well-known/` so every build ships them |

## Sources (checked 3 Nov 2026)

- [Expo SDK 58 changelog](https://expo.dev/changelog/sdk-58) — release date, React Native 0.88, macOS status, notifications and geofencing notes
- [Apple — upcoming requirements](https://developer.apple.com/news/upcoming-requirements/) — Xcode 26 / iOS 26 SDK since 28 Apr 2026, age ratings
- [Android — target API level requirements](https://developer.android.com/google/play/requirements/target-sdk) — API 36 from 31 Aug 2026
- [Google Play — testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB) — 12 testers, 14 days
- [Cloudflare — Turnstile mobile implementation](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation) — WebView approach and its requirements
- Apple guideline 4.8 and 3.1 summaries: [ptkd.com](https://ptkd.com/journal/app-store-rejection-4-8-sign-in-with-apple), [webtoapp.design](https://webtoapp.design/blog/payments-other-than-in-app-purchase) — **read Apple's own App Review Guidelines before submitting**; these are secondary summaries.
