# For the AMS chat — add "This week" to `GET /dashboard` (from the ICSA app chat, 14 Nov 2026)

**One small, read-only server change.** No migration, no money, no new route. The app chat does not edit the AMS: this note is the hand-off.

## What Yasir decided (14 Nov 2026)

- The app's **manager Dashboard** shows **Today · This week · This month** (Year is dropped from the app; the website keeps it).
- **ICSA's week runs Friday to Wednesday; Thursday is off.**
- **"This week" = the most recent Friday up to today.** On a Thursday it is the Friday–Wednesday just finished (the 7 days Friday → Thursday).

## The change

File: `server/src/controllers/dashboardController.js` (AMS copy read at `2ee9f056`).

1. **`periodClauses(period)`** — add a `'week'` branch beside `today` / `year` / month:
   - Week start, one SQL expression (the session timezone is already `Asia/Kuwait`, set in `config/db.js`, so `CURRENT_DATE` is Kuwait's day):
     - `(CURRENT_DATE - ((EXTRACT(DOW FROM CURRENT_DATE)::int + 2) % 7))`
     - DOW is Sun 0 … Sat 6, so days since Friday = `(dow + 2) % 7`: **Fri 0 · Sat 1 · Sun 2 · Mon 3 · Tue 4 · Wed 5 · Thu 6**.
   - `dateClause(col)` → `${col} >= <week start> AND ${col} < <week start> + 7`
   - `timestampClause(col)` → `${col} >= <week start> AND ${col} < <week start> + INTERVAL '7 days'`
   - `label: 'week'`
   - Suggest one named constant for the expression (e.g. `ICSA_WEEK_START_SQL`) with a comment: *Friday to Thursday; Thursday is the day off (Yasir, 14 Nov 2026).*
2. **`getDashboard`** — `const validPeriods = ['today', 'week', 'month', 'year'];`
   - The answer's `scope.period` then says `'week'`. **The app labels its figures by `scope.period`**, so until this is deployed the app never shows month figures as "this week".
3. **Leave alone:** the teacher and student dashboards (their own `validPeriods`), branch scoping, the today-fixed figures (check-ins, sessions), what is owed (period-independent), the 30-day chart.
4. **Optional, Yasir's call:** the website Dashboard (`client/src/pages/dashboard/Dashboard.js`: `VALID_PERIODS`, `periodLabel`, `periodStartISO`) could offer "This week" too. The app does not need it.

## A check (AMS house style)

- Spot-check the expression on the database for a full week, e.g.:
  - `SELECT d::date, (d::date - ((EXTRACT(DOW FROM d)::int + 2) % 7)) AS week_start FROM generate_series(DATE '2026-11-12', DATE '2026-11-20', INTERVAL '1 day') d;`
  - Expected: **Thu 12 Nov 2026 → Fri 6 Nov 2026**; **Fri 13 Nov 2026 through Thu 19 Nov 2026 → Fri 13 Nov 2026**; **Fri 20 Nov 2026 → Fri 20 Nov 2026**.
- A `__checks__` script asserting `validPeriods` includes `'week'` and the clause uses the Friday expression.

## Deploy

- Server code only: no migration. The AMS's standing deploy rules apply.

## Tell the app chat when done

- The AMS commit id and that it is deployed. Yasir then pulls `~/Projects/icsa-system` on the Mac.
- The app chat then adds the **This week** switch; its check (`src/manager/reports.check.ts` §2) reads the new `validPeriods` and the Friday expression from the AMS copy.
