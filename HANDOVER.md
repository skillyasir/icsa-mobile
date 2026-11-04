# HANDOVER — the ICSA mobile app (iPhone, iPad, Mac, Android)

**Written 3 Nov 2026** in the AMS chat, to start a new chat that builds the app.
**Start here.** Read this file, then `CLAUDE.md` (how Yasir works and the rules), then the docs it points to.

---

## 1. What we are building

- **One rich app for ICSA** on **iPhone, iPad, Android, and Mac**, on top of the **existing AMS** at `app.icsasystem.com`.
- **The app is a new front end.** The AMS server is the single source of truth and the only place rules live. The app adds nothing to money, grades or permissions that the server does not already decide.
- **Who uses it** (Yasir: "for staff (can register students, accept payments, followups, all full functions for teachers, marketers, and Students)"):
  - **Reception / Supervisors** — find a student, register a new one (scan the Civil ID), enrol, set the instalment plan, take a payment with a photo of the proof, share the receipt, follow-ups, approvals.
  - **Teachers** — today's classes, mark and confirm attendance, check assignments, class progress, their students, follow-ups.
  - **Marketers** — their leads, follow-ups, call and WhatsApp in one tap, trackable links, referrals, coupons, targets.
  - **Managers** — dashboard, approvals (refunds, discounts, certificates, transfers, payment proofs), reports.
  - **Students** — geofenced check-in, lessons, quizzes, assignments, progress and grades, fees and payment proof upload, certificates, notifications.
- **Must have:** **push notifications** and **location services** (geofenced check-in), with a **beautiful, professional** design.

## 2. What is already done (this folder)

| File | What it is |
|---|---|
| `CLAUDE.md` | Yasir's working style, the two machines, the rules. Loaded automatically by Claude Code in this folder. |
| `docs/01-advice.md` | **The professional advice**: stack, Mac strategy, architecture, login, push, location, money safety, security, design, store rules, phases. |
| `docs/02-features-by-role.md` | Every screen per role, mapped to the AMS endpoint that already serves it — or marked as needing server work. |
| `docs/03-ams-server-changes.md` | What the AMS server must add for a phone app (device sessions, push, app version gate, idempotent payments, deep-link files…), each with the AMS rule it must follow. |
| `docs/04-store-checklist.md` | Apple and Google accounts, review, privacy forms, the 2026 build requirements. |
| `docs/api-inventory.md` | All **673** AMS endpoints with their roles and whether a student can reach them. Generated — rerun `node scripts/api-inventory.js ../icsa-system`. |
| `mockups/` | 18 mockups for review (17 phone, 1 iPad/Mac), as PNGs with their sources. Live canvas: https://claude.ai/artifact/5dK3h1GMhAPftPMA6uPw79 — list and notes in `mockups/README.md`. **Not approved yet.** |

**No app code exists yet.** Nothing on the AMS server has been changed for the app.

## 3. Decisions to confirm FIRST (ask Yasir with the options UI, recommendation flagged)

Ask one at a time. Record each answer in this file with the date ("Yasir ruled, 4 Nov 2026: …").

**All 8 ruled on 3 Nov 2026** — the ✅ lines below are the decisions; the options above them are kept for the record.

1. **Stack** — **Expo (React Native) + TypeScript (Recommended)** · Flutter · fully native (Swift + Kotlin). Reasons in `docs/01-advice.md` §2.
   - ✅ **Yasir ruled, 3 Nov 2026: Expo (React Native) + TypeScript.**
2. **One app or two** — **one "ICSA" app, the screen set follows the role (Recommended)** · a Student app and a separate Staff app from the same code.
   - ✅ **Yasir ruled, 3 Nov 2026: one "ICSA" app; the screen set follows the role.**
3. **Mac** — **the iPad app runs on Apple-silicon Macs, plus the AMS web app "Add to Dock" (Recommended)** · wait for native Mac support. Expo SDK 58 (15 Oct 2026) has **no macOS target** yet.
   - ✅ **Yasir ruled, 3 Nov 2026: the app is for iPhone + iPad and Android only. The Mac uses the AMS web app, which it already has.** Consequence: Apple lists iPhone/iPad apps on Apple-silicon Macs **by default** — at release, untick Mac availability in App Store Connect (Pricing and Availability).
4. **Build order** — **Foundation → Teachers + Students → Reception/Supervisors → Marketers → Managers (Recommended)** · Reception first.
   - ✅ **Yasir ruled, 3 Nov 2026: Foundation → Teachers + Students → Reception/Supervisors → Marketers → Managers.**
5. **Sharing AMS logic** — **a verified copy of the AMS's pure `client/src/lib` files, checked against the AMS on every run (Recommended)** · move the app into the AMS repo as a monorepo.
   - ✅ **Yasir ruled, 3 Nov 2026: a verified copy in this separate repo, stamped with the AMS commit and checked against the AMS on every run.**
6. **Google sign-in in v1** — **leave it out of v1 (Recommended — avoids the Sign in with Apple rule)** · include it and add Sign in with Apple.
   - ✅ **Yasir ruled, 3 Nov 2026: include Google sign-in in v1** — so **Sign in with Apple goes in v1 too** (Apple guideline 4.8). Server work is **S12** in `docs/03-ams-server-changes.md`.
7. **Background location (arrival reminders)** — **not in v1; check-in uses location only while the app is open (Recommended)** · build geofence reminders now.
   - ✅ **Yasir ruled, 3 Nov 2026: build arrival reminders in v1.** Limits that keep it safe and reviewable: **students only** (never staff); the phone's own OS geofence around each branch, **nothing sent to the server** until the student taps Check in; the reminder shows only when the student has a class that day; **never an automatic check-in**. Needs "Always" location (asked only after "While using", with a sentence saying why), an App Review justification, and Google Play's background-location declaration with a video.
8. **App identity** — name **"ICSA"**, bundle/package id suggestion **`us.icsa.app`**. Confirm both before anything is registered — they are hard to change later.
   - ✅ **Yasir ruled, 3 Nov 2026: name "ICSA", bundle/package id `us.icsa.app`** (permanent once registered). Note: App Store names are unique across the store — if "ICSA" is taken, the **store listing** needs a longer name (e.g. "ICSA Kuwait") while the **home-screen name** stays "ICSA".

## 4. The plan (phases)

Rough sizes for one developer working with Claude; they move with the decisions above.

| Phase | What | Rough size |
|---|---|---|
| **0. Accounts** (Yasir, can start today) | D-U-N-S number for the company; Apple Developer Program **organization**; Google Play **organization** account; GitHub repo `skillyasir/icsa-mobile`. | Apple/D-U-N-S can take 1–3 weeks — start first |
|  | ✅ **3 Nov 2026 (Yasir): both developer accounts already exist and are approved** — Apple **Individual**, Google Play **Personal** (opened after 13 Nov 2023). So: the store shows **Yasir's name**, not ICSA, as the seller/developer; and Google requires a **closed test with 12 testers for 14 days** before production — start it as soon as Phase 2 has something staff can use. D-U-N-S is needed only if the accounts move to an organization later. |
| **1. Foundation** | Expo app, design system (ICSA tokens, Nunito, light/dark, RTL-ready), navigation by role, login (+ captcha in a WebView; Google and Sign in with Apple), secure token storage, Face ID / fingerprint lock, API client, error/offline banners, app version gate. **Server:** device sessions, app config, Google/Apple sign-in (S12). | 2–3 weeks |
| **2. Teachers + Students** | Student home, geofenced check-in/out, attendance history, notifications inbox, lessons/quizzes/assignments (interactive pages in a WebView), progress, fees + payment proof. Teacher today, confirm check-ins, session marking, check assignments, my classes. **Server:** push devices + sender, student allowlist lines. | 3–4 weeks |
| **3. Reception / Supervisors** | Search, student profile, register + Civil ID scan, enrol + instalments (the AMS's own `enrollmentFlow`), record payment + proof photo, receipt share/WhatsApp, follow-ups worklist and logging, payment-proof approvals. **Server:** idempotency keys, receipt PDF. | 3–4 weeks |
| **4. Marketers + Managers** | Leads, lead detail with call/WhatsApp, follow-ups, links share, referrals, coupons, targets; manager dashboard and approvals. | 2–3 weeks |
| **5. Polish + release** | iPad layouts (and so Mac), widgets (today's classes), accessibility, Arabic, TestFlight + Play internal testing with staff, store listings, review. | 2 weeks + review time |
| **6. CAP College** (Yasir ruled, 4 Nov 2026: the last phase) | Screens for the **CAP coordinator** — the CAP students, enrolments, charges and refunds stack (`/api/cap/*`). Until then a CAP coordinator is sent to the AMS on the web. | after release |

## 5. The first session — do these in order

0. **Make the folder a git repo** if `git status` says it is not one: `git init -b main`, then add the files **by explicit path** and commit ("Handover: plan, advice, mockups (3 Nov 2026)"). The handover was copied here on 3 Nov 2026 without a repo, because the shell that copied it cannot delete git's lock files.
1. **Read** `CLAUDE.md`, `docs/01-advice.md`, `docs/02-features-by-role.md`, `docs/03-ams-server-changes.md`.
2. **Ask the decisions in §3**, one at a time.
3. **Check the Mac** — ask Yasir to run and paste:
   - **Run on Mac:** `xcode-select -p && xcodebuild -version` (Xcode 26 or later is needed to build for the App Store since 28 Apr 2026)
   - **Run on Mac:** `node -v && npm -v` (Node 22 LTS)
   - **Run on Mac:** `cd ~/Projects/icsa-system && git pull --ff-only && git --no-pager log --oneline -1` (the Mac copy was at `6479ae5` on 3 Nov 2026, well behind GitHub)
   - ✅ **Checked 3 Nov 2026:** macOS **26.6.2** (Apple silicon), **148 GB** free, **Xcode 27.2** (27B52) installed and selected, **Node 24.19.0** / npm 11.17.0, AMS Mac copy pulled to **`43b55d0`** (same as GitHub). Xcode 27.2 is newer than the 27.1 that Expo's SDK 58 build image uses — the first Simulator build confirms it.
4. **Mockup review** — show `mockups/`, collect changes, get approval before building screens (his rule: audit → mockups → build).
   - ✅ **Yasir approved all 18 on 3 Nov 2026**, with the 4 fixes his rulings required (applied on the canvas that day — see `mockups/README.md`).
5. **Scaffold Phase 1** in this folder (`npx create-expo-app@latest` with TypeScript), commit by explicit path, and give Yasir the Simulator/phone run steps as **Run on Mac**.
   - ✅ **Scaffolded 3 Nov 2026** — `create-expo-app` 5.0.0, template `default`: **Expo 58.0.22, React Native 0.88.1, React 19.3, TypeScript 6.0 (strict), Expo Router**. `app.json`: name **ICSA**, `us.icsa.app` on both platforms, iPad supported, encryption-exempt, ICSA blue splash. Still the **Expo demo screens** (Home/Explore) — Phase 1 replaces them.
   - **Tested** (in a copy byte-identical to this folder, md5 over all 49 files): `npm install` OK (562 packages); `expo config` resolves ICSA / us.icsa.app / SDK 58.0.0; `expo-doctor` 18/20 — the 2 misses needed Expo's servers, which that sandbox cannot reach; `tsc` shows **1 error, in Expo's own web-only demo file** `src/components/app-tabs.web.tsx` (we do not ship web; Phase 1 deletes it). **Simulator build ✅ 3 Nov 2026** (Yasir's Mac, Xcode 27.2): `npx expo run:ios` — CocoaPods 1.17.0 installed via Homebrew (the gem route failed), iOS Simulator runtime downloaded with `xcodebuild -downloadPlatform iOS`, **Build Succeeded, 0 errors, 1 warning** (Expo's own `CoreModule` access-level notice), installed and opened on **iPhone 18 Pro**, JS bundle loaded (1687 modules). So Xcode 27.2 works with SDK 58.

### Phase 1 progress

- **Piece 1 — the app shell ✅ built 4 Nov 2026.** Expo's demo screens are gone. In their place:
  - **Theme** (`src/theme/`): ICSA colours, Nunito (4 weights), light and dark, every text colour ≥ 4.5:1 (held by `tokens.check.ts`).
  - **Sign-in screen** (`src/app/sign-in.tsx`) per mockup 16 — **design only**: Sign in, Apple and Google say "not connected yet" rather than pretend. Apple shows on iPhone only. "Forgot password?" opens the AMS web page.
  - **Five tab sets** (`src/app/<student|teacher|reception|marketer|manager>/`) with placeholder screens saying what comes and in which phase; **Me** shows the person, a view switcher for mixed roles, and Sign out.
  - **Role → tabs** (`src/lib/roles.ts`, held by `roles.check.ts`): from the AMS's own role model. Accountant, CAP coordinator and invoice encoder have **no app screens** — sent to the AMS on the web.
  - **Developer preview** on the sign-in screen (development builds only, `__DEV__`): open any tab set as a made-up person. Not in a store build — confirmed by a production web export, where it is absent.
  - **Checks:** `npm run checks` (each check self-tests, and both rule checks were mutation-proved), `npm run typecheck` (icon names are type-checked), `npm run lint`.
- ✅ **Yasir confirmed 4 Nov 2026:** the shell works in the Simulator; **accountant and invoice encoder stay web-only**; **CAP coordinator screens are the last phase (6)**.
- ✅ **Android checked 4 Nov 2026** (Yasir's Mac): Zulu JDK 17 + Android Studio 2026.2.2 (brew), SDK Platform **API 37** (what SDK 58 compiles against — `compileSdk 37`, `targetSdk 36`, build-tools 37.0.0), emulator **Medium Phone API 37.0**. `npx expo run:android`: **BUILD SUCCESSFUL in 14m 30s**, installed and opened, bundle loaded; Yasir confirmed the shell works. The Kotlin/Gradle warnings are deprecations inside Expo's own code.
- **Piece 2 — real sign-in, in progress:**
  - **S1 built 4 Nov 2026** — AMS commit `002f5ba` (Mac copy; Yasir pushes and deploys): `client/public/mobile/captcha.html` + `client/src/lib/__checks__/mobile-captcha.check.js`. Protocol tested against a stand-in for Cloudflare's script; **real Cloudflare to be checked after deploy** at `https://app.icsasystem.com/mobile/captcha.html`.
  - Then **S2** (device sessions), then the app's sign-in wired to them.
- **Next pieces:** sign-in for real (AMS S1 captcha page, S2 device sessions, then S12 Apple/Google), the API client, Face ID lock, the app version gate.

### Platform order — Yasir ruled, 4 Nov 2026

- **One codebase builds both** — neither iPhone nor Android comes first.
- **Testing:** iPhone Simulator now; **set up Android Studio and an Android emulator right after Phase 1 piece 1 (the app shell)**, then check every piece on both.

## 6. Where things are

- **This folder:** `~/Projects/icsa-mobile` on Yasir's MacBook Pro (Apple silicon). Local git repo once §5 step 0 has run; **no GitHub remote yet** (he creates it — see §7).
- **The AMS on the Mac:** `~/Projects/icsa-system` (read it for endpoints and rules; its own `CLAUDE.md` is long and authoritative).
- **The AMS in production:** `/home/icsasystem/icsa-system` on the server, account `icsasystem`, pm2 app `icsa-server`, PostgreSQL 16 (`icsa_db`, test clone `icsa_subtest`), behind Cloudflare at `https://app.icsasystem.com`. GitHub `skillyasir/icsa-system`, branch `master`.

## 7. For You (Yasir)

- **Start the accounts now** — they are the slowest part and none of the code waits on them until release:
  - ✅ **Done before this chat (Yasir, 3 Nov 2026):** Apple Developer (**Individual**) and Google Play (**Personal**, after 13 Nov 2023) are approved. The lines below are kept for the record — they only matter if the accounts move to an organization.
  - a **D-U-N-S number** for the legal entity that owns ICSA (free from Dun & Bradstreet; Apple has a lookup tool);
  - **Apple Developer Program as an organization** (yearly fee);
  - **Google Play Console as an organization** (one-time fee). A *personal* Play account created after 13 Nov 2023 must run a closed test with **12 testers for 14 days** before it can publish.
- **Create the GitHub repo** when you are ready (**Run on Mac:** `cd ~/Projects/icsa-mobile && gh repo create skillyasir/icsa-mobile --private --source . --push`).
- **App Review needs demo logins on production** — there is no staging server. Plan a "Demo" branch with made-up students so reviewers never see real people.
