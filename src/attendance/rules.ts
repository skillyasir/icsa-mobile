// The student's check-in, as rules the screens follow (Phase 2 piece 1, 6 Nov
// 2026). Pure — no React Native — so rules.check.ts can run it under Node and
// hold it to the AMS's own controller and web pages.
//
// The AMS decides every check-in: it measures the distance, applies the
// radius, refuses outside office hours, and marks a simulated location for
// review. Nothing here can let a check-in through that the AMS would refuse;
// these rules only decide what to ask for, what to show, and what to send.
//
// Yasir ruled, 6 Nov 2026:
//   - the location is read ONLY when the student taps Check in;
//   - a location the phone reports as simulated is sent, recorded and marked
//     for review — never refused by the app (the AMS keeps it pending_review);
//   - a real map: Apple Maps on iPhone, Google Maps on Android.

import type { AttendanceStatus, Branch, TodaysAttendance, WindowState } from './types';

// ── The AMS endpoints this piece calls (all in the student firewall's list) ──

export const ATTENDANCE_API = {
  context: { method: 'GET', path: '/attendance/my-context' },
  history: { method: 'GET', path: '/attendance/my-history' },
  checkIn: { method: 'POST', path: '/attendance/check-in' },
  checkOut: { method: 'POST', path: '/attendance/check-out' },
  myTeacher: { method: 'POST', path: '/attendance/my-teacher' },
  dashboard: { method: 'GET', path: '/auth/student/dashboard' },
} as const;

// ── Location: when it is asked for ──────────────────────────────────────────

/**
 * What a check-in needs, by how the student attends. The same three answers
 * as the website (client/src/lib/geolocation.js withLocation):
 *   classroom → required: no position, no check-in (the AMS refuses one).
 *   hybrid    → asked: a position decides branch or Online; without one the
 *               student is asked before it is recorded as Online.
 *   online    → none: the location is not read at all.
 * An enrolment with no mode is classroom — the AMS's own default.
 */
export type LocationPlan = 'required' | 'asked' | 'none';

export function locationPlan(mode: string | null | undefined): LocationPlan {
  const m = mode || 'classroom';
  if (m === 'online') return 'none';
  if (m === 'hybrid') return 'asked';
  return 'required';
}

/** The button: an online student is not checking in anywhere. */
export function checkInLabel(mode: string | null | undefined): string {
  return mode === 'online' ? "I'm in my online class" : 'Check in';
}

/** Why a phone gave no position, in the student's words. */
export type LocationFailure = 'denied' | 'services_off' | 'timeout' | 'unavailable';

export const LOCATION_MESSAGES: Record<LocationFailure, string> = {
  denied: 'Location is off for ICSA. Allow it in Settings, then try again.',
  services_off: 'Location services are off on this phone. Turn them on, then try again.',
  timeout: 'Your phone took too long to find your location. Try again.',
  unavailable: 'Your phone could not find your location. Make sure GPS is on, then try again.',
};

/** How long the phone may take to find a position, as on the website. */
export const LOCATION_TIMEOUT_MS = 15_000;

// ── Batch classes: the check-in window ──────────────────────────────────────

/** Whether a batch check-in can be made now, and if not, what to say. */
export function batchGate(state: WindowState | null | undefined): { open: boolean; note: string | null } {
  switch (state) {
    case 'open':
      return { open: true, note: null };
    case 'not_yet_open':
      return { open: false, note: 'Check-in opens shortly before class.' };
    case 'closed':
      return { open: false, note: 'Check-in has closed for this class.' };
    default:
      return { open: false, note: 'No class today.' };
  }
}

// ── Today's check-in: what it says, and what may change ─────────────────────

/**
 * The statuses a student may still move to the right teacher, today only.
 * The AMS's own list (attendanceController STUDENT_CHANGEABLE); the AMS
 * decides, this only keeps the link off a check-in it would refuse.
 */
export const STUDENT_CHANGEABLE: readonly string[] = ['pending', 'present', 'late'];

export function canChangeTeacher(a: Pick<TodaysAttendance, 'check_in_method' | 'session_id' | 'status'> | null): boolean {
  if (!a) return false;
  return a.check_in_method === 'student_self' && !a.session_id && STUDENT_CHANGEABLE.includes(a.status);
}

/** True when the change sends a teacher's mark back to waiting — the student is told first. */
export function changeUndoesMark(status: string): boolean {
  return status !== 'pending';
}

export type Tone = 'info' | 'success' | 'warning' | 'danger';

/** The line under "You're checked in" — or the day's result once a teacher has marked it. */
export function statusView(
  status: AttendanceStatus | string,
  mode: 'classroom' | 'online' | null,
  teacher: string | null,
): { tone: Tone; text: string } {
  const who = teacher || 'your teacher';
  switch (status) {
    case 'pending':
      return mode === 'online'
        ? { tone: 'warning', text: `Marked in — ${who} confirms during class` }
        : { tone: 'warning', text: `Waiting for ${who} to confirm` };
    case 'pending_review':
      return { tone: 'warning', text: 'Awaiting review — your phone reported its location as simulated' };
    case 'present':
      return { tone: 'success', text: 'Present' };
    case 'late':
      return { tone: 'warning', text: 'Late' };
    case 'absent':
      return { tone: 'danger', text: 'Absent' };
    case 'excused':
      return { tone: 'info', text: 'Excused' };
    default:
      return { tone: 'info', text: status };
  }
}

/** A short word for a status, for the history list. */
export function statusWord(status: AttendanceStatus | string): string {
  const w: Record<string, string> = {
    pending: 'Waiting',
    pending_review: 'Awaiting review',
    present: 'Present',
    late: 'Late',
    absent: 'Absent',
    excused: 'Excused',
  };
  return w[status] ?? status;
}

export function statusTone(status: AttendanceStatus | string): Tone {
  if (status === 'present') return 'success';
  if (status === 'absent') return 'danger';
  if (status === 'excused') return 'info';
  return 'warning';
}

/** Where it happened: the branch, or Online. */
export function placeLabel(mode: 'classroom' | 'online' | null, branchName: string | null): string {
  if (mode === 'online') return 'Online';
  return branchName || '';
}

// ── What is sent ────────────────────────────────────────────────────────────

export type Fix = { lat: number; lng: number; accuracy: number | null; mocked?: boolean };

/**
 * The check-in request. A position is sent only when there is one; whether
 * the phone called it simulated goes with it (S6), and which app sent it.
 */
export function checkInBody(args: {
  enrollmentId: string;
  fix: Fix | null;
  teacherId?: string | null;
  platform: 'ios' | 'android';
}): Record<string, unknown> {
  const body: Record<string, unknown> = { enrollment_id: args.enrollmentId, app_platform: args.platform };
  if (args.teacherId) body.selected_teacher_id = args.teacherId;
  if (args.fix) {
    body.lat = args.fix.lat;
    body.lng = args.fix.lng;
    body.accuracy = args.fix.accuracy;
    if (typeof args.fix.mocked === 'boolean') body.mocked = args.fix.mocked;
  }
  return body;
}

export function checkOutBody(enrollmentId: string): Record<string, unknown> {
  return { enrollment_id: enrollmentId };
}

export function myTeacherBody(attendanceId: string, teacherId: string): Record<string, unknown> {
  return { attendance_id: attendanceId, teacher_id: teacherId };
}

// ── Times and dates, in Kuwait time ─────────────────────────────────────────
//
// Kuwait is UTC+3 all year (no daylight saving), so Kuwait time is the UTC
// instant plus three hours — the same answer on a phone set to any zone.
// A DATE column arrives from the AMS as Kuwait midnight in UTC
// ("2026-11-05T21:00:00.000Z" is 6 Nov); a date inside JSON arrives as
// "2026-11-06". Both read as 6 Nov here.

const KUWAIT_MS = 3 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function kuwaitClock(v: string | Date): Date | null {
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(v + 'T00:00:00Z'); // a plain date is already Kuwait's day
  }
  const t = typeof v === 'string' ? Date.parse(v) : v.getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t + KUWAIT_MS); // read with getUTC* = Kuwait wall clock
}

/** "2026-11-06": the Kuwait day of a date or an instant. */
export function kuwaitDay(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const k = kuwaitClock(v);
  return k ? k.toISOString().slice(0, 10) : null;
}

/** "6 Nov 2026". */
export function formatDay(v: string | Date | null | undefined): string {
  if (!v) return '';
  const k = kuwaitClock(v);
  if (!k) return '';
  return `${k.getUTCDate()} ${MONTHS[k.getUTCMonth()]} ${k.getUTCFullYear()}`;
}

/** "Friday, 6 Nov 2026". */
export function formatWeekdayDay(v: string | Date | null | undefined): string {
  if (!v) return '';
  const k = kuwaitClock(v);
  if (!k) return '';
  return `${WEEKDAYS[k.getUTCDay()]}, ${formatDay(v)}`;
}

/** "3:41 PM", Kuwait time, from an instant. */
export function formatTime(v: string | Date | null | undefined): string {
  if (!v) return '';
  const k = kuwaitClock(v);
  if (!k) return '';
  return twelveHour(k.getUTCHours(), k.getUTCMinutes());
}

/** "4:00 PM" from a TIME the AMS sends as "16:00:00". */
export function formatClock(hhmm: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return '';
  return twelveHour(Number(m[1]), Number(m[2]));
}

function twelveHour(h: number, min: number): string {
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

/** "4:00 – 6:00 PM", or one end, or nothing. */
export function classTimes(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatClock(start);
  const b = formatClock(end);
  if (a && b) return a.endsWith(b.slice(-2)) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
  return a || b;
}

/** The website's greeting, by the Kuwait hour. */
export function greeting(now: string | Date): string {
  const k = kuwaitClock(now);
  const h = k ? k.getUTCHours() : 12;
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Whether "Sun, Mon, Tue" includes the weekday of a Kuwait day ("2026-11-08"). */
export function isClassDay(classDays: string | null | undefined, today: string): boolean {
  if (!classDays) return false;
  const d = new Date(today + 'T12:00:00Z');
  if (!Number.isFinite(d.getTime())) return false;
  const want = SHORT_DAYS[d.getUTCDay()].toLowerCase();
  return classDays
    .split(/[,\s]+/)
    .filter(Boolean)
    .some((x) => x.slice(0, 3).toLowerCase() === want);
}

/**
 * "Starts in 25 min" up to two hours before; "On now" between start and end.
 * Nothing otherwise, or when the AMS sent no time.
 */
export function startsLabel(start: string | null | undefined, end: string | null | undefined, now: string | Date): string {
  const s = minutesOfDay(start);
  const k = kuwaitClock(now);
  if (s === null || !k) return '';
  const n = k.getUTCHours() * 60 + k.getUTCMinutes();
  const e = minutesOfDay(end);
  if (n < s && s - n <= 120) return `Starts in ${s - n} min`;
  if (n >= s && (e === null ? n - s < 60 : n < e)) return 'On now';
  return '';
}

function minutesOfDay(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// ── Money and figures ───────────────────────────────────────────────────────

/** "90.000" — KD always with three decimals. Never adds anything up. */
export function kd(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(3) : '—';
}

/** The website's lesson progress (StudentHome pctOf): done ÷ total, rounded. */
export function lessonPct(done: number | string | null | undefined, total: number | string | null | undefined): number {
  const d = Number(done) || 0;
  const t = Number(total) || 0;
  return t ? Math.round((d / t) * 100) : 0;
}

/** "42 m from ICSA City · ±8 m" — whichever parts the AMS recorded. */
export function distanceLine(distanceM: number | null | undefined, accuracyM: number | null | undefined, branch: string | null): string {
  const parts: string[] = [];
  if (distanceM != null && Number.isFinite(Number(distanceM))) {
    parts.push(branch ? `${Math.round(Number(distanceM))} m from ${branch}` : `${Math.round(Number(distanceM))} m away`);
  } else if (branch) {
    parts.push(branch);
  }
  if (accuracyM != null && Number.isFinite(Number(accuracyM))) parts.push(`±${Math.round(Number(accuracyM))} m`);
  return parts.join(' · ');
}

// ── The map ─────────────────────────────────────────────────────────────────

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/**
 * A region that shows every point and the circle around each, with a margin.
 * Degrees of latitude are ~111 km everywhere; degrees of longitude shrink
 * with the cosine of the latitude.
 */
export function regionFor(points: { lat: number; lng: number; radiusM?: number }[]): Region | null {
  const good = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (good.length === 0) return null;
  const M_PER_DEG = 111_320;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of good) {
    const r = Math.max(p.radiusM ?? 0, 30);
    const dLat = r / M_PER_DEG;
    const dLng = r / (M_PER_DEG * Math.cos((p.lat * Math.PI) / 180));
    minLat = Math.min(minLat, p.lat - dLat);
    maxLat = Math.max(maxLat, p.lat + dLat);
    minLng = Math.min(minLng, p.lng - dLng);
    maxLng = Math.max(maxLng, p.lng + dLng);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: (maxLat - minLat) * 1.6,
    longitudeDelta: (maxLng - minLng) * 1.6,
  };
}

/** The branch the map opens on: where the student checked in, else their own, else the first. */
export function mapBranch(branches: Branch[] | undefined, attendedBranchId: string | null | undefined): Branch | null {
  const list = branches ?? [];
  return (
    list.find((b) => b.id === attendedBranchId) ??
    list.find((b) => b.is_mine) ??
    list[0] ??
    null
  );
}
