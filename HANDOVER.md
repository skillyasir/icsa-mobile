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
  - **S1 built 4 Nov 2026** — AMS commit `002f5ba` (Mac copy; Yasir pushes and deploys): `client/public/mobile/captcha.html` + `client/src/lib/__checks__/mobile-captcha.check.js`. Protocol tested against a stand-in for Cloudflare's script. ✅ **Live 4 Nov 2026**: Yasir pushed and ran `./deploy` (135 checks, 0 red; bundle `main.31bbf2bb.js` unchanged), and the page on `https://app.icsasystem.com/mobile/captcha.html` shows Cloudflare **Success!** in Safari.
  - **S2 built 4 Nov 2026** — AMS commit `36889c5` (Mac copy): `mobile_devices` + `/api/mobile/session*` + the manager revoke + a Settings field. 30 days, every use resets it (Yasir). Details and what was deferred: `docs/03-ams-server-changes.md` › S2. ✅ **Live 4 Nov 2026**: migration applied to `icsa_subtest` and `icsa_db` before the code; test copy on 5001 and the live server both answer a made-up token with `SESSION_INVALID`; `./deploy` 136 checks, 0 red, bundle `main.86fca7fa.js` served.
  - **The app's sign-in, built 4 Nov 2026** (not yet run on a phone):
    - `src/api/session.ts` — the session client, pure TypeScript: AMS login → `POST /mobile/session` → refresh token in the Keychain/Keystore (`expo-secure-store`, this-device-only, kept out of Android backups); access token in memory, renewed a minute before it runs out, one refresh at a time, one retry after a 401. **Only the server ends a session** (`SESSION_*`, `ACCOUNT_INACTIVE`, `AMBIGUOUS_STUDENT`); no signal, a timeout, a 5xx, a 404 or a 429 keep the sign-in. Sign out clears the phone first, then tells the server, so it works offline. A sign-out while a refresh is on the wire is not undone by the late reply.
    - `src/api/client.ts` — wires it to the phone: Keychain, `Device.modelName` (never the owner's name for the phone), the app version.
    - `src/auth/signInRoute.ts` — which AMS endpoint an identifier goes to: the web login's own rule, held to `Login.js` by its check.
    - `src/auth/CaptchaView.tsx` + `captchaMessage.ts` — the S1 page in a WebView that may only load the AMS and Cloudflare; the protocol is held to `captcha.html` by its check.
    - **Launch:** "Signing you in…" while the AMS is asked; with no signal, **"Cannot reach ICSA"** and Try again — the sign-in is kept, never dropped.
    - **Me** shows the person from the AMS: branch, and student code (at sign-in) or email.
    - **Removed until S4:** the "Unlock with Face ID" switch on the sign-in screen — it changed nothing, so it promised something the app does not do. It comes back with the Face ID lock.
    - **Checks:** `session.check.ts` (51, against a stand-in AMS that rotates like S2), `signInRoute.check.ts` (17), `captchaMessage.check.ts` (23); 12 planted defects all caught. The checks read the AMS copy beside this repo (`../icsa-system`, or `ICSA_SYSTEM_DIR`) and **could not run** without it. `npx expo export` builds for iOS and Android.
    - **Not tested yet:** a real phone against `app.icsasystem.com` — the Cloudflare check in the WebView, a real login, the Keychain. That is Yasir's Simulator run.
    - **First Simulator run, 5 Nov 2026: the check stuck on "Verifying…".** The WebView's origin list is asked about EVERY frame on iOS, and the narrow one refused Cloudflare's own inner frames (`about:srcdoc`, `blob:`). Fixed: the list is open and one function, `captchaLoadDecision`, guards the page itself (AMS or Cloudflare only) and leaves Cloudflare's frames alone; `captchaMessage.check.ts` §4–§5 hold it (4 planted defects caught, the original bug among them). (The "PosterBoard quit" dialog in that run is the Simulator's own wallpaper app, not ours.)
    - ✅ **iPhone Simulator, 5 Nov 2026:** Yasir signed in with his own account and reached the manager Dashboard.
    - **Android emulator, 5 Nov 2026: Cloudflare said Success! but Sign in never woke up.** Android's message listener reports the sender's ORIGIN only (`https://app.icsasystem.com`), not the page URL iOS gives, and it hears every frame. The view accepted only the page URL, so every Android message was dropped. Fixed: `isCaptchaMessageSource` accepts the page URL or the AMS origin and refuses Cloudflare's; `captchaMessage.check.ts` §6 holds it, and holds the addresses in `captchaMessage.ts` equal to `config.ts`'s (4 planted defects caught).
    - ✅ **Android emulator, 5 Nov 2026, after `cbe9a2c`:** Yasir: "yes it's working" — signed in with his own account to the manager Dashboard. **Piece 2 (real sign-in) is done on both platforms.**
    - ✅ **Tab names on Android (Yasir, 5 Nov 2026: show all names):** Android showed only the selected tab's name (Material's default). Now every tab shows its name, as on iOS — `labelVisibilityMode="labeled"`, held by `tabs.check.ts` §5.
    - New packages (SDK 58 versions from Expo's own list): `expo-secure-store ~58.0.2`, `react-native-webview 14.0.1` — **native, so the app must be rebuilt** (`npx expo run:ios` / `run:android`), not just reloaded.
- **Piece 3 — the Face ID lock and the update check (S4), built 5 Nov 2026.** Yasir's rulings that day:
  - ✅ **Lock after 5 minutes away**; ✅ **on for everyone** whose phone can lock, **each person may switch it off** (Me); ✅ **Face ID / fingerprint, then the phone's passcode**, else "Sign in again"; ✅ **the lowest allowed app versions are set on the AMS Settings page**, every version allowed until set.
  - **AMS (server half): commit `f927c12`** — `GET /api/mobile/config`, no sign-in, FAILS OPEN (unset, empty or a typo = every version); two text boxes in Settings › Security. No migration. The access log does NOT record the app version (its check keeps `:instance` the last field; `mobile_devices.app_version` already records it per phone).
  - **App:** `src/gate/AppGate.tsx` + `src/lib/version.ts` (the Update screen, asked on open and on return at most hourly, fails open); `src/lock/LockProvider.tsx` + `lockRule.ts` (the lock; the screen is covered for the app switcher; only time in the BACKGROUND counts as away — the Face ID prompt itself makes iOS "inactive", and treating that as a return would re-lock and ask again for ever, so Cancel could never reach "Sign in again"; signing out resets the choice to on). The sign-in screen's "Unlock with …" switch is back, shown only on a phone that can lock; Me has "Lock with …" and the app version.
  - **First Android run, 5 Nov 2026: it never locked.** The phone's unlock ability was read only at launch; Yasir added the PIN and fingerprint in Settings with ICSA open, so the app kept "this phone cannot lock". Fixed: asked again on every return, and the lock decides on that fresh answer (`lockRule.check.ts` §5, both mutants caught).
  - ✅ **Android emulator, 5 Nov 2026, after `caa86fb`:** Yasir: "yes all worked" — Me shows "Lock with fingerprint", the app locks after 5 minutes away, unlocks with the fingerprint, and Cancel stays on the lock screen with Unlock and Sign in again working.
  - **New native package:** `expo-local-authentication ~58.0.2` with its Face ID permission text ("To unlock ICSA quickly and keep your account safe.") — **rebuild needed** (`npx expo prebuild --clean`).
  - **Checks:** `version.check.ts` 18, `lockRule.check.ts` 26 (it reads the package's own numbers, so it COULD NOT RUN until `npm install`), `session.check.ts` 53; 9 planted defects caught, among them the gate failing closed, versions compared as text, the Face ID loop and a token on the public call.
- **Piece 4 — Google + Apple sign-in (S12), started 6 Nov 2026.** Yasir's rulings, 5–6 Nov 2026:
  - ✅ **Google + Apple** (asked whether Apple is needed: guideline 4.8 has an education exemption that likely fits ICSA, since accounts are made by ICSA and Google only signs in existing ones — he chose both anyway, the safe route for review).
  - ✅ **An Apple email that matches no ICSA account (Apple can hide it, and gives it only the first time):** the person signs in with their ICSA password once and **links Apple in Me**; the Apple button works for them from then on.
  - ✅ **Claude does the console setup** in the Claude app's built-in browser (Google Cloud: iPhone + Android sign-in IDs in the AMS web client's project, number 834637605414; Apple Developer: Sign in with Apple for `us.icsa.app`), asking before anything is saved.
  - ✅ **Console setup done, 6 Nov 2026** (Claude, in the built-in browser; Yasir approved each save):
    - **Google Cloud project `icsa-system-g-login`** (number 834637605414). Client IDs are not secrets:
      - Web (existing, the AMS website): `834637605414-rh4f6dci5gkqv7uhc6rqi9semnvg8tpa.apps.googleusercontent.com`
      - **iPhone** "ICSA app iPhone", bundle `us.icsa.app`: `834637605414-p01k9vro3eiqilr45c51cuidu0tueefc.apps.googleusercontent.com` (URL scheme `com.googleusercontent.apps.834637605414-p01k9vro3eiqilr45c51cuidu0tueefc`)
      - **Android** "ICSA app Android (debug)", package `us.icsa.app`, the standard React Native debug key SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`: `834637605414-hgj3vasgohi36cvje4nag16a4lq38v46.apps.googleusercontent.com`. **The Play signing key needs a second Android client in Phase 2.**
    - ⚠️ **Found: the project was still in "Testing" with 0 test users**, so Google sign-in was blocked for everyone, the AMS website included (lifetime user count 0). Yasir chose **fix and publish**: app name "ICSA" (was the typo "ICSA-SYSTEM-G-LOING"), home `https://icsa.us`, privacy `https://icsa.us/privacy_policy`, terms `https://icsa.us/terms`, domains `icsasystem.com` + `icsa.us`, **no logo** (a logo forces Google's review). **Now "In production".** Basic sign-in only, so no review.
    - **Apple Developer, Team `69B3AATWN8` (an individual account: "Yasir Muhammad Farooq"):** App ID "ICSA app" `us.icsa.app` (explicit), **Sign In with Apple** on (primary App ID). No Services ID, key or email sources: the app verifies Apple's identity token itself, and nothing emails through Apple's relay.
  - **AMS (server half): commit `a4aec9f`, LIVE 6 Nov 2026** (migration `2026-11-06-user-apple-ids.sql` on both databases first; the server reaches Apple's keys, 200). `POST /api/auth/apple` (public, rate-limited), `GET /api/auth/apple`, `POST /api/auth/apple/link` and `/unlink`; Google sign-in accepts the app's iPhone and Android client IDs beside the website's. `apple-sign-in.check.js` 102/0, 15 planted defects caught; rehearsed on a real PostgreSQL 16, 15/15.
  - **App:** `src/auth/nativeSignIn.ts` asks Google or Apple for a token (Google's choice is forgotten once the token is in hand, so the next sign-in asks which account again; Apple is asked for the email only); `src/auth/providerRoute.ts` says where it goes (`/auth/google { credential }`, `/auth/apple { identity_token }`), and the session client binds the phone exactly as after a password sign-in. The sign-in screen: Apple's own button (iPhone) and Google's, side by side, the same size. **Me › SIGN-IN:** a "Sign in with Apple" switch (links / unlinks through the AMS) and a line saying which Google account works.
  - **New native packages:** `@react-native-google-signin/google-signin 17.0.0` (exact) and `expo-apple-authentication ~58.0.2`; app.json gains both plugins, the Google URL scheme and `ios.usesAppleSignIn` — **`npm install`, then rebuild** (`npx expo prebuild --clean`).
  - **Checks:** `providerRoute.check.ts` 35 — the app's routes, fields, client IDs, URL scheme and bundle id against the AMS's own; 9 planted defects caught.
  - **First Android run, 6 Nov 2026:** the red "RNGoogleSignin could not be found" screen right after `npm install` is expected — Metro served the new code to the old build. Gone after `npx expo prebuild --clean` + `npx expo run:android`.
  - ✅ **Android emulator, 6 Nov 2026, after `b3bbf8f`:** Yasir: "yes it worked on android" — Sign in with Google signs in.
  - **First iOS run, 6 Nov 2026: "No code signing certificates are available to use", even on the simulator.** Expo requires a development team for ANY build carrying the Sign in with Apple entitlement (its `simulatorBuildRequiresCodeSigning`). Fixed: `ios.appleTeamId: "69B3AATWN8"` in app.json (the team us.icsa.app is registered under); `providerRoute.check.ts` §3 now requires it. A REAL iPhone additionally needs Xcode signed in to that Apple ID once (it makes the development certificate).
  - ✅ **iPhone simulator (iPhone 18 Pro, iOS 27.2), 6 Nov 2026, after `1fea729`:** Yasir: "yes it worked" — asked to test Sign in with Google, sign out, then Sign in with Apple.
  - ✅ **Piece 4 (S12) done, 6 Nov 2026.**
- **Phase 1 (Foundation) is complete.**
- **S2c — a changed password signs the person's phones out: LIVE 6 Nov 2026** (AMS `329369d`; Yasir chose it as the next piece). No app change: the app already shows the server's words when a refresh is refused. Details in docs/03, S2.
- **Next:** Phase 2 (Teachers + Students) — started 6 Nov 2026, below.

### Phase 2 progress

- **Piece 1 — Student Home + check-in** (Yasir chose it, 6 Nov 2026). **Yasir ruled, 6 Nov 2026:** the location is read **only when the student taps Check in**; a location the phone reports as **faked is recorded and marked for review** (S6), never refused by the app; **a real map now** — Apple Maps on iPhone, Google Maps on Android.
  - **AMS S6: LIVE 6 Nov 2026** (`3140e02`): `mocked` + `app_platform` on check-in, a mocked one written `pending_review`, my-context answers `branches`. The deploy restarted the code before the migration; the access log shows no failed check-in in that gap.
  - **AMS addition, no migration (6 Nov 2026):** my-context also sends `class_days`, `start_time`, `end_time` per enrolment and `check_in_distance_m` / `check_in_accuracy_m` on today's check-in (never the coordinates). Additive; the app shows nothing for them on an older AMS. `mobile-my-context.check.js`.
  - **Google Maps key "ICSA app Android maps"** (project `icsa-system-g-login`): Android apps only (`us.icsa.app` + the debug SHA-1), API limited to Maps SDK for Android. Only Maps SDK for Android is switched on in the project — the other Maps APIs were never on. It is in `app.json` through the `react-native-maps` plugin. **Before a Play build, add the Play signing key's SHA-1 to this key** (with the second Google sign-in client).
  - **App:** Home (greeting, YOUR CLASS TODAY with Check in, Attended / Progress / Next fee, Continue learning, Due soon) and the Attendance tab, now a stack: today's classes and the history, with **Check in** pushed over it (the map, check in, choosing the teacher, Wrong teacher? Change, Check out). Home's Check in tap is the check-in: the screen opens and starts at once.
  - **Differs from the mockup, on purpose:** no "You are 42 m from ICSA City" before checking in (it needs the location before the tap); back from Check in goes to the Attendance list, not Home.
  - **Packages:** `expo-location` ~58.0.20 (while-in-use only: Always, background and motion are removed from the build) and `react-native-maps` 1.29.11.
  - **Checks:** `rules.check.ts` 97 and `today.check.ts` 24 hold the endpoints, fields, location rule, teacher-change rule, Kuwait dates and the map to the AMS's own; `tabs.check.ts` now knows a built tab and a tab that is a stack. 13 planted defects caught (9 in rules, 3 in today, 1 in tabs).
  - **First run, iPhone simulator, 6 Nov 2026:** the Apple map draws Mahboula's 1000 m area; class, teacher and "Choose another teacher" right; the simulator had no location set, so a hybrid check-in asked before Online, as designed. test22 was then checked in **Online at 5:09 PM** from that question (a real record, Sameer Salim Malim's class), so the location test moved to **7 Nov 2026 with test22** (Yasir). Two fixes from the run: the no-position cause is logged (`ed89b24`), and the question no longer stays on screen after the check-in (`ea4f08f`).
  - ✅ **Tested on both phones, 7 Nov 2026 (test22):** Home, Attendance (every class, history and totals), Check in with a position — Android emulator "0 m from Mahboula · ±5 m", **Waiting for … to confirm**; iPhone simulator the same position, **Awaiting review** (the simulator's location is software-simulated: S6 end to end) — Online check-in (6 Nov), Wrong teacher? Change (Sameer → Ibrahim Yasir, server message shown), Check out. Fixes from the run: every class listed whatever its class days (`f051ac7`), Overdue fee label (`f051ac7`), the ICSA badge above the dot (`b6f27c7`), the Android map fitted to the area (`b274742`, **check on the next Android check-in** — the map only shows the dot right after checking in).
  - **Not tested:** choosing another teacher before checking in; location permission refused; a position outside the circle; outside office hours.
  - **Starting the app: `npm run ios` / `npm run android` (= `npx expo run:…`), never `npx expo start` + `i`/`a`.** There is no expo-dev-client, so `expo start` targets **Expo Go**, which lacks this app's native modules — found 7 Nov 2026 as "RNGoogleSignin could not be found" on both phones. `run:` opens ICSA's own build, starts Metro (or reuses one on 8081) and links the Android emulator (`adb reverse`) itself.
  - **No Features › Location in this Simulator:** set the position with **Run on Mac:** `xcrun simctl location booted set 29.1462787,48.1249043` (Mahboula; Kuwait City is 29.3632516,47.9640249; both 1000 m).

- **Piece 2 — the teacher's Today and Mark class** (Yasir chose it, 7 Nov 2026; mockups 05 and 06), `d35e2d2`. No AMS change: staff-context, individual confirm, confirm-present, session confirm, the review queue and my-classes are all open to a teacher already.
  - ✅ **Tested 7 Nov 2026 on the iPhone simulator, signed in as Sameer Salim Malim (Yasir's choice):** Waiting for you with a real walk-in; **Present** on test22's check-in (moved back to Sameer from test22's phone with Wrong teacher? Change) — it moved to Marked today as Present; "No batch classes today" (a Saturday); the two figures: 2 assignments to check, 10 students stuck.
  - **Not tested:** Confirm all (needs two waiting), **Mark class** (needs a day with a batch class), a check-in awaiting review on Today, another day (read_only).
  - **Not built, on purpose:** the mockup's individual-class rows ("6:30 PM · Individual · 2 students") — staff-context has no today's-individual-classes list; walk-ins appear in Waiting for you when they check in.

- **Yasir ruled, 7 Nov 2026: build in bunches, then test together** — "instead of asking me again and again we should do all or atleast a bunch and then check". So pieces are built several at a time without a question between them, and tested in one run.

- **Bunch 1 (7 Nov 2026) — Check assignments, Classes, student Fees + payment proof** (mockups 07 and 04). No AMS change: the review queue, submissions, review, my-classes, the student fees, `payment-proofs/mine` and `POST /payment-proofs` are all open already (the three student paths are in STUDENT_ALLOWLIST).
  - **Teacher › Assignments** (a stack): the review queue, then each assignment's submissions; To check / Returned / All, oldest waiting first. A submission opens with its file (downloaded with the sign-in, then shown or shared), a score out of the assignment's points, a comment, **Return to redo** or **Mark reviewed** — the AMS's `needs_revision` / `approved`. Read-only when the AMS says the teacher cannot grade it.
  - **Teacher › Classes:** the students who need you (stuck, failing a quiz, to mark, not started — progressService's own words), then each class with its average and chips.
  - **Today's two figures are tappable** — assignments to check opens Assignments, students stuck opens Classes.
  - **Student › Fees** (a stack): per course the fee, paid and balance **as the AMS computes them** (never added up in the app), the instalments marked paid / part paid / overdue / due, and the proofs sent (a rejected one shows reception's reason).
  - **Upload payment proof:** take a photo or choose one, the course (asked only when more than one has a balance), the amount (the next instalment's remainder, editable), a note. Shrunk as the website does (1600 px, 0.85, then 0.7) to the AMS's 500 KB. **Sent once per tap, never queued or retried** — a proof is a request reception confirms, and a second copy is a second request.
  - **Packages:** `expo-image-picker` ~58.0.10 (camera and photos; the microphone is removed from the build), `expo-image-manipulator` ~58.0.16, `expo-file-system` ~58.0.13, `expo-sharing` ~58.0.21. **New native modules: a rebuild is needed** (For You). The image picker caps the storage permissions at Android 12 and older (`maxSdkVersion 32`).
  - **Session:** `ams.token()` (a fresh access token for a file download or an upload) and `failureOfAnswer` (the same words for a refused upload as for any refused request); `session.check.ts` §17.
  - **Checks:** `assignments.check.ts` 27, `classes.check.ts` 22, `fees.check.ts` 37 hold the endpoints, field names, statuses and words to the AMS's own; planted defects in each were caught.
  - **8 Nov 2026, first proof upload on Android: "Cannot reach ICSA"; nothing was sent.** This Expo replaces the global `fetch` with Expo's own (`expo/src/winter/runtime.native.ts`, unless `EXPO_PUBLIC_USE_RN_FETCH`), and Expo's fetch **refuses React Native's `{ uri, name, type }` FormData file part** — it threw while building the body, before any request, and the screen's catch called every throw "Cannot reach ICSA". Fixed: the proof goes by expo-file-system's `File.upload` (multipart, field `proof`, foreground), and the catch logs the real error (`[proof] the upload failed:`). `fees.check.ts` §6 (10 assertions, 6 planted defects caught, a comment that only MENTIONS FormData passes). **Any future upload uses `File.upload`, never FormData + fetch.**
  - ✅ **Proof upload tested 8 Nov 2026 on Android as test22, after the fix:** sent, and it appeared under Proofs you sent.
  - **Yasir ruled, 8 Nov 2026: a part-paid instalment past its date is overdue, in red** — "Part paid: 5.000 of 200.000 · overdue since 15 Sep 2026". The AMS's own status (and the website) still say "partial"; the phone says both. Home's Next fee tile already went by the date. `fees.check.ts` §5 (4 planted defects caught, including the Kuwait-day boundary). ✅ Seen on Android 8 Nov 2026.
  - **8 Nov 2026, the first review as Sameer (iPhone): "Invalid value in request (bad UUID, number, or enum)"; nothing saved.** `pathFor` matched `:[a-z_]+` only, so `:submissionId` was read as `:submission` + `Id` and the review went to `/assignments/submissions/Id/review`. Its only test used a snake_case name. Fixed: any identifier, and a name the caller did not give throws. The review screen catches and says nothing was saved. `today.check.ts` §1b: a camelCase name, every path in every API table against an oracle that does not use pathFor's regex, and every call site's names against its path's (5 planted defects caught; the clean run caught a name clash in the check itself first — `walk` — so the kills before it were void).
  - **Reloading Android when Metro already runs elsewhere:** `npx expo run:android` reuses the running Metro ("Waiting on http://localhost:8081") and returns to the prompt, so `r` there does nothing. Reload from the emulator (**R R**, or **Cmd + M › Reload**) or press `r` in the terminal Metro runs in.
  - **Not tested yet:** the rest, on a phone (For You).

- **Bunch 2 (8 Nov 2026) — student Learn + assignments, teacher Students.** Built after test22 found no way to see or hand in an assignment (the Learn tab was a placeholder). No AMS change: every endpoint is open to its role already (the student ones are in STUDENT_ALLOWLIST).
  - ✅ **The teacher's review tested 8 Nov 2026 as Sameer (after the `pathFor` fix):** returned test22's Assignment No. 4 to redo with a comment.
  - **Student › Learn** (a stack): the course (a picker when there are several; a paused one says so), its ring line from the AMS — "23 of 36 items done · Grade so far 86% (B+)" from `/auth/student/progress` and `/grades` — and the subjects, each with Lessons n/n · quizzes n/n · assignments n/n, where the student is (Not started / Now on lesson 7 / All lessons done / Paused / Access ended), days left from 7. **No "Completed" verdict on the phone** — the counts are the website's, the verdict is the AMS's. A course reached only through a class (a child course) has no enrolment of its own id, so it gets **no** ring rather than a guess.
  - **A subject:** its chapters (labels) and every lesson, quiz, final exam and assignment in the teacher's order, in the website's words (StudentSubjectLessons.js). **Only assignments open.** Lessons and quizzes are listed with their state and a line that they open in the next update — they need the lesson player (WebView + the AMS lesson bridge), the next bunch.
  - **An assignment:** the brief (the teacher's HTML shown as words — nothing run), due date, points, the sample file; the student's work (open the file), the grade out of the points, **the teacher's comment**, the status; **hand in** a file (PDF, Word, Excel, image — `File.pickFileAsync`, no new package), a photo taken or chosen (JPEG, 2400 px, 0.85), only when nothing is in or after "needs revision" (the website's rule); Resubmit asks first. Two steps as on the website: `/upload/assignment-file` (File.upload, multipart `file`), then the hand-in names it. And the comment thread.
  - **Home:** Continue learning opens its subject; a Due soon assignment opens.
  - **Teacher › Students** (a stack): the students he teaches — the AMS scopes the list, search or not (2+ characters) — with the AMS's status and last attended; one student: Call, WhatsApp (the AMS's own `waNumber`, run side by side in the check), courses and teachers, the AMS's attendance rate and counts, the last 10 records.
  - **`pathFor` moved to `src/api/paths.ts`**; `today.check` §1b now registers every API table and reads `{ courseId }` shorthand.
  - **Checks:** `learn.check.ts` 66, `assignment.check.ts` 41 (incl. a sweep: **no file in the app builds a FormData**), `students.check.ts` 24; 13 planted defects caught, and a comment that only mentions FormData passes.
  - ✅ **Tested 8 Nov 2026:** test22 handed in (photo, Resubmit after needs-revision) and Sameer marked it; the subject list showed the approved assignments with their grades. **Not tested yet:** Teacher › Students, choosing a file (not a photo), the comment thread, Continue learning and Due soon on Home.
  - **Lessons and quizzes do not open yet** — Yasir noticed 8 Nov 2026; the lesson player is bunch 3.

- **Bunch 3 (8 Nov 2026) — lessons and quizzes open in the app.** **Yasir ruled, 8 Nov 2026: the website's own lesson and quiz pages inside the app** (chosen over native screens or a mix): every lesson kind, the interactive lesson bridge, typing and all eight quiz kinds work as on the website, and their rules keep one owner.
  - **AMS half (client only, no server change): `lib/appMode.js`.** The app sets `sessionStorage.icsa_app = "1"` before the page loads. Then the website shows **no header, menu or footer** (StudentLayout), **never times out or renews the sign-in** (IdleContext inactive — a renewal would mint a website token out of the app's, past the app's own sign-out), and on a **401 tells the app** (`{ icsa: "ams-page", v: 1, type: "auth-expired" }`) instead of going to /login. The subject page opens **`?item=<id>`** directly and hides its back link in the app. `appMode.check.js` (renders StudentLayout in and out of the app) 32/32; 8 planted defects caught.
  - **App half: `webPage.ts` + `LessonWebScreen` (`/student/learn/open`).** A native header (Back goes back inside the page first) over a web view of `/student/lessons/subjects/<subject>?item=<item>`: **incognito** (keeps nothing once closed), the app's own short-lived token written **before the page loads, main frame only, only on app.icsasystem.com** (JSON-escaped), a fresh one every minute, and a run-out sign-in reloads with a fresh one at most every 15 s. The page may stay only on `/student/…`; a material (`/uploads/…`) and any other site open in the phone's browser; any other AMS page is refused. Only the AMS page may message the app (a lesson's sandboxed frame is "null"). `webPage.check.ts` 38 (the scripts are RUN in a fake page, on the AMS and on a look-alike address); 8 planted defects caught.
  - **The subject list:** a lesson, a quiz or the final exam now opens (assignments stay native). **Home › Continue learning** opens the lesson itself.
  - **The checks now run the AMS firewall's OWN matcher** (`scripts/ams.ts amsFirewallAdmits`: its allowlist and its `pathMatches`, read from the file) — the AMS changed the matcher on 8 Nov 2026 (`:name` = one path part), and a copy in a check would have kept answering the old question.
  - **Not tested yet:** all of it (For You). **Not live until the AMS half is deployed** — without it the page shows the website's header and times out.

### Deferred — raise when the current piece is done

- **Continue learning on Home opens its subject (8 Nov 2026)** — it opens the lesson itself once the lesson player is built.
- **AMS, found 8 Nov 2026 — Yasir: "fix it" — FIXED in AMS `3dcfae8` (Mac copy), NOT LIVE until pushed and `./deploy`ed: the website never showed a student the teacher's review comment.** `getMyAssignment` sends `feedback`; `StudentAssignmentView.js` never reads it (not asserted in a check on purpose: a check that the defect is present would go red on its fix). A teacher who types a comment in the review dialog is talking to nobody on the web. The app shows it.
- **Android permissions from Expo's defaults** — the build asks for `SYSTEM_ALERT_WINDOW`, which the app does not use. Remove it (`android.blockedPermissions`) before the Play listing; Play asks about each one. `READ`/`WRITE_EXTERNAL_STORAGE` are now the image picker's, for Android 12 and older only (7 Nov 2026) — keep them.
- **AMS, found 7 Nov 2026, not fixed:** `POST /payment-proofs` does not check that the `enrollment_id` it is sent is the student's own. Approving such a proof finds no fee plan and records the payment with no schedule. The app only ever sends the student's own enrolments; the AMS should refuse another's.
- **Staff attendance module (Yasir, 4 Nov 2026):** ICSA staff will clock in their **own** working day. It does not exist in the AMS today (attendance there is students only, marked by teachers and supervisors). It needs a new AMS module first, then app screens. Daily clock-in works with the 30-day sign-in (no daily sign-in). Open questions for then: location at clock-in only, like students (arrival reminders are students-only today); who sees and corrects staff records.

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
