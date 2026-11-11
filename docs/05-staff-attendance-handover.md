# HANDOVER — Staff attendance in the ICSA app (phase 2)

**Written 11 Nov 2026** in the AMS chat, for the chat that builds the ICSA app (`~/Projects/icsa-mobile`).
**The AMS half is built and pushed. Nothing in the app has been changed for this** — the app chat owns all of it.

---

## 1. What this is

- ICSA staff **record their own working day in the ICSA app**: four taps a day — **Check in · Lunch out · Lunch in · Check out**.
- **The attendance machine is retired** — the app is the only way in (Yasir, 11 Nov 2026).
- The plan has 4 phases. This file covers **phase 2: the app**.
  - **Phase 1 — AMS server and Rules & offices page:** done.
  - **Phase 2 — the app:** this file.
  - **Phase 3 — the Today board (AMS web):** later.
  - **Phase 4 — the monthly reports (AMS web):** later.
- **Approved design:** canvas **"ICSA Staff & Attendance — mockups"**, https://claude.ai/artifact/UhiApH1adrSkKUWFyYyhZd, page **attendance-v2**.
  - **Board 3 "Four taps a day"** is the app: My day before check-in, at lunch, and one check failed.
  - A picture of it comes with this file: `staff-attendance-board3.png`.

## 2. Yasir's rulings (11 Nov 2026) — record them in HANDOVER.md as they stand

- **Office proof** = **location** (inside the branch circle) **and** the **office Wi-Fi router's hardware address (BSSID)**, read in the app. Both branches. **All four taps** need both. An **online day** needs neither.
- **One check fails → the tap is kept, marked for review.** A manager settles it.
- **Both checks fail → refused (409), nothing is stored.** This was Claude's reading, flagged to Yasir — **still to be confirmed with him**.
- **Checking again:** if both checks pass on a re-check, the review **clears by itself**. The first tap time is kept.
- **Rejected check-in → the day is absent.** What a rejected lunch or out tap does to the reports is **not ruled yet** (phase 4).
- **Lateness is report only** — no salary deduction. The person is late when they tap **more than 5 min after their own start time**; from then, every minute after the start counts.
- **Lunch grace:** 5 min over the person's own break.
- **Reminders go to the person only:**
  - **not checked in 10 min after their start time**;
  - **lunch ending 5 min before the break is up**.
  - Managers can switch either off on Rules & offices.
- **Thursday** is the usual day off. Hours, days off and break length come from each person's **working week** (AMS Users page), never from the app.
- **Staff with no working week** are left out of the reports. The app tells them to ask a manager.
- **Deferred, to raise after phase 4:** a website check-in as backup — a fixed IP at Mahboula, a reception code at City.

## 3. The AMS half — what exists, and its state

| Commit | What | State |
|---|---|---|
| `048b94f4` | Phase 1: tables, `/api/staff-attendance`, Rules & offices page, migration `2026-11-11-staff-attendance.sql` | Pushed. **Deploy steps given to Yasir; not confirmed deployed.** Migration to BOTH databases before the code. |
| `867b24fa` | For the app: `GET /me/today` also answers `upcoming` (next 14 working days) and `distance_m` on every tap | Pushed. Additive, no migration. Ships with the next `git pull` + restart. |

- **The Mac AMS copy (`~/Projects/icsa-system`) is at `1f1beea4`, behind both commits.**
  - The app's checks read that copy, so a check that pins these endpoints **could not run** until it is updated.
  - **Run on Mac:** `cd ~/Projects/icsa-system && git pull --ff-only` (it has two untracked items, `docs/new-chat-handover.md` and `quiz/`, which a pull does not touch).
- **Before testing on a phone, check the server has phase 1:**
  - **Run on server:** `curl -s -o /dev/null -w '%{http_code}\n' localhost:5000/api/staff-attendance/me/today`
  - **401** = the route is there. **404** = not deployed yet.

## 4. The API (all under `/api/staff-attendance`, Bearer token)

**Who:** every staff role — `manager, supervisor, accountant, teacher, marketer, cap_coordinator, invoice_encoder`. An academic supervisor gets in as a teacher.
- Students are refused (403), and none of these paths are in the student firewall's list.
- Manager-only paths are marked ★.

### `GET /me/today` — the person's day

```jsonc
{
  "date": "2026-11-11", "now": "09:24",              // Kuwait date and HH:MM
  "working": true, "reason": null,                    // or false + "no_week" | "day_off"
  "day": { "place": "office" | "online", "work_mode": "onsite" | "hybrid" | "online",
           "start_time": "09:30", "end_time": "18:30", "break_minutes": 60, "branch_id": "<uuid>" },  // null when not working
  "branch": { "id", "name", "latitude", "longitude", "radius_m" },   // the office day's branch, else null
  "taps": [ { "id", "kind": "in" | "lunch_out" | "lunch_in" | "out", "time": "09:24", "place",
              "branch_name", "location_ok", "wifi_ok", "review": "none" | "pending" | "cleared" | "accepted" | "rejected",
              "review_reason", "distance_m", "late_min" } ],
  "next": ["lunch_out", "out"],                       // the taps allowed now, in the AMS's order
  "upcoming": [ { "date": "2026-11-13", "place", "start_time", "end_time", "break_minutes" } ],  // next 14 working days, today excluded
  "rules": { "late_grace_min": 5, "lunch_grace_min": 5,
             "remind_not_in": true, "remind_not_in_after_min": 10,
             "remind_lunch_end": true, "remind_lunch_before_min": 5 }
}
```

- `next` is the AMS's order rule (`services/staffAttendance.nextKinds`). **Show the buttons it allows; never work out the order on the phone.**
- A day with **no break** has no lunch taps.
- After `lunch_out`, only `lunch_in` is allowed. After `out`, nothing.

### `POST /me/taps` — one tap

**Request**

```jsonc
{ "kind": "in", "latitude": 29.37, "longitude": 47.97, "accuracy": 12, "mocked": false,
  "bssid": "a4:2b:b0:7e:11:3c", "ssid": "ICSA-City", "app_platform": "ios" | "android" }
```

- ⚠️ **The fields are `latitude` / `longitude`, NOT `lat` / `lng`** (the student check-in uses `lat` / `lng`). The AMS reads them in `staffAttendanceController.readPosition`. **Pin this in a check.**
- **Send the BSSID exactly as the phone gives it:**
  - The AMS normalises it: an iPhone's `a4:2b:b0:7e:1:c` (leading zeros dropped) is padded.
  - Android's no-permission placeholder `02:00:00:00:00:00` is read as **no router**.
  - Never normalise on the phone.
- An online day needs no position or Wi-Fi.

**Answers**

- **201** — `{ tap: { id, kind, time, place, location_ok, wifi_ok, review, review_reason, distance_m, late_min }, next: [...] }`
  - `review: "pending"` = kept for review.
  - `review_reason` is the AMS's own sentence (e.g. "office Wi-Fi not found", "640 m from City Branch", "simulated").
- **409** — `{ code, error }`:
  - `NO_WEEK`, `DAY_OFF`, `ORDER`;
  - `NOT_AT_OFFICE` = both checks failed, nothing stored; it also carries `location_ok: false, wifi_ok: false`.
  - Show `error` as the AMS wrote it.
- A **mocked** position never passes the location check: that tap is kept for review, never refused for it alone.

### `POST /me/taps/:id/recheck` — "Check the Wi-Fi again" (today's pending taps only)

- **Request:** the same position and Wi-Fi fields as a tap.
- **Answer:** `{ cleared, location_ok, wifi_ok, reason }`. When `cleared` is true, both checks passed and the review cleared itself.
- **409** when the tap is not pending, or not today's.

### ★ `GET /offices` — the branches and their routers (for Me › Office Wi-Fi)

- **Answer:** `{ seen_days: 30, branches: [{ id, name, has_location, radius_m, routers: [...], ignored: [...], unknown: [...] }] }`
  - Each router: `{ id, bssid, ssid, label, status, added_how, added_on, added_by_name, last_seen_at }`.
  - `unknown` = routers seen at check-ins inside that branch's circle that are not on file.

### ★ `POST /routers` — "Add this router"

- **Request:** `{ branch_id, bssid, ssid, label?, latitude, longitude, accuracy, mocked }`.
- **Evidence the AMS requires** (`addRouter`): the manager's phone **inside that branch's circle** (not mocked), or a check-in in the last 30 days that saw that router there.
  - A typed address with neither → **409** "Add a router from the ICSA app while standing in <branch>…".
  - Already on file → **409** naming the branch.
- **Answer:** **201** `{ id, bssid, status, added_how: "app" | "seen" }`.

### ★ `DELETE /routers/:id`

- Removal is a timestamp, never a delete. The web page (Rules & offices) already has Remove.
- **Suggestion:** leave removal to the web, unless Yasir wants it in the app.

★ `GET /reviews`, `POST /taps/:id/decide`, `GET` and `PUT /rules` are the web's (phase 3 and Rules & offices) — not needed in the app.

## 5. The screens (board 3)

- **My day** (pushed screen, back link to where it was opened):
  - **Heading:** "My day", then "Wednesday, 11 Nov 2026 · City Branch" under it.
  - **Today's hours card:** "9:30 AM – 6:30 PM", "Lunch 60 min · at the office", and an **On-site** / **Online** pill.
  - **Office check card:** Location (the branch) and Office Wi-Fi, with "Read only when you tap — never in the background."
  - **The one button** is the next tap, in ICSA yellow: **Check in** (with "9:24 AM · on time" under it), **Lunch out**, **Back from lunch**, **Check out**.
    - The mockup notes say **an online day shows "Start work"** with no office check.
  - **On lunch card:**
    - "Since 1:32 PM · back by 2:32 PM".
    - A minutes bar out of the break.
    - "More than {break + lunch grace} min counts as over-break on your monthly report."
  - **Kept for review card:**
    - Location ✓/✗ and Office Wi-Fi ✗, each with its reason (e.g. "your phone is on mobile data").
    - Yellow note: "Your check-in is saved. Only one office check passed, so a manager will look at it."
    - Outline button **Check the Wi-Fi again**, with "Join ICSA-City Wi-Fi, then tap. If both checks pass now, the review clears by itself."
  - **Timeline of the four taps:** each tap's time or "—", with a line under it:
    - for a tap still to come: "Location and office Wi-Fi";
    - for a tap made: "On time · Location ✓ Wi-Fi ✓";
    - for Lunch in while on lunch: "Due by 2:32 PM";
    - for Check out: "From 6:30 PM".
- **Me › Office Wi-Fi** (managers):
  - Each branch's routers.
  - **Add this router:** read the position and Wi-Fi when tapped, show the network name and address, pick the branch, then send.
  - The web page's own help text: "1. Stand inside the branch, connected to its Wi-Fi. 2. In the ICSA app: Me › Office Wi-Fi › Add this router. 3. Repeat in each room with its own router — each band has its own address."

## 6. What Claude found in the app that bears on this (recon, 11 Nov 2026)

- **Where My day can open from:**
  - **Teachers:** their **Today** tab (`src/teacher/TodayScreen.tsx`), as the mockup shows.
  - **Reception, marketers and managers:** their first tabs are still **placeholders** (`TabPlaceholder`), so a "My day" card there, and/or a **Me › My day** row for every staff view.
  - A pushed screen at the root like `src/app/mark-class.tsx` fits (`/my-day`, `/office-wifi`).
- ⚠️ **Accountant, CAP coordinator and invoice encoder have no app view.** They land on `src/app/web-only.tsx`.
  - With the machine retired, **they cannot check in** unless that screen gets My day.
  - **Decision for Yasir** — recommended: give the web-only screen a My day card plus Sign out.
- ⚠️ **The app's CLAUDE.md says "Location … Never staff."**
  - That ruling (3 Nov 2026) was about **background geofence reminders**.
  - Staff taps read location **in the foreground, at the tap**, under the 11 Nov 2026 ruling.
  - Reword the rule so the two don't read as a contradiction.
- **Board 3 screen 1 shows the office check results before the tap.** The student check-in deliberately did not do this ("no 'You are 42 m from ICSA City' before checking in"), because it means reading the location before the tap.
  - **Recommended, same reason:** before the tap, show *what* will be checked; show the results after the tap.
  - Confirm with Yasir.
- **Lateness shown before the tap** ("9:24 AM · on time") is a copy of the AMS's `lateMinutes`.
  - Keep it display-only.
  - **Hold it to the AMS's own function in a check:** `server/src/services/staffAttendance.js` is pure CommonJS, so the check can `require` it from the AMS copy and compare across every minute pair.
- **Checks to update:**
  - `src/teacher/today.check.ts` §1b keeps a `TABLES` list of every API table and requires every `pathFor(TABLE.key.path, {…})` call site to name its table — **register the new staff API table there**, or §1b fails on the recheck path's `:id`.
  - `src/navigation/tabs.check.ts` censuses route files per tab set.

## 7. Native pieces (versions from Expo SDK 58's own list)

- **Wi-Fi address: `@react-native-community/netinfo` `12.0.1`.**
  - Call `NetInfo.configure({ shouldFetchWiFiSSID: true })`, then `NetInfo.fetch('wifi')` → `details.bssid` / `details.ssid`.
  - **iOS:** needs the entitlement `com.apple.developer.networking.wifi-info` (`app.json` → `ios.entitlements`) **and** location permission granted (precise). Without either, no BSSID.
    - With automatic signing, Xcode adds "Access Wi-Fi Information" to the `us.icsa.app` App ID. Check it in the Apple Developer portal if signing complains.
  - **Android:**
    - Its manifest adds `ACCESS_WIFI_STATE` and `ACCESS_NETWORK_STATE`.
    - The BSSID also needs `ACCESS_FINE_LOCATION` (expo-location already has it) and location services on. Otherwise it reports `02:00:00:00:00:00`.
  - ⚠️ **NetInfo throws at import when its native module is missing** — a JS bundle loaded before the native rebuild crashes.
    - Require it lazily inside a `try`, so an old build degrades to "Wi-Fi cannot be read on this version" instead.
    - The same applies to expo-notifications.
- **Reminders: `expo-notifications` `~58.1.7` — local notifications only** (no push server needed).
  - Plan them from `GET /me/today`:
    - **today:** if no `in` tap yet and the time is before start + 10, schedule at start + `remind_not_in_after_min`;
    - **each `upcoming` day:** the same, at its start + 10;
    - **after Lunch out:** at lunch-out time + `break_minutes` − `remind_lunch_before_min`.
  - Use fixed ids (e.g. `staff-in-<date>`, `staff-lunch-<date>`). Re-plan on every My day load and every tap.
  - Cancel today's on Check in, and the lunch one on Lunch in.
  - **Cancel all of them on sign-out** (`SessionContext.signOut`), or the next person's phone keeps the last person's reminders.
  - If a rule is switched off, cancel that kind.
  - Times are Kuwait wall-clock: build each instant as `<date>T<HH:MM>:00+03:00` (Kuwait has no daylight saving), never in the phone's own zone.
  - **No personal data on the lock screen:** "You have not checked in yet — your day started at 9:30 AM." is fine.
  - **iOS:** the plugin adds `aps-environment` (push entitlement) by default — harmless. Use `enableRemoteNotifications: false` if push should stay off until the push phase.
  - **Android:** the module declares `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`, so schedules survive a restart. Without `SCHEDULE_EXACT_ALARM` it falls back to inexact alarms, so a reminder may come a few minutes late in Doze. Recommended: accept that rather than ask for the exact-alarm permission.
- **New native modules mean `npx expo install …` on the Mac, then `npx expo prebuild --clean` and a rebuild** (the app's own rule).
  - Don't `npm install` from the Linux shell into the Mac's `node_modules` (platform-specific packages).

## 8. Store and privacy

- **ICSA 1.0 (build 4) is waiting for App Review.**
  - Staff attendance must **not** go into a 1.0 resubmission.
  - It is **1.1.0, build 5** (Play: next `versionCode`), after 1.0 is through.
  - If 1.0 needs a fix build while this work is in the tree, that build would carry it. **Plan the order with Yasir.**
- **Permission texts to update** (`app.json` → expo-location): today they say location is read "only when you tap Check in". That must cover staff taps and Add this router. Add the notification and Wi-Fi wording where the platform asks.
- **App Privacy (Apple) and Data safety (Play):** location now also serves staff attendance; the Wi-Fi network name and address are collected with a tap. Update both.
- **Privacy policy** (icsa.us/privacy_policy, clause 02 "The ICSA mobile app") says location is used only at Check in.
  - It needs a staff-attendance line (location and office Wi-Fi at each tap, kept with the attendance record), approved by Yasir first.
  - It is a Site Page; AMS edits go through Claude in Chrome.
  - **Since `8fe509e8` (11 Nov 2026), Site Pages saves are recorded in the Audit Log** — the gap noted in HANDOVER.md is fixed. **Once Yasir deploys it**, update that note.

## 9. For You (Yasir) — before the app chat starts

1. **Deploy the AMS phase 1** if not done yet (migration to both databases first, then the code). The steps are in the AMS chat.
   - Then pull again for `867b24fa`: **Run on server:** `cd ~/icsa-system && git pull && pm2 restart icsa-server`.
2. **Run on Mac:** `cd ~/Projects/icsa-system && git pull --ff-only`, so the app's checks see the new endpoints.
3. **Set working weeks** on the AMS Users page for the staff who will test. With no week, the app can only say "ask a manager".
4. **Add the routers:** once the app has Office Wi-Fi, stand in each branch and add every router — each band has its own address.
5. **Decide in the app chat:**
   - My day for accountant, CAP coordinator and invoice encoder (recommended: yes);
   - office check results before or after the tap (recommended: after);
   - router removal in the app or web only (recommended: web only);
   - and confirm "both checks fail → refused".

## 10. Where things are (AMS)

- `server/src/routes/staffAttendance.js` — the paths and roles.
- `server/src/controllers/staffAttendanceController.js` — `getMyDay`, `tap`, `recheck`, `getOffices`, `addRouter`, `readPosition` (field names).
- `server/src/services/staffAttendance.js` — the one owner of the rules: `KINDS`, `KIND_LABEL`, `nextKinds`, `orderRefusal`, `judgeProofs`, `lateMinutes`, `normaliseBssid`, `RULE_DEFAULTS`.
- `migrations/2026-11-11-staff-attendance.sql` — `staff_attendance_taps`, `staff_office_routers`, `settings.staff_attendance_rules`.
- `server/src/services/__checks__/staff-attendance.check.js` — 73 assertions, including §8 for what the app reads.
- `client/src/pages/staffAttendance/RulesOffices.js` — the manager's web page (menu "Staff Attendance").
- AMS `CLAUDE.md` → Migrations → **11 Nov 2026 staff attendance** — the full load-bearing list.
