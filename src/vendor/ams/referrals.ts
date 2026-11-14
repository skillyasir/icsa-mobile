// @ts-nocheck
// VENDORED from the AMS — client/src/lib/referrals.js, VERBATIM below the marker.
// The one owner of a referral list's date range, filter and ORDER (so its No.
// is the website's and the PDF's). more.check.ts holds everything below the
// marker byte-identical to the AMS copy on the Mac; to update it, copy the AMS
// file again — never edit it here.
// ── verbatim below ──
// referrals.js — what the Referrals screen and its PDF both show (2 Nov 2026).
//
// ONE copy of: the date range for Day / Month / Year / Custom, which date a row
// is filed under (referral or enrolment), which rows a filter keeps (dates,
// the marketers ticked), their order and sections (grouped by marketer or not,
// and so each row's No.), the totals and subtotals, and the CSV. The screen
// (pages/marketing/Referrals.js) and the PDF (pages/marketing/ReferralsPrint.js,
// rendered on the server AS the person asking) both call these — a PDF that
// filtered or numbered differently from the screen it was downloaded from would
// be a second copy, and the two would drift.
//
// Every figure on a row is the server's (referralsController.getAllReferrals):
// fee, paid and balance are the custom report's per-enrolment figures, the
// attendance status is the Students list's. Nothing here computes money.
//
// MOVED (8 Nov 2026): money a payment transfer moved in (+) or out (−). Paid is
// money received and leaves it out; the balance counts it — so on such a row
// Paid + Moved + Balance = Fee.
//
// A MARKETER IS NOT SENT THE MONEY (Yasir, 8 Nov 2026): the server leaves fee,
// paid, moved and balance off her rows and says show_money: false. The screen,
// the PDF and the CSV then draw no money columns — `showMoney` below is always
// the server's answer, never a role test here.

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parseDay = (s) => new Date(s + "T12:00:00");
// "30 Oct 2026" — Yasir's date format, everywhere (screen, PDF, CSV).
export const dLabel = (s) => (s ? parseInt(s.slice(8, 10), 10) + " " + MONTHS[parseInt(s.slice(5, 7), 10) - 1] + " " + s.slice(0, 4) : "—");
export const kd3 = (n) => Number(n || 0).toFixed(3);
export const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// [from, to] as YYYY-MM-DD for a mode + anchor.
export const rangeFor = (mode, anchor, custom) => {
  const a = parseDay(anchor);
  if (mode === "custom") return [custom.from, custom.to];
  if (mode === "day") return [anchor, anchor];
  if (mode === "year") return [a.getFullYear() + "-01-01", a.getFullYear() + "-12-31"];
  return [ymd(new Date(a.getFullYear(), a.getMonth(), 1)), ymd(new Date(a.getFullYear(), a.getMonth() + 1, 0))];
};
export const shiftRange = (mode, anchor, dir, custom) => {
  const a = parseDay(anchor);
  if (mode === "day") { a.setDate(a.getDate() + dir); return { anchor: ymd(a) }; }
  if (mode === "month") return { anchor: ymd(new Date(a.getFullYear(), a.getMonth() + dir, 1)) };
  if (mode === "year") return { anchor: ymd(new Date(a.getFullYear() + dir, 0, 1)) };
  const f = parseDay(custom.from), t = parseDay(custom.to);
  const len = Math.round((t - f) / 86400000) + 1;
  f.setDate(f.getDate() + dir * len); t.setDate(t.getDate() + dir * len);
  return { custom: { from: ymd(f), to: ymd(t) } };
};

// The date a row is filed under.
export const dayOf = (r, dateBy) => (dateBy === "enrolment" ? r.enrolled_date || r.referral_date : r.referral_date);

/**
 * Rows in the dates and, for a manager, the marketers ticked (2 Nov 2026,
 * Yasir: "all or selected marketers"). No marketers ticked means all of them.
 */
export const inDates = (all, { from, to, dateBy, marketers }) => {
  const pick = new Set(marketers || []);
  return (all || []).filter((r) => {
    const d = dayOf(r, dateBy);
    return d && d >= from && d <= to && (!pick.size || pick.has(r.referrer_id));
  });
};

/**
 * The marketers a PDF page rendered, as it stamps them: ids sorted and joined,
 * or "all". The server builds the value it expects the same way.
 */
export const marketersStamp = (ids) => (ids || []).slice().sort().join(",") || "all";

/** "All marketers", one name, two or three names, or "5 marketers". */
export const marketersLabel = (ids, nameOf) => {
  if (!ids || !ids.length) return "All marketers";
  if (ids.length > 3) return ids.length + " marketers";
  return ids.map((id) => nameOf(id) || "—").join(", ");
};

/**
 * The rows a list shows, IN THE ORDER IT NUMBERS THEM: a status (or "all"),
 * a search over student, code, course and marketer, newest first — and, for
 * two rows on the same day, the later-created first, so the No. of a row is
 * the same on the screen and in the PDF.
 */
export const narrow = (list, { status = "all", q = "", dateBy }) => {
  const needle = String(q || "").trim().toLowerCase();
  return list
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => !needle || [r.student_name, r.student_code, r.course_name, r.referrer_name].join(" ").toLowerCase().includes(needle))
    .slice()
    // x and y, not a and b: branches-projection.check reads any `b.<column>`
    // in the client as a branch row.
    .sort((x, y) => {
      const dx = dayOf(x, dateBy) || "", dy = dayOf(y, dateBy) || "";
      if (dx !== dy) return dx < dy ? 1 : -1;
      const cx = String(x.created_at || ""), cy = String(y.created_at || "");
      return cx === cy ? 0 : cx < cy ? 1 : -1;
    });
};

export const live = (l) => l.filter((r) => r.status !== "cancelled");
export const byStatus = (l, s) => l.filter((r) => r.status === s);
export const sumOf = (l, k) => l.reduce((s, r) => s + num(r[k]), 0);
export const NEEDS_CALL = ["Inactive", "At Risk", "Critical"];

/** The figures a set of rows adds up to. Bonus excludes cancelled rows. */
export const totals = (list) => {
  const fee = sumOf(list, "fee");
  const paid = sumOf(list, "paid");
  return {
    count: list.length,
    fee,
    paid,
    paidPct: fee > 0 ? Math.round((paid / fee) * 100) : null,
    moved: sumOf(list, "moved"),
    balance: sumOf(list, "balance"),
    attended: sumOf(list, "attended"),
    active: list.filter((r) => r.student_status === "Active").length,
    needCall: list.filter((r) => NEEDS_CALL.includes(r.student_status)).length,
    onBreak: list.filter((r) => r.student_status === "On break").length,
    bonus: sumOf(live(list), "bonus_amount"),
    pending: byStatus(list, "pending").length,
    approved: byStatus(list, "approved").length,
    paidOut: byStatus(list, "paid").length,
    cancelled: byStatus(list, "cancelled").length,
  };
};

export const paidPctOf = (r) => (num(r.fee) > 0 ? Math.round((num(r.paid) / num(r.fee)) * 100) : null);

/** Moved money as words, or null when none moved: "+ 100.000 moved in", "− 40.000 moved out". */
export const movedLabel = (v) => {
  const n = Math.round(num(v) * 1000) / 1000;
  if (!n) return null;
  return n > 0 ? "+ " + kd3(n) + " moved in" : "− " + kd3(-n) + " moved out";
};

/**
 * The rows as a list shows them, in SECTIONS (2 Nov 2026, Yasir: group by
 * marketer, "I choose each time"). Ungrouped: one section, no name. Grouped:
 * one section per marketer — most referrals first, then by name — each holding
 * its rows in narrow()'s order and its own totals. A row's No. is its place in
 * its section, so it starts again at 1 under each marketer. The screen, the
 * PDF and the CSV all lay rows out through this.
 */
export const sectionsFor = (list, { group }) => {
  if (!group) return [{ id: null, name: null, rows: list, t: totals(list) }];
  const m = new Map();
  list.forEach((r) => {
    const k = r.referrer_id || "";
    if (!m.has(k)) m.set(k, { id: r.referrer_id || null, name: r.referrer_name || "—", rows: [] });
    m.get(k).rows.push(r);
  });
  return Array.from(m.values())
    .sort((x, y) => y.rows.length - x.rows.length || x.name.localeCompare(y.name))
    .map((s) => ({ ...s, t: totals(s.rows) }));
};

export const REFERRAL_STATUS = {
  pending:   { label: "Pending",   chip: "bg-amber-50 text-amber-700 border-amber-200" },
  approved:  { label: "Approved",  chip: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  paid:      { label: "Paid",      chip: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", chip: "bg-gray-100 text-gray-600 border-gray-200" },
};
// The Students list's attendance statuses, coloured the same way everywhere.
export const STUDENT_STATUS = {
  Active:     { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Inactive:   { chip: "bg-gray-100 text-gray-700 border-gray-200",          dot: "bg-gray-400" },
  "At Risk":  { chip: "bg-amber-50 text-amber-800 border-amber-200",        dot: "bg-amber-500" },
  Critical:   { chip: "bg-rose-50 text-rose-700 border-rose-200",           dot: "bg-rose-500" },
  "On break": { chip: "bg-sky-50 text-sky-700 border-sky-200",              dot: "bg-sky-500" },
};
export const ENROLMENT_LABEL = { active: "Active", frozen: "Frozen", withdrawn: "Withdrawn", completed: "Completed", cancelled: "Cancelled" };

// ---- CSV (the Excel button) ----
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
// Grouped, every row keeps its Marketer cell (so Excel can still filter on
// it) and each marketer ends with a Subtotal line; the Total line is last.
// showMoney is the server's show_money: false leaves the five money columns out.
export const csvFor = (list, { showMarketer, group, showMoney = true }) => {
  const mk = showMarketer || !!group;
  const money = (cells) => (showMoney ? cells : []);
  const head = ["No.", ...(mk ? ["Marketer"] : []), "Student", "STU code", "Course", "Teacher", "Enrolment status",
    "Referral date", "Enrolment date", ...money(["Course fee (KD)", "Paid (KD)", "Paid %", "Moved (KD)", "Balance (KD)"]),
    "Sessions attended", "Last attended", "Attendance status", "Bonus (KD)", "Bonus status"];
  const line = (r, i) => [i + 1, ...(mk ? [r.referrer_name] : []), r.student_name, r.student_code, r.course_name,
    r.teacher_name, ENROLMENT_LABEL[r.enrollment_status] || r.enrollment_status || "", dLabel(r.referral_date), dLabel(r.enrolled_date),
    ...money([kd3(r.fee), kd3(r.paid), paidPctOf(r) == null ? "" : paidPctOf(r) + "%", kd3(r.moved), kd3(r.balance)]),
    r.attended || 0, r.last_attended ? dLabel(r.last_attended) : "", r.student_status || "",
    kd3(r.bonus_amount), (REFERRAL_STATUS[r.status] || {}).label || r.status];
  const sum = (label, who, t) => [label, ...(mk ? [who] : []), t.count + " referral" + (t.count === 1 ? "" : "s"), "", "", "", "", "", "",
    ...money([kd3(t.fee), kd3(t.paid), t.paidPct == null ? "" : t.paidPct + "%", kd3(t.moved), kd3(t.balance)]),
    t.attended, "", "", kd3(t.bonus), ""];
  const body = [];
  sectionsFor(list, { group }).forEach((s) => {
    s.rows.forEach((r, i) => body.push(line(r, i)));
    if (group) body.push(sum("Subtotal", s.name, s.t));
  });
  return [head, ...body, sum("Total", "", totals(list))].map((r) => r.map(csvCell).join(",")).join("\r\n");
};
