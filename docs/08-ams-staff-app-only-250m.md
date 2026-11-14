# AMS → ICSA app: staff check in through the app only, 250 m area (14 Nov 2026)

From the AMS chat. Nothing here asks for an app release unless one of the
"Check in the app" items below says so.

## Yasir's rulings, 14 Nov 2026

- **Staff check in ONLY through the ICSA app.** No website or computer
  check-in. The AMS website's My Day page, office networks and office PCs
  are removed.
- **The staff check-in area is 250 m from the branch, plus the allowance for a
  weak GPS reading.** That allowance is the students' widening: the phone's
  reported accuracy, capped at 150 m. So the furthest a staff tap can pass is
  400 m, and only on a very weak reading.
- **Staff only.** Students keep their own radius. `/attendance/my-context`
  is unchanged.

## What changed on the server (AMS commit `5183bc65`)

- **`POST /api/staff-attendance/me/taps` and `/me/taps/:id/recheck`** refuse
  a body with `client: 'web'`. The answer is **403 `{ code: 'APP_ONLY' }`**,
  given before anything is read. The app never sends `client: 'web'`, so
  nothing changes for it.
- **The staff circle is the same for every branch.** It is `office_radius_m`
  from the staff rules: 250 by default, and a manager can change it on Rules &
  offices ("Check-in area"). A branch's own `gps_radius_m` is no longer used
  for staff. That radius stays the students'.
- **`GET /api/staff-attendance/me/today`:**
  - `branch.radius_m` is now that staff area (250).
  - New field **`branch.allowance_max_m`** (150).
  - **`this_computer` is gone.** It was website-only.
- **"Add this router" (`POST /routers` with the manager's position)** now
  judges "inside the branch" on the same staff circle.
- **The tap answer is unchanged.** `location_ok`, `review`, `review_reason`
  and `distance_m` mean what they did. A tap outside the area is still KEPT
  for review, never refused.

## Check in the app

1. **The staff map circle.** If it is drawn from `/me/today`'s
   `branch.radius_m`, it is already right (250 m) with no release. If it is
   hardcoded, or drawn from the student `my-context` branches, it needs
   changing to `branch.radius_m`.
2. **Optional:** draw the allowance as a faint outer ring
   (`radius_m + min(accuracy, allowance_max_m)`), or say "within 250 m of
   the branch".
3. **Any client-side "you're too far" check** before tapping must use the
   same numbers, or drop it. The server decides, and keeps every tap.
4. **The My day card** for accountant, CAP coordinator and invoice encoder
   is now the ONLY way they check in. The website no longer offers it.
5. **Nothing in the app should mention checking in on the website.**
