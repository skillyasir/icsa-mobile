// @ts-nocheck
// VENDORED from the AMS — client/src/lib/leadExpiry.js, VERBATIM below the marker.
// When a lead expires and how urgent its "no contact" is: the AMS computes the
// clock (public.prospect_expiry); this only reads it. leads.check.ts holds
// everything below the marker byte-identical to the AMS copy on the Mac; to
// update it, copy the AMS file again — never edit it here.
// ── verbatim below ──
// The countdown a marketer sees, and the one place it is worded.
//
// ============================ IT COMPUTES NOTHING ============================
//
// Every number here arrives from the server, which reads it from
// public.prospect_expiry — the single definition of when a lead expires:
// a lead nobody has contacted expires 30 days after it came in, a contacted
// lead 90 days after it came in, and the whole answer is floored at the §3.4
// grace plus a warning window so nothing is judged from before the rule was
// announced. Terminal statuses never expire.
//
// THIS FILE DOES NO DATE ARITHMETIC. Not `new Date(expires_at) - Date.now()`,
// not a day count, nothing. That is deliberate and it is the §1.3 lesson
// applied a fourth time: "contacted" was re-derived in five places and was
// wrong in four of them, twice silently. A client that subtracts its own dates
// would be computing in the browser's timezone against a value the database
// computed in Asia/Kuwait, and the answer would differ by a day near midnight
// for reasons nobody could reproduce. `days_to_expiry` is already the answer.
//
// ============================ WHAT K1 CHANGED HERE, AND WHY IT MATTERS MOST ============================
//
// Until K1 the rule was a ROLLING 30 days from the last contact, so every
// sentence in this file told a marketer the same true thing: work the lead and
// you get more time. `logging a call or a note starts the 30 days again` was
// the literal wording, and it was correct.
//
// Under the owner's rule it is FALSE, and false in the direction that costs
// somebody a lead. A contacted lead expires 90 days after it came in and
// nothing anyone does moves that date. Contact is now a ONE-WAY SWITCH from the
// 30-day window to the 90-day one, taken the first time anybody logs anything,
// and after that the clock is deaf.
//
// So the wording is split on `is_contacted`, and both halves say the part a
// marketer cannot see from a number:
//
//   never contacted   the first call or note BUYS time — 30 days becomes 90
//   contacted         nothing buys time. This is the whole rule, and it is the
//                     thing nobody has been told.
//
// THE SCREEN IS THE ONLY PLACE THIS IS EVER SAID. There is no announcement, no
// email, no release note that reaches a marketer. E1 shipped the countdown
// alone precisely so the rule would be visible before it bit; a countdown
// carrying the previous rule's promise would have spent that warning teaching
// the opposite of what E2 will enforce.
//
// ============================ EXPIRY NOW ACTS. HERE IS EXACTLY HOW FAR ============================
//
// THIS PARAGRAPH USED TO SAY THE OPPOSITE, and it was true for three change
// sets: "Nothing in this change set acts on expiry. No lead is hidden, no
// status moves, no query filters on is_expired." E2b-2 falsifies the first two
// clauses, and it changes this sentence in the same commit as the code that
// falsifies it — a stale reassurance in the one file that defines the wording
// is worse than no reassurance.
//
// WHAT ACTS, precisely:
//
//   An expired lead LEAVES the marketer's working list and appears in a
//   collapsed section on their own My Leads. Visible, not workable, until a
//   manager reassigns it. A lead silently disappearing is a worse experience
//   than losing it, so it does not disappear.
//
// WHAT STILL DOES NOT:
//
//   * NO status moves. Expiry is DERIVED by public.prospect_expiry, there is no
//     sixth status, and nothing writes one.
//   * NO query filters on is_expired. The server still returns every lead it
//     ever returned — asserted by lead-expiry.check.js §3, which is what keeps
//     the manager's All Leads and the collapsed section both fed. The partition
//     is a CLIENT decision about display, made here, in one function.
//   * NO notification. E1's countdown WAS the notification; they watched it run
//     down for weeks. An alert after an ignored countdown is noise, and it
//     would need the sweep job this design exists to avoid.
//   * NOTHING is deleted, and reassignment is what restores it (E2b-1).
//
// K1 floors the whole answer at the §3.4 grace, which UN-EXPIRED leads that had
// read "expired": they had been judged by a 90-day clock nobody announced.
// Warn, then bite, for everyone, once.

/**
 * Is this lead past its expiry?
 *
 * ONE DEFINITION, read from the server's boolean and never re-derived. The §1.3
 * lesson applied a fifth time: "contacted" was computed in five places and was
 * wrong in four, and three of those derived a boolean from a timestamp. This
 * reads `is_expired`, which public.prospect_expiry computed once, in Asia/Kuwait,
 * against timestamptz columns.
 *
 * Deliberately NOT `days_to_expiry < 0`. That is the same answer today and a
 * second definition tomorrow, and it would disagree with the server across
 * midnight.
 *
 * A payload from before E1 has no is_expired, and a terminal lead has it false.
 * Both are correctly "not expired": nothing should leave a working list because
 * an old tab has not been refreshed.
 */
export const isExpired = (p) => p != null && p.is_expired === true;

/**
 * Split a marketer's leads into the ones they can work and the ones that have
 * left their list.
 *
 * THIS IS THE ONLY PLACE THE SPLIT IS MADE. It lives here rather than inside a
 * useMemo on the screen for the reason G1 wrote down about itself: logic buried
 * in a component body cannot be imported, so its check can only be
 * source-shaped, and source-shaped assertions are the weakest ones in this
 * project. This one is exercised directly.
 *
 * Order is preserved within each half, so a caller's sort survives the split.
 *
 * @returns {{working: object[], expired: object[]}}
 */
export const partitionByExpiry = (list) => {
  const working = [];
  const expired = [];
  for (const p of (list || [])) (isExpired(p) ? expired : working).push(p);
  return { working, expired };
};

/**
 * Expiry-soonest, as a comparator.
 *
 * MY LEADS' DEFAULT ORDER as of E2b-2. G1 kept work-me-first while expiry was
 * only a warning; now the cost of ignoring a lead is losing it, so the order
 * answers "what am I about to lose" rather than "what did I touch least
 * recently". Never-contacted-first with expiry as a tiebreak was considered and
 * rejected as too clever to explain; F1's marker and the existing filter keep
 * the never-contacted visible.
 *
 * A lead with no countdown — terminal, or a pre-E1 payload — sorts LAST rather
 * than first. Infinity, not 0: a missing number must never be read as "expires
 * today" and pushed to the top of a screen people act on.
 */
export const expirySoonest = (p) => {
  const d = p == null ? null : p.days_to_expiry;
  const n = Number(d);
  return (d == null || !Number.isFinite(n)) ? Infinity : n;
};

// Tone is a name, not a colour. The components map it to their own classes, so
// a worklist row and a drawer can look different while agreeing about urgency.
export const EXPIRY_TONES = ['expired', 'urgent', 'soon', 'calm'];

/**
 * The countdown for one prospect, or null when there is nothing to say.
 *
 * null happens for a terminal lead — enrolled, enrolled_refunded, lost, merged
 * — which never expires and therefore carries a NULL expires_at. It also
 * happens when the payload predates E1 and has no expiry fields at all, so an
 * un-refreshed client renders exactly what it did before rather than "NaN days".
 *
 * @param {object} p a prospect as the server sends it
 * @returns {{text: string, tone: string, days: number, held: boolean, contacted: boolean|null}|null}
 */
export const expiryOf = (p) => {
  if (!p) return null;
  if (p.expires_at == null || p.days_to_expiry == null) return null;

  const days = Number(p.days_to_expiry);
  if (!Number.isFinite(days)) return null;

  // A FACT ABOUT THE LEAD, NEVER A FACT ABOUT ITS EXPIRY. Under D1 a booked
  // callback stopped the inactivity clock and ExpiryChip badged it ` · held`.
  // K1 ended that — a contacted lead expires 90 days from capture whatever
  // anyone books — and the badge is gone as of E2b-2, because it had spent a
  // month telling marketers their callback was protecting a lead it was not.
  //
  // The flag survives because "a callback is booked" is still true and still
  // worth saying somewhere with room to say it properly. It has no renderer
  // today. If one is added, it may report the booking; it may NOT describe the
  // countdown.
  const held = p.followup_holds === true;
  // THREE-VALUED ON PURPOSE, and null is not false. A payload from before K1
  // carries no is_contacted, and guessing "not contacted" would put the wrong
  // half of the rule in front of a marketer — telling them a call will buy
  // time when it will not. Absent means "say the number and stop", which is
  // exactly what the screen did yesterday.
  const contacted = typeof p.is_contacted === 'boolean' ? p.is_contacted : null;

  let text;
  let tone;
  if (days < 0) {
    // Deliberately not "expired N days ago". Until E2 nothing has happened to
    // this lead, and a past tense with a duration reads like a report of
    // something already done.
    text = 'expired';
    tone = 'expired';
  } else if (days === 0) {
    text = 'expires today';
    tone = 'urgent';
  } else if (days === 1) {
    text = 'expires tomorrow';
    tone = 'urgent';
  } else if (days <= 7) {
    text = `expires in ${days} days`;
    tone = 'urgent';
  } else if (days <= 30) {
    text = `expires in ${days} days`;
    tone = 'soon';
  } else {
    text = `expires in ${days} days`;
    tone = 'calm';
  }

  return { text, tone, days, held, contacted };
};

/**
 * The long form, for a detail panel that has room to explain itself.
 *
 * The two halves are the rule, and they are opposites. A lead nobody has
 * touched is on a 30-day window and the first call moves it to 90 days from
 * capture — so there is something to do and doing it helps, and an uncontacted
 * lead that has ALREADY expired can be brought back by making that call. A
 * contacted lead is on the 90-day window and NOTHING moves it, which is the
 * sentence this project exists to put on a screen before E2 starts taking
 * leads away.
 *
 * EVERY EXPIRED CASE STILL SAYS "still workable", because until E2 nothing has
 * happened to the lead and the wording must not imply it has. That sentence
 * predates K1 and survives it unchanged in meaning.
 *
 * A BOOKED CALLBACK GETS NO SENTENCE ANY MORE. Under D1 it stopped the
 * inactivity clock and the long form had to say so, or "expires in 62 days ·
 * callback booked" invited the reading that the callback expires. Under the
 * owner's rule it stops nothing — a callback can only be booked through
 * logProspectFollowup, which makes the lead contacted, so every held lead is
 * already on the 90-day window and the contacted sentence is the true one. The
 * `held` flag is still returned for components that badge the row; it no longer
 * earns a clause about clocks.
 *
 * A payload from before K1 has no is_contacted. It gets the bare countdown
 * rather than a guess, because guessing wrong here tells a marketer to make a
 * call that will not buy them the day they think it will.
 */
export const expiryDetail = (p) => {
  const e = expiryOf(p);
  if (!e) return null;
  const expired = e.days < 0;

  if (e.contacted === false) {
    return expired
      ? 'expired — still here, still workable. Logging a call or a note moves this to 90 days from capture, which brings it back.'
      : e.text + ' — no contact logged yet. The first call or note moves this to 90 days from capture.';
  }
  if (e.contacted === true) {
    return expired
      ? 'expired — still here, still workable, but the 90 days from when this lead came in have run out and contact does not extend them.'
      : e.text + ' — 90 days from when this lead came in. Contact does not move it.';
  }
  return expired ? 'expired — still here, still workable.' : e.text;
};

// ============================ THE NO-CONTACT MARKER'S URGENCY ============================
//
// The marker itself is decided elsewhere and stays there: lib/lastAction.js
// reads `is_contacted` — §1.3's single definition — and returns `noContactYet`.
// THIS FUNCTION NEVER ASKS WHETHER A LEAD WAS CONTACTED. It answers only "how
// much time is left", for a chip whose presence has already been decided. That
// separation is deliberate: a tier that also tested is_contacted would be the
// sixth site of the field this project has twice paid to unify, added for
// nothing more than a colour.
//
// ============================ TWO TIERS. THE THIRD WAS A MISTAKE, AND IT WAS MINE ============================
//
// REVERSED 4 September 2026 BY THE OWNER, WHO IS REVERSING HIS OWN EARLIER
// RULING. The record is kept here rather than tidied away because the way this
// went wrong is more useful than the rule that replaced it.
//
// THE PROPOSAL ASKED A COMPOUND QUESTION. It asked Yasir "tiered by days left,
// or all of them coloured?" — and he answered the COLOUR. The tier was never
// answered, and it was built anyway. A question with two halves gets one
// answer, and the half that comes back is not necessarily the half you needed.
//
// WHAT IT COST, measured on live data 4 Sep 2026. The earliest expiry on the
// whole book is 27 September, because the §3.4 grace floors every clock. So on
// the day this shipped, ALL 156 never-opened leads sat above the 14-day line
// and EVERY CHIP RENDERED GREY. The feature displayed nothing at all, and would
// have gone on displaying nothing until 13 September. He looked at the screen
// and said, correctly, that the colour never changed. A tier whose top band is
// empty for a fortnight is not a ranking; it is an off switch with three
// positions.
//
// AND THE WALLPAPER ARGUMENT WAS WRONG. It used to read, here: "a single grey
// pill on 127 rows is a wall, and a wall is read past within a week." That
// mistook the symptom for the problem. THE WALL OF AMBER EXISTS BECAUSE 156
// LEADS ARE UNTOUCHED. Greying most of it out does not rank the backlog, it
// HIDES it — and it hides it most completely at exactly the moment it is
// largest, which is when somebody most needs to see it. The honest picture of
// 156 uncalled people is 156 coloured chips.
//
// Red stays scarce, and that is what makes red read. It is the only band that
// carries a number, and it is earned by a deadline inside a week rather than by
// a threshold chosen to keep the screen calm.
//
//   ≤ 7 days, or already out of time    critical   red, WITH the day count
//   everything else                     warning    amber, no count
//
// EVERYTHING ELSE MEANS EVERYTHING ELSE, including a lead with no countdown at
// all — a terminal lead (lost, enrolled, merged) carries a null expires_at, and
// a payload from before E1 has no expiry fields either. Both are amber now, and
// that is the rule working rather than an edge it failed to cover: a Lost lead
// with nothing ever logged is somebody giving up without recording a call, and
// it should look untouched, because it is. The old argument for greying it —
// "there is no time running out on it to be urgent about" — was an argument
// against RED, and it still is. It was never an argument for invisibility.
//
// THE THRESHOLDS ARE STILL NOT expiryOf'S, and the reason is unchanged: that one
// bands 7 / 30 for a countdown running to 90 on a contacted lead, and an
// uncontacted lead's whole life fits inside its "soon". Separate names so nobody
// reads `tier` as a tone and assumes the scales agree.
//
// It does no date arithmetic, for the reason at the top of this file. Every
// number comes from expiryOf, which reads days_to_expiry off the payload.
export const NO_CONTACT_TIERS = ['critical', 'warning'];

/**
 * How urgent an already-decided "no contact yet" marker is.
 *
 * @param {object} p a prospect as the server sends it
 * @returns {{tier: string, days: number|null, suffix: string, title: string}}
 *   never null — the caller has already decided to render something, so this
 *   must always have an answer for it.
 */
export const noContactUrgency = (p) => {
  const e = expiryOf(p);
  const NEVER_LOGGED = 'Nobody has logged a call or a note on this lead.';
  // Matches expiryDetail's existing sentence word for word. The two sit inches
  // apart on the same row and must not describe the same rule differently.
  const BUYS_TIME = ' The first call or note moves this to 90 days from capture.';

  // No countdown — terminal, or a pre-E1 payload. Amber, never red: there is
  // no deadline to be urgent about, and no number to put on the chip.
  if (!e) return { tier: 'warning', days: null, suffix: '', title: NEVER_LOGGED };

  const days = e.days;

  // Out of time. NO DAY COUNT ON THE CHIP: the number is negative, and "· -4
  // days left" is not a sentence. The countdown beside it already says
  // "expired", which is the fact; this stays red and says nothing about time.
  if (days < 0) {
    return {
      tier: 'critical',
      days,
      suffix: '',
      title: NEVER_LOGGED + ' Its window has already run out — it is still'
        + ' workable, and logging a call or a note now brings it back for 90'
        + ' days from capture.',
    };
  }

  const clause =
    days === 0 ? ' It expires today.'
      : days === 1 ? ' It expires tomorrow.'
        : ' It expires in ' + days + ' days.';
  const title = NEVER_LOGGED + clause + BUYS_TIME;

  if (days <= 7) {
    // The day count rides on the chip only in the red band, where it is the
    // thing being acted on. On 60 amber and quiet rows it would be noise, and
    // the countdown already carries it for anyone who wants the number.
    const suffix =
      days === 0 ? ' · last day'
        : days === 1 ? ' · 1 day left'
          : ' · ' + days + ' days left';
    return { tier: 'critical', days, suffix, title };
  }
  // Everything that is not red is amber. No upper bound and no third band: a
  // lead nobody has contacted looks like one whether it has 9 days left or 29.
  return { tier: 'warning', days, suffix: '', title };
};
