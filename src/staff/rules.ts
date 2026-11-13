// Staff attendance — the rules My day follows (13 Nov 2026). Pure — no React
// Native — so staff.check.ts runs it under Node and holds it to the AMS's own
// service (server/src/services/staffAttendance.js) and routes.
//
// The AMS decides every tap: which tap may come next (`next`), whether the
// person is at the office (location AND the office Wi-Fi router), lateness,
// and what is kept for review. Nothing here can let a tap through that the
// AMS would refuse; these rules only decide what to show and what to send.
//
// Yasir's rulings (11 Nov 2026): four taps a day — Check in · Lunch out ·
// Lunch in · Check out; every office tap needs the branch circle and the
// office Wi-Fi router; one or both failing → kept for review; a passing
// re-check clears the review by itself; an online day needs neither; the
// location is read only at a tap, never before (the results are shown after
// the tap); reminders go to the person only.

import { formatClock } from '../attendance/rules.ts';

// ── The AMS endpoints (every staff role; ★ = manager only) ──────────────────

export const STAFF_API = {
  today: { method: 'GET', path: '/staff-attendance/me/today' },
  tap: { method: 'POST', path: '/staff-attendance/me/taps' },
  recheck: { method: 'POST', path: '/staff-attendance/me/taps/:id/recheck' },
  offices: { method: 'GET', path: '/staff-attendance/offices' }, // ★
  addRouter: { method: 'POST', path: '/staff-attendance/routers' }, // ★
  removeRouter: { method: 'DELETE', path: '/staff-attendance/routers/:id' }, // ★
} as const;

// ── What the AMS sends ──────────────────────────────────────────────────────

export type TapKind = 'in' | 'lunch_out' | 'lunch_in' | 'out';
export const KINDS: readonly TapKind[] = ['in', 'lunch_out', 'lunch_in', 'out'];
export type Review = 'none' | 'pending' | 'cleared' | 'accepted' | 'rejected';

export type DayTap = {
  id: string;
  kind: TapKind;
  time: string; // "HH:MM", Kuwait
  place: 'office' | 'online';
  branch_name: string | null;
  location_ok: boolean | null;
  wifi_ok: boolean | null;
  review: Review;
  review_reason: string | null;
  distance_m: number | null;
  late_min: number;
};

export type DayRules = {
  late_grace_min: number;
  lunch_grace_min: number;
  remind_not_in: boolean;
  remind_not_in_after_min: number;
  remind_lunch_end: boolean;
  remind_lunch_before_min: number;
};

export type UpcomingDay = { date: string; place: 'office' | 'online'; start_time: string; end_time: string; break_minutes: number };

export type MyDay = {
  date: string; // "YYYY-MM-DD", Kuwait
  now: string; // "HH:MM", Kuwait, when the AMS answered
  working: boolean;
  reason: 'no_week' | 'day_off' | null;
  day: {
    place: 'office' | 'online';
    work_mode: 'onsite' | 'hybrid' | 'online';
    start_time: string;
    end_time: string;
    break_minutes: number;
    branch_id: string | null;
  } | null;
  branch: { id: string; name: string; latitude: number | null; longitude: number | null; radius_m: number } | null;
  taps: DayTap[];
  next: TapKind[];
  upcoming?: UpcomingDay[];
  rules: DayRules;
};

export type TapAnswer = {
  tap: Omit<DayTap, 'branch_name'>;
  next: TapKind[];
};

export type RecheckAnswer = { cleared: boolean; location_ok: boolean; wifi_ok: boolean; reason: string | null };

// ── Labels — the AMS's KIND_LABEL, word for word (staff.check holds it) ─────

export const KIND_LABEL: Record<TapKind, string> = {
  in: 'Check in',
  lunch_out: 'Lunch out',
  lunch_in: 'Back from lunch',
  out: 'Check out',
};

/** The button for the next tap. An online day starts and ends work, with no office check. */
export function tapButton(kind: TapKind, place: 'office' | 'online'): string {
  if (place === 'online') {
    if (kind === 'in') return 'Start work';
    if (kind === 'out') return 'Finish work';
  }
  return KIND_LABEL[kind];
}

/** Why there is no working day, in the AMS's own words. */
export const NOT_WORKING: Record<'no_week' | 'day_off', string> = {
  no_week: 'You have no working week on record yet. Ask a manager to set it on the Users page.',
  day_off: 'Today is a day off on your working week.',
};

// ── Times (Kuwait wall clock; Kuwait has no daylight saving) ────────────────

export function minutesOf(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function hhmmOf(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Display only — a copy of the AMS's lateMinutes (services/staffAttendance.js),
 * held to it minute by minute by staff.check. The AMS records the real figure.
 * Late = in more than the grace after the person's own start; then every
 * minute after the start counts.
 */
export function lateMinutes(tapHHMM: string, startHHMM: string, graceMin: number): number {
  const t = minutesOf(tapHHMM);
  const s = minutesOf(startHHMM);
  if (t == null || s == null) return 0;
  const after = t - s;
  return after > graceMin ? after : 0;
}

/** "on time" / "7 min late" / "4 h 32 min late" — the AMS counts minutes; an hour or more reads as hours. */
export function lateWord(lateMin: number): string {
  if (lateMin <= 0) return 'on time';
  if (lateMin < 60) return `${lateMin} min late`;
  const h = Math.floor(lateMin / 60);
  const m = lateMin % 60;
  return m ? `${h} h ${m} min late` : `${h} h late`;
}

/** A tap as a noun, for "Your check-in is saved." */
export const KIND_NOUN: Record<TapKind, string> = {
  in: 'check-in',
  lunch_out: 'lunch out',
  lunch_in: 'return from lunch',
  out: 'check-out',
};

/**
 * The AMS's review reason, without the "Kept for review:" its card heading
 * already says — "Office Wi-Fi not recognised." The AMS's own words otherwise.
 */
export function reasonLine(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const r = reason.replace(/^Kept for review:\s*/i, '').trim();
  return r ? r[0].toUpperCase() + r.slice(1) : null;
}

/** "9:30 AM – 6:30 PM". */
export function hours(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatClock(start);
  const b = formatClock(end);
  return a && b ? `${a} – ${b}` : a || b;
}

/** "Lunch 60 min · at the office" / "No lunch break · online". */
export function dayLine(day: NonNullable<MyDay['day']>): string {
  const lunch = day.break_minutes > 0 ? `Lunch ${day.break_minutes} min` : 'No lunch break';
  return `${lunch} · ${day.place === 'online' ? 'online' : 'at the office'}`;
}

// ── The day, as the screen draws it ─────────────────────────────────────────

export function tapOf(day: MyDay, kind: TapKind): DayTap | null {
  return day.taps.find((x) => x.kind === kind) ?? null;
}

/** The one button: the first tap the AMS allows now, or null when the day is done. */
export function nextTap(day: MyDay): TapKind | null {
  return day.working ? (day.next[0] ?? null) : null;
}

/** On lunch now: since when, back by when, and the over-break line. */
export function lunchNow(day: MyDay): { since: string; backBy: string; usedMin: number; breakMin: number; overAfterMin: number } | null {
  if (!day.day) return null;
  const out = tapOf(day, 'lunch_out');
  if (!out || tapOf(day, 'lunch_in')) return null;
  const start = minutesOf(out.time);
  const now = minutesOf(day.now);
  if (start == null) return null;
  return {
    since: formatClock(out.time),
    backBy: formatClock(hhmmOf(start + day.day.break_minutes)),
    usedMin: now == null ? 0 : Math.max(0, now - start),
    breakMin: day.day.break_minutes,
    overAfterMin: day.day.break_minutes + day.rules.lunch_grace_min,
  };
}

/** Today's taps waiting for a manager's review — the ones "Check the Wi-Fi again" may clear. */
export function pendingTaps(day: MyDay): DayTap[] {
  return day.taps.filter((x) => x.review === 'pending');
}

const tick = (ok: boolean | null) => (ok ? '✓' : '✗');

/** "On time · Location ✓ Wi-Fi ✓" — a tap made. */
export function madeLine(tap: DayTap): string {
  const parts: string[] = [];
  if (tap.kind === 'in') parts.push(lateWord(tap.late_min).replace(/^o/, 'O'));
  if (tap.place === 'online') parts.push('Online');
  else parts.push(`Location ${tick(tap.location_ok)} Wi-Fi ${tick(tap.wifi_ok)}`);
  if (tap.review === 'pending') parts.push('kept for review');
  else if (tap.review === 'cleared') parts.push('review cleared');
  else if (tap.review === 'accepted') parts.push('accepted');
  else if (tap.review === 'rejected') parts.push('rejected');
  return parts.join(' · ');
}

export type TimelineRow = { kind: TapKind; label: string; time: string; line: string; done: boolean };

/** The day's taps in order: two without a break, four with one. */
export function timeline(day: MyDay): TimelineRow[] {
  if (!day.day) return [];
  const d = day.day;
  const kinds: TapKind[] = d.break_minutes > 0 ? ['in', 'lunch_out', 'lunch_in', 'out'] : ['in', 'out'];
  const lunch = lunchNow(day);
  return kinds.map((kind) => {
    const tap = tapOf(day, kind);
    const label = tapButton(kind, d.place);
    if (tap) return { kind, label, time: formatClock(tap.time), line: madeLine(tap), done: true };
    let line = d.place === 'online' ? 'No office check' : 'Location and office Wi-Fi';
    if (kind === 'lunch_in' && lunch) line = `Due by ${lunch.backBy}`;
    else if (kind === 'out') line = `From ${formatClock(d.end_time)}`;
    return { kind, label, time: '—', line, done: false };
  });
}

// ── What a tap sends (the AMS reads latitude / longitude — NOT lat / lng) ───

export type Fix = { lat: number; lng: number; accuracy: number | null; mocked?: boolean };
export type Wifi = { bssid: string | null; ssid: string | null };

/**
 * One tap's body. The position and Wi-Fi go as the phone gave them — the AMS
 * normalises the router address (an iPhone drops leading zeros; Android's
 * no-permission placeholder means no router). An online day sends neither.
 */
export function tapBody(kind: TapKind, fix: Fix | null, wifi: Wifi | null, platform: 'ios' | 'android'): Record<string, unknown> {
  return { kind, ...proofBody(fix, wifi), app_platform: platform };
}

/** The proof fields alone — a re-check and Add this router send the same. */
export function proofBody(fix: Fix | null, wifi: Wifi | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (fix) {
    out.latitude = fix.lat;
    out.longitude = fix.lng;
    if (fix.accuracy != null) out.accuracy = fix.accuracy;
    out.mocked = fix.mocked === true;
  }
  if (wifi?.bssid) out.bssid = wifi.bssid;
  if (wifi?.ssid) out.ssid = wifi.ssid;
  return out;
}

// ── Reminders (local notifications, planned from My day) ────────────────────

export type Reminder = { id: string; at: string; title: string; body: string };

/** "2026-11-13T09:40:00+03:00" — Kuwait wall clock, never the phone's own zone. */
export function kuwaitInstant(date: string, hhmm: string): string {
  return `${date}T${hhmm}:00+03:00`;
}

/**
 * The reminders this phone should hold now (Yasir, 11 Nov 2026 — the person
 * only, no personal data on the lock screen): not checked in some minutes
 * after the start, today and each upcoming working day; and lunch ending a few
 * minutes before the break is up. Only instants still ahead of the AMS's now.
 * Re-planned on every My day load and every tap; every staff-* reminder is
 * cancelled first, and all of them on sign-out.
 */
export function reminderPlan(day: MyDay | null): Reminder[] {
  if (!day) return [];
  const out: Reminder[] = [];
  const now = minutesOf(day.now) ?? 0;
  const r = day.rules;
  const notIn = (date: string, start: string, isToday: boolean) => {
    const s = minutesOf(start);
    if (s == null) return;
    const at = s + r.remind_not_in_after_min;
    if (at >= 1440 || (isToday && at <= now)) return;
    out.push({
      id: `staff-in-${date}`,
      at: kuwaitInstant(date, hhmmOf(at)),
      title: 'ICSA',
      body: `You have not checked in yet — your day started at ${formatClock(start)}.`,
    });
  };
  if (r.remind_not_in) {
    if (day.working && day.day && !tapOf(day, 'in')) notIn(day.date, day.day.start_time, true);
    for (const u of day.upcoming ?? []) if (u.date > day.date) notIn(u.date, u.start_time, false);
  }
  if (r.remind_lunch_end && day.day) {
    const out_ = tapOf(day, 'lunch_out');
    const start = minutesOf(out_?.time);
    if (out_ && start != null && !tapOf(day, 'lunch_in')) {
      const at = start + day.day.break_minutes - r.remind_lunch_before_min;
      if (at > now && at < 1440) {
        out.push({
          id: `staff-lunch-${day.date}`,
          at: kuwaitInstant(day.date, hhmmOf(at)),
          title: 'ICSA',
          body: `Your lunch break ends at ${formatClock(hhmmOf(start + day.day.break_minutes))}.`,
        });
      }
    }
  }
  return out;
}

export const REMINDER_PREFIX = 'staff-';

// ── Location and Wi-Fi notes, in the person's words ─────────────────────────

export type WifiNote = 'not_available' | 'not_wifi' | 'no_address';

export const WIFI_NOTES: Record<WifiNote, string> = {
  not_available: 'This version of the app cannot read the Wi-Fi. Update ICSA from the store.',
  not_wifi: 'Your phone is not on Wi-Fi — join the office Wi-Fi, then tap again.',
  no_address: 'The phone did not give the Wi-Fi router’s address. Allow precise location for ICSA, then tap again.',
};

// ── Office Wi-Fi (managers): the branches' routers ──────────────────────────

export type OfficeRouter = {
  id: string;
  bssid: string;
  ssid: string | null;
  label: string | null;
  status: 'office' | 'ignored';
  added_how: 'app' | 'seen' | string;
  added_on: string | null;
  added_by_name: string | null;
  last_seen_at: string | null;
};
export type SeenRouter = { branch_id: string; bssid: string; ssid: string | null; times: number; last_seen_at: string | null };
export type OfficeBranch = {
  id: string;
  name: string;
  has_location: boolean;
  radius_m: number;
  routers: OfficeRouter[];
  ignored: OfficeRouter[];
  unknown: SeenRouter[];
};
export type Offices = { seen_days: number; branches: OfficeBranch[] };

/** "ICSA-City · a4:2b:b0:7e:11:3c" — a router as a person tells it apart. */
export function routerName(r: { ssid: string | null; label?: string | null; bssid: string }): string {
  return [r.label || r.ssid, r.bssid].filter(Boolean).join(' · ');
}

/** Add this router's body: the branch, the router, and the manager's own position as the evidence. */
export function addRouterBody(branchId: string, wifi: Wifi, fix: Fix | null, label: string | null): Record<string, unknown> {
  return { branch_id: branchId, ...proofBody(fix, wifi), ...(label ? { label } : {}) };
}
