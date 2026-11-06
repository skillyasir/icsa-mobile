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
- **Next pieces:** test S12 on the iPhone (Google and Apple, and Me › Sign in with Apple); then Phase 2 (Teachers + Students).

### Deferred — raise when the current piece is done

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
