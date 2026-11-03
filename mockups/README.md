# ICSA app — mockups (3 Nov 2026)

**Live, clickable canvas:** https://claude.ai/artifact/5dK3h1GMhAPftPMA6uPw79
(private to Yasir until he shares it). The PNGs here are the same screens at 2x,
rendered with the real Nunito font on 3 Nov 2026.

**Every name, number, date and code on these screens is made up.** None of it is
a real student, payment or lead.

## Look

ICSA brand: blue `#0D47A1`, green `#16A34A`, yellow `#FFC107`, Nunito.
Money in KD with 3 decimals (`90.000`). Dates as `3 Nov 2026`, everywhere.

## Screens

| # | File | Who | What it shows |
|---|---|---|---|
| 01 | `screens/01-student-home.png` | Student | Today's class, distance to branch, Check in, progress, next fee, due soon |
| 02 | `screens/02-student-check-in.png` | Student | Map with the branch check-in area, checked in, waiting for the teacher, "Wrong teacher? Change" |
| 03 | `screens/03-student-learn.png` | Student | Course progress and grade so far, each subject's lessons, quizzes and final exam |
| 04 | `screens/04-student-fees.png` | Student | Fee, paid, balance, instalments, upload payment proof |
| 05 | `screens/05-teacher-today.png` | Teacher | Check-ins waiting to be confirmed, today's classes |
| 06 | `screens/06-teacher-mark-class.png` | Teacher | Mark a class: present, late, absent, excused |
| 07 | `screens/07-teacher-check-assignments.png` | Teacher | Review a submission: score and comment |
| 08 | `screens/08-reception-today.png` | Reception | Quick actions, today's figures, what needs reception |
| 09 | `screens/09-reception-register.png` | Reception | Register a student: Civil ID scanned, details filled in, duplicate check |
| 10 | `screens/10-reception-take-payment.png` | Reception | Take a payment: instalment, method, transaction no., proof photo |
| 11 | `screens/11-reception-payment-recorded.png` | Reception | Payment recorded; send the receipt by WhatsApp, PDF or email |
| 12 | `screens/12-reception-follow-ups.png` | Reception | Follow-ups due and overdue; log how the call went |
| 13 | `screens/13-marketer-leads.png` | Marketer | My leads with stage and next step |
| 14 | `screens/14-marketer-lead.png` | Marketer | One lead: stage, next call, activity, call or WhatsApp |
| 15 | `screens/15-manager-approvals.png` | Manager | Today across branches; refunds, discounts and certificates to approve |
| 16 | `screens/16-sign-in.png` | Everyone | Sign in, security check, unlock with Face ID |
| 17 | `screens/17-push-lock-screen.png` | Everyone | What push notifications look like on a locked phone |
| 18 | `screens/18-ipad-mac-student-profile.png` | Staff | iPad: student list beside the student's profile (file name kept from before the iPad-only ruling) |

`overview-phone-screens.png` is all 17 phone screens on one sheet.

## Source

`source/*.dc.html` and `source/canvas.json` are the canvas files. Edit them on
the canvas (link above), not here; these copies are for reference and diffing.

## Approved — 3 Nov 2026

**Yasir approved all 18 screens on 3 Nov 2026**, with four changes that his
rulings of the same day required, applied on the canvas that day:

1. **16 Sign in** — "Sign in with Apple" and "Sign in with Google", side by side
   and equally prominent, under the password sign-in. In the app these are the
   official Apple and Google buttons from their SDKs, not drawn ones.
2. **02 Check in** — an **Arrival reminders** switch; the small print now says
   the phone notices arrival on a class day, nothing is sent until the student
   taps, and ICSA never checks anyone in by itself.
3. **17 Lock screen** — the arrival reminder ("You've arrived at ICSA City",
   *Open check-in* / *Not now*) on top.
4. **18** — iPad only (the Mac uses the AMS web app).

**The canvas is the current version.** `source/` matches it. The PNGs for
**02, 16, 17, 18** and `overview-phone-screens.png` were rendered before these
four changes and still show the old screens — re-export them from the canvas
if a fresh sheet is needed.

Changes go on the canvas first, then into the app.
