# AMS server changes the app needs

Written 3 Nov 2026. **Nothing here is built yet.** Each item is its own change on the AMS (`~/Projects/icsa-system`), done the AMS way:

- **Migration first, by hand, to BOTH `icsa_db` and `icsa_subtest`, before the code that reads it.** Idempotent, with a refusing `-DOWN.sql`, and a line in the AMS `CLAUDE.md` Migrations section.
- **Rehearse on `icsa_subtest`** (port 5001 instance, kill by port, count pids) before production.
- **Audit every state change**; money and credentials fail the request if the audit fails.
- **A `*.check.js` for each rule**, with a self-test, and a mutation that proves it bites. Gate `exit=0`.
- **Never leave `server/` dirty at the end of a turn** — the tree is the deploy.
- **Additive only.** The web app keeps working unchanged after every step; nothing the web uses changes shape.

Order = the order the app needs them.

---

## S1 — Sign-in from the app (the captcha)

- **Today:** `POST /api/auth/login` and `POST /api/auth/student-login` refuse without a Cloudflare **Turnstile** token. Turnstile has no native SDK; Cloudflare's route for apps is the widget in a WebView.
- **Add:** a small page on `app.icsasystem.com` (e.g. `/mobile/captcha`) that renders the widget with the AMS site key and hands the token to the app (`window.ReactNativeWebView.postMessage`). Put it in **`client/public/`** so it ships with every client build — `deploy-client.sh` wipes `server/public` on each deploy.
- **Mind:** Cloudflare's WebView requirements (JavaScript + DOM storage on, `challenges.cloudflare.com` reachable, one stable user agent for the session).
- **Later:** App Attest (iOS) + Play Integrity (Android) as the app's proof of being genuine, instead of a captcha.

## S2 — Device sessions (stay signed in safely)

- **Today:** a token lives about 12 minutes (`session_idle_minutes`, default 10, + 120 s grace) and is renewed by `POST /api/auth/refresh` while the user is active. Fine for a shared PC; on a phone it means signing in many times a day.
- **Add:** table `mobile_devices` — `id, user_id, platform, model, app_version, refresh_token_hash, push_token, created_at, last_seen_at, revoked_at, revoked_by`.
  - `POST /api/mobile/session` — right after a normal login: issues a long-lived **refresh token** bound to this device (stored hashed).
  - `POST /api/mobile/session/refresh` — refresh token → a fresh short access token (rotating the refresh token).
  - `DELETE /api/mobile/session` — sign out this device.
  - `GET /api/users/:id/devices` + `POST /api/users/:id/devices/:deviceId/revoke` — manager signs out a lost phone.
  - Settings page: **Mobile app** section — session length in days, require biometric unlock.
- **The app** locks behind Face ID / fingerprint after the idle time instead of signing out.
- **Student firewall:** add the three `/api/mobile/session*` paths.
- **Audit:** session created / revoked (credentials tier — fail the request if the audit fails).

## S3 — Push notifications

- **Today:** one helper writes every notification — `server/src/utils/notify.js` (`createNotification`, called by `notifyUsers` / `notifyBranchManagers`) — into the `notifications` table that the web inbox reads.
- **Add:**
  - `POST /api/mobile/devices/push-token` (store the Expo push token on the `mobile_devices` row), cleared on sign-out.
  - `services/push.js` — sends through the **Expo Push Service**, reads the receipts, prunes tokens reported invalid, logs `[push-failed]` with the notification id (CONTINUE-BUT-LOUDLY tier: a push failure never fails the action).
  - **One hook:** after `createNotification` inserts its row, hand it to `push.send` — fire-and-forget, after COMMIT where there is a transaction. Every existing notification gets push with no other change.
  - Payload: `{ title, body, data: { notificationId, link } }`. **Lock-screen privacy:** a per-type rule decides whether the body may show (default: no names, no amounts, no IDs).
  - Badge = `GET /api/notifications/unread-count`.
- **Student firewall:** add `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/*` (read), and the push-token path. Students then see their own inbox (the controller already scopes by recipient — confirm).
- **New events** (each a `notifyUsers` call at the place the event happens, with a check that it fires): class reminder (scheduler), fee instalment due (scheduler, with the Follow-up digest's quiet hours), check-in confirmed, assignment submitted (to the teacher), payment proof submitted (to branch staff).

## S4 — App config and the minimum version

- `GET /api/mobile/config` (no login needed) → `{ min_version: { ios, android }, latest_version, features: {…}, support: { whatsapp, phone } }`, read from `settings` with code defaults.
- The app refuses to run below `min_version` with an **Update** button — the phone equivalent of the AMS's "a tab on a deleted bundle gets a loud error and reloads".
- `middleware/accessLog.js` logs `X-App-Version` and `X-App-Platform` (which app version a user ran is the fact you will need first when something goes wrong — the same reason the access log records which `main.<hash>.js` a browser fetched).

## S5 — Idempotent creation and money writes

- **Why:** a phone on a weak signal retries. Without this, one tap can record a payment twice.
- **Add:** table `idempotency_keys` — `key, user_id, method, path, status, response_json, created_at` (unique on `user_id, key`), kept 7 days.
- Middleware on: `POST /api/payments`, `POST /api/enrollments`, `POST /api/enrollments/full`, `POST /api/payments/schedule`, `POST /api/students`, `POST /api/payment-proofs`, `POST /api/refunds`, `POST /api/students/:studentId/charges`.
  - Same key + same user → the stored response, nothing re-run.
  - Same key, still in flight → `409 { error: 'Already being processed' }`.
  - No key → today's behaviour (the web app is unchanged).
- **Check:** a replay with the same key creates no second `actual_transactions` row (stubbed DB), and a missing key still works.

## S6 — Location hardening

- **Today:** the server measures the distance itself and caps the claimed accuracy. Good.
- **Add:** accept `mocked: true|false` (Android reports a mock-location provider) and `app_platform` on `POST /api/attendance/check-in`; store them; a mocked fix becomes `pending_review` (supervisor/manager confirms) rather than a silent present. Log the rejection the same way `logRejection` does today.

## S7 — Student firewall lines

- With S2/S3: the session, push-token and notifications paths.
- **A defect found on 3 Nov 2026 while preparing this:** `{ method: 'GET', path: '/api/auth/student/typing/:lessonId/attempts' }` — the matcher compares exact strings (or prefixes ending in `*`), so a literal `:lessonId` never matches a real request and **students get a 403 on their typing history today**. Fix: `'/api/auth/student/typing/*'`. Not fixed yet — it is a web bug too; raise it with Yasir as its own change.

## S8 — Cloudflare

- Confirm **Bot Fight Mode / Super Bot Fight Mode / WAF challenges** do not intercept `/api/*` requests from the app. A native client cannot solve a JavaScript challenge — the failure looks like a broken app on mobile data and nowhere else. Test on 4G before the first TestFlight build.

## S9 — Deep links (Universal Links / App Links)

- Serve `https://app.icsasystem.com/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`.
- **Put them in `client/public/.well-known/`** so every client build ships them — `deploy-client.sh` deletes everything in `server/public` except `uploads` on every deploy.
- `apple-app-site-association` must be served as `application/json` with **no redirect**; mind the 4-hour browser cache on unhashed files noted in the AMS CLAUDE.md.
- Then an AMS link in an email or WhatsApp (`/students/123`, `/marketing/leads?…`) opens in the app when it is installed, and in the browser when it is not.

## S10 — Receipt as a PDF for the share sheet

- `GET /api/enrollments/:id/receipt.pdf` — renders the existing receipt through `services/pdfRender` (the referrals/custom-report pattern: the print page rendered as the person asking, stamps read back).

## S11 — Photos from phones

- iPhones shoot **HEIC**. The app converts to JPEG before upload (`expo-image-manipulator`), so the AMS upload filters need no change. Keep it that way: one format on the server.

## S12 — Google and Apple sign-in from the app (Yasir ruled, 3 Nov 2026: in v1)

- **Today (read at AMS `43b55d0`):** `POST /api/auth/google` takes a Google ID token (`credential`), verifies it with `google-auth-library` against **one audience, `GOOGLE_CLIENT_ID`** (the web client), and signs in only an **existing, active** user whose `users.email` matches — no account is ever created. It has **no Turnstile**, so the app's Google path needs no captcha. Students arrive here too (`resolveSoleStudent` refuses an ambiguous one).
- **Google, add:** iOS and Android OAuth client IDs in the Google Cloud project. The native SDK may issue tokens whose audience is the app's client ID rather than the web one — **verify on a real device**, and if so pass `verifyIdToken` an **array of audiences** (web + iOS + Android, from `.env`). Additive: the web keeps its audience.
- **Apple, add:** `POST /api/auth/apple` — verify Apple's identity token (Apple's public keys, audience = the app's bundle id), then sign in the **linked** AMS user. **Email matching is not enough:** Apple can hide the address behind a private relay. So:
  - table `user_apple_ids` (`user_id`, `apple_sub` unique, `linked_at`, `revoked_at`);
  - a signed-in user links Apple once (**Me › Sign-in methods**); after that, the Apple button signs them in;
  - first-time Apple with a **real, verified** email matching exactly one active user may link automatically — the same match-only rule as Google; a relay address is refused with "Sign in with your ICSA password once, then link Apple in Me".
- **Both:** session = the device session (S2); audit the sign-in and every link/unlink (credentials tier — fail the request if the audit fails); add the paths to the student firewall where students use them.
- **App Review:** the Apple button must be at least as prominent as Google's, on the same screen.

---

## Not needed (already fine)

- **CORS** — the app is not a browser; `cors({ origin: '*' })` is irrelevant to it.
- **The token format** — already a `Bearer` header, no cookies.
- **Geofencing maths, branch radii, accuracy caps** — already server-side.
- **The notifications inbox** — exists; push rides on it.
- **Payment-proof upload by students** — exists (`POST /api/payment-proofs`, allowlisted).
