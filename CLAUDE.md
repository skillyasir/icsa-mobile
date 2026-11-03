# CLAUDE.md — icsa-mobile

The ICSA app for iPhone, iPad, Mac and Android, on top of the ICSA AMS. Written 3 Nov 2026.
**New here? Read `HANDOVER.md` first.** This file is the standing rules: how Yasir works, where things run, what never to do.

## Who you work with

**Yasir Muhammad Farooq** — Managing Director and co-founder of ICSA (a multi-branch IT training institute in Kuwait), and the sole developer of the AMS. He decides; you advise, build and verify.

## How Yasir works — follow every one of these

- **Terse bullets with bold key terms.** Never long paragraphs. Short answers for short questions.
- **Decisions go through the options UI** (AskUserQuestion), **one question at a time**, with the best option first and marked **(Recommended)**. Do not ask what you can find out yourself.
- **Steps are numbered** — Step 1, Step 2 … — never prose instructions.
- **Every command says where it runs:** **Run on Mac** or **Run on server**. Screen steps say where too: **In AMS**, **In Xcode**, **On your iPhone**, **In App Store Connect**, **In Play Console**.
- **Anything he must decide or do goes under a loud "For You" heading** — never buried in the body.
- **Dates are always "3 Nov 2026"** (day, short month, year) — everywhere, no exceptions: chat, docs, commit messages, code, the app's UI, mockups. Never 11/3/2026 or 03/11/2026. Money is **KD with 3 decimals** (`120.000`).
- **Small in-place patches, plain readable code.** Edit files directly in the shared folders. **Never** hand him base64 or a file to download and re-upload.
- **One thing at a time.** Never run two workstreams in parallel. When a piece is finished, **raise what was deferred** rather than letting it drop.
- **Honest about testing.** Every report says what was tested, how, and what was **not** tested. "Not exercised" is not "unchanged".
- **Mockups before building.** His pattern: audit → mockups → his approval → build. Record his rulings with a date: "Yasir ruled, 4 Nov 2026: …".
- **Push back when something is wrong** — he wants professional advice, not agreement.

## The two machines

| | **Mac** (MacBook Pro, Apple silicon) | **Server** (InMotion, AlmaLinux 8.10) |
|---|---|---|
| Holds | `~/Projects/icsa-mobile` (this repo), `~/Projects/icsa-system` (AMS working copy) | `/home/icsasystem/icsa-system` — **production**, served at `https://app.icsasystem.com` |
| Builds | Xcode, iOS Simulator, Android Studio/emulator, Expo, EAS CLI | Node/Express + pm2 (`icsa-server`), PostgreSQL 16 |
| Git | `gh` signed in as `skillyasir` over HTTPS | deploy key, pushes `master` |

- **If you reach the Mac through the Claude desktop app's linked folders**, your shell is a **Linux VM** that sees the folders — it can edit files, run `node`/`npm`/scripts and git, but it **cannot run Xcode, the iOS Simulator, Android Studio, or reach the AMS database**. Give those steps to Yasir as **Run on Mac** and ask him to paste the output.
- **If you are Claude Code running in a Mac Terminal** (`cd ~/Projects/icsa-mobile && claude`), you can run Expo/Xcode commands yourself — still confirm before anything that signs, uploads or submits.
- **Git push is Yasir's** unless he says otherwise. Commit locally, by explicit path.

## The AMS — the server this app talks to

- **Base URL** `https://app.icsasystem.com`; JSON under `/api`; token sent as `Authorization: Bearer <token>`.
- **Stack:** Express + PostgreSQL 16 API in `server/`, React 19 (CRA) + Tailwind + TanStack Query + react-hook-form web app in `client/`.
- **Read `~/Projects/icsa-system/CLAUDE.md` before touching anything on the server.** Its rules bind any server change made for this app. The ones that matter most here:
  - **The tree is the deploy.** pm2 runs whatever is on disk under `server/`; a watchdog restarts it every 2 minutes on a failed health check and the daemon respawns daily at 01:54 Kuwait. Committing holds nothing back. **Never leave `server/` dirty at the end of a turn.**
  - **Migrations are applied by hand, to BOTH `icsa_db` and `icsa_subtest`, BEFORE the code that reads them.** Idempotent SQL; a `-DOWN.sql` that refuses while data depends on it.
  - **The student firewall is default-deny.** A student token reaches only paths in `server/src/middleware/studentFirewall.js`. Every new student endpoint needs a line there.
  - **Audit every state change** (`utils/audit.logAudit`); money and credentials fail the request if the audit fails.
  - **The check gate:** `node scripts/run-checks.js ; echo "exit=$?"` must be `0` before a client deploy. Add a `*.check.js` for every rule you add, with a self-test and a mutation proof.
  - **Another Claude session works the AMS repo.** Stage by explicit path. **Never `git add -A`, never `git stash`, `git reset` or `git checkout`** in his folders. Hands off `client/src/pages/publicPages/PublicCourses.js` and `docs/ICSA_HANDOVER_degree-pages.md`.
  - **Work as `icsasystem` on the server, never root.** **Never source or dot-execute `.env`.** **Never use a fixed filename in `/tmp`** — use `mktemp`.
  - **No staging server.** Test against `icsa_subtest` on port 5001 (see the AMS CLAUDE.md for the exact boot and teardown steps).

## Rules for this app

- **Read `AGENTS.md` too** — Expo's own rules for this SDK (it came with the template on 3 Nov 2026): add packages with **`npx expo install`**, never `npm install <pkg>`; check the **versioned Expo docs** for SDK 58, not memory; never hand-edit `ios/` or `android/` (they are generated — configure in `app.json`). Before calling anything done: `npm run typecheck` and `npx expo lint`.

- **The server decides; the app displays.** An old app version stays on phones for months — far longer than a stale web bundle — so **any rule that must hold lives in the API**. The app's checks are convenience only.
- **One owner for each rule.** Business logic already in the AMS's pure `client/src/lib/*.js` (enrolment sequence, instalments, phone prefixes, WhatsApp links, referrals, dates…) is **reused, not rewritten** — vendored by `scripts/` and verified against the AMS on every check run. A hand-made copy is a second copy, and second copies drift.
- **Same figures as the AMS.** Fees, paid, balance, attendance status, progress: read them from the endpoints that compute them. Never add up money on the phone.
- **Money never queues offline.** Payment, enrolment and registration writes need a live connection and carry an idempotency key, so a retry on a weak signal cannot record a payment twice.
- **Tokens live in the Keychain / Android Keystore** (`expo-secure-store`) — never AsyncStorage.
- **No personal data on the lock screen** by default — push text says what happened, not the student's name, amount or Civil ID.
- **Location only when needed:** for check-in, and (Yasir ruled, 3 Nov 2026) **student arrival reminders** by the phone's own geofence around each branch. **Never staff. Never sent to the server in the background. Never an automatic check-in** — the student taps.
- **Respect the platform:** iOS tab bar and gestures on iPhone, Material 3 on Android, sidebar layouts on iPad/Mac. Dark mode, Dynamic Type, RTL-ready for Arabic.
- **Every screen handles loading, empty, error and offline** — no blank screens, no silent failures. A failure names the server's error.
