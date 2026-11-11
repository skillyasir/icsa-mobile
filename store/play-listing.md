# Google Play — the ICSA listing and forms

Written 8 Nov 2026 for the closed test (Yasir ruled, 8 Nov 2026: start it now).
Copy these into Play Console. Re-read them against the app before the public release.

## Store listing (Grow users › Store presence › Main store listing)

- **App name:** ICSA
- **Short description** (71 of 80 characters):
  Your ICSA classes, check-in, lessons, assignments and fees, in one app.
- **App icon:** `store/play-icon-512.png`
- **Feature graphic:** `store/play-feature-graphic.png`
- **Phone screenshots:** at least 2 (up to 8), from the Android emulator or a phone, signed in as **test22** — never a real student's screen. Suggested: Home, Check in, Learn, a lesson, Fees.
- **Category:** Education. **Contact email:** the ICSA address you want students to write to. **Website:** https://icsa.us

**Full description:**

```
ICSA is the official app for ICSA students and teachers.

For students
• Check in to class at your ICSA branch with one tap
• See your attendance, and fix the teacher if you checked in under the wrong one
• Open your lessons, videos, interactive lessons and quizzes
• Hand in assignments as a file or a photo, and read your teacher's comments
• See your course fee, what you have paid and your instalments, and send a payment proof to reception

For teachers
• Today's classes, and the students waiting for you to confirm them
• Mark a class's attendance
• Check and grade assignments
• See which students need you, and call or WhatsApp them

Sign in with your ICSA account — the same one as the ICSA website — or with Google or Apple once your account is linked. You stay signed in on your phone, and Face ID or your fingerprint can lock the app.

Your location is read only when you tap Check in, to confirm you are at an ICSA branch — never in the background.

ICSA — Your Partner in Success
```

## App content (Policy › App content)

- **Privacy policy:** https://icsa.us/privacy_policy (`/privacy` is a 404 — checked 10 Nov 2026). **It covers the app since 10 Nov 2026** (clause 02, "The ICSA mobile app"): location read only at check-in; photos and files the person chooses (payment proofs, assignments); name, email and phone from their ICSA account; the sign-in kept on the phone; nothing sold, no ads.
- **App access:** "All or some functionality is restricted" → add the **test22** login (typed by Yasir). Note for the reviewer: *Check-in works only inside an ICSA branch in Kuwait; everything else works anywhere.*
- **Ads:** No.
- **Content rating:** category **Education**. No violence, sexual content, drugs, gambling or bad language. *Users can interact* — **Yes** (students and teachers write comments on assignments). *Shares location* — the app reads location only at check-in and sends it to ICSA, not to other users → answer as the questionnaire words it.
- **Target audience:** Yasir's decision — the age groups ICSA's students are really in. If under-18s are included, Play's Families rules apply (the app already has no ads and no third-party tracking).
- **News app:** No. **Government app:** No. **Financial features:** None (proofs are sent to ICSA; no payment is made in the app). **Health:** No.

## Data safety (Policy › App content › Data safety)

Filled in Play Console 11 Nov 2026 and saved as a draft; it is sent for review
with the app once Target audience is done.

- **Collects or shares user data:** Yes, collects. **Shared with third parties:** No.
- **Encrypted in transit:** Yes (HTTPS only).
- **Account creation:** the app does not let users create an account. Users sign
  in with accounts made outside the app — "Out of app identification (service
  subscription)": ICSA staff make the account when a student enrols.
- **Data deletion:** Yes — Delete data URL `https://icsa.us/privacy_policy`
  ("Deleting your account": email info@icsa.us).
- **Name and phone are not listed:** the app shows them but never sends them.

Every type below: collected, not shared, not processed ephemerally.

| Data type | Why | Required or optional |
|---|---|---|
| **Location — precise** (only when Check in is tapped) | App functionality | Optional |
| **Personal info — email address** | App functionality, account management | Required |
| **Personal info — user IDs** | App functionality, account management | Required |
| **Financial info — other** (the amount on a payment proof) | App functionality | Optional |
| **Messages — other in-app messages** (assignment comments) | App functionality | Optional |
| **Photos** (chosen for a proof or an assignment) | App functionality | Optional |
| **Files and docs** (handed in as an assignment) | App functionality | Optional |
| **App activity — app interactions** (lesson progress, in the lesson pages) | App functionality | Required |
| **App activity — other user-generated content** (quiz answers, assignment work) | App functionality | Optional |
| **Device or other IDs** (this phone's sign-in record) | App functionality; fraud prevention, security and compliance | Required |

No data is used for advertising or analytics, and none is sold.
