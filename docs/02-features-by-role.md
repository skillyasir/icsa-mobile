# Features by role — and the AMS endpoint behind each

Written 3 Nov 2026 against AMS commit `43b55d0`. Every path below exists in `docs/api-inventory.md` (checked by script).
**Status:** ✅ the endpoint exists and serves this today · 🟡 exists, needs a small server addition · 🆕 new server work (see `03-ams-server-changes.md`).

Roles come from `/api/auth/me` (primary role + overlay roles). A screen appears only when the server would serve it — **mirror each endpoint's own guard**, never a blanket rule (AMS CLAUDE.md: "A client role check mirrors that action's server guard").

---

## Everyone

| Screen | Endpoints | Status |
|---|---|---|
| Staff sign-in (+ captcha in a WebView) | `POST /api/auth/login` | 🟡 captcha page for the WebView (S1) |
| Student sign-in (student code + password) | `POST /api/auth/student-login` | 🟡 same |
| Forgot / reset password | `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | ✅ |
| Who am I, roles, session settings | `GET /api/auth/me`, `POST /api/auth/refresh` | ✅ (device session 🆕 S2) |
| Change password / my photo | `PUT /api/auth/change-password`, `PATCH /api/auth/me`, `POST /api/upload/user` | ✅ |
| Notifications inbox + badge | `GET /api/notifications`, `GET /api/notifications/unread-count`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` | ✅ staff · 🟡 students (allowlist, S7) |
| Push registration | — | 🆕 S3 |
| Header search (who is this?) | `GET /api/search/all` | ✅ staff |
| My salary | `GET /api/salary/mine`, `GET /api/salary/mine/:id` | ✅ staff |

## Student

| Screen | Endpoints | Status |
|---|---|---|
| **Home** — today's class, check-in card, fees due, next lesson | `GET /api/auth/student/dashboard`, `GET /api/dashboard/student` | ✅ |
| **Check in / check out (geofenced)** | `GET /api/attendance/my-context`, `POST /api/attendance/check-in`, `POST /api/attendance/check-out`, `POST /api/attendance/attended-at-branch` | ✅ (mock-location flag 🟡 S6) |
| Wrong teacher? Change (same day) | `POST /api/attendance/my-teacher` | ✅ |
| Attendance history | `GET /api/attendance/my-history` | ✅ |
| **Learn** — courses → subjects → lessons | `GET /api/auth/student/courses`, `GET /api/auth/student/courses/:courseId/subjects`, `GET /api/auth/student/subjects/:subjectId/lessons`, `GET /api/auth/student/lessons/:id` | ✅ |
| Interactive HTML lesson (WebView with the AMS lesson bridge) | `POST /api/auth/student/lessons/:id/progress`, `POST /api/auth/student/lessons/:id/complete` | ✅ (WebView auth handoff, see note 1) |
| Quizzes (incl. practical/live-sheet pages in a WebView) | `GET /api/auth/student/subjects/:subjectId/quizzes`, `GET /api/auth/student/quizzes/:id`, `POST /api/auth/student/quizzes/:id/submit`, `GET /api/auth/student/quizzes/:id/attempts`, `GET /api/auth/student/quizzes/:quizId/attempts/:attemptId` | ✅ |
| Assignments — list, open, submit a file or photo, comments | `GET /api/auth/student/assignments`, `GET /api/auth/student/assignments/:id`, `POST /api/auth/student/assignments/:id/submit`, `POST /api/upload/assignment-file`, `GET/POST /api/auth/student/assignments/submissions/:submissionId/comments` | ✅ |
| Progress and grades | `GET /api/auth/student/progress`, `GET /api/auth/student/grades` | ✅ |
| **Fees** — plan, paid, balance | `GET /api/auth/student/fees` | ✅ |
| Upload a transfer proof | `GET /api/payment-proofs/methods`, `POST /api/payment-proofs`, `GET /api/payment-proofs/mine` | ✅ |
| Certificates — status, request, resubmit | `GET /api/auth/student/certificates`, `POST /api/auth/student/certificates/request`, `POST /api/auth/student/certificates/resubmit` | ✅ |
| Ambassador vouchers (refer a friend) | `GET /api/ambassador/me`, `POST /api/ambassador/vouchers`, `POST /api/ambassador/shared` | ✅ |
| Typing practice history | `GET /api/auth/student/typing/:lessonId/attempts` | ⚠️ **blocked for students today** — its allowlist entry names `:lessonId` literally (S7) |
| My profile | `GET /api/auth/student/profile` | ✅ |

## Teacher

| Screen | Endpoints | Status |
|---|---|---|
| **Today** — classes, who checked in, awaiting confirmation | `GET /api/dashboard/teacher`, `GET /api/attendance/staff-context` | ✅ |
| Confirm a walk-in check-in (one green **Present**) | `POST /api/attendance/individual/:enrollment_id/confirm`, `POST /api/attendance/confirm-present` | ✅ |
| Mark a batch session (present / late / absent / excused) | `POST /api/attendance/sessions/:session_id/confirm` | ✅ |
| My week | `GET /api/attendance/staff-range` | ✅ |
| **My classes** — progress per subject and student | `GET /api/progress/my-classes`, `GET /api/progress/subjects/:subjectId/class`, `GET /api/progress/subjects/:subjectId/students/:studentId`, `GET /api/progress/students/:studentId` | ✅ |
| **Check assignments** — queue, review, comment | `GET /api/assignments/review-queue`, `GET /api/assignments/:id/submissions`, `POST /api/assignments/submissions/:submissionId/review`, `GET/POST /api/assignments/submissions/:submissionId/comments` | ✅ |
| My students (teacher-scoped) + profile | `GET /api/students`, `GET /api/students/:id`, `GET /api/students/:id/attendance` | ✅ |
| Follow-ups — mine, log one | `GET /api/followups/mine`, `GET /api/students/followups/worklist`, `GET/POST /api/students/:id/followups` | ✅ |
| Certificate requests | `GET /api/certificates/requests`, `POST /api/certificates/requests`, `GET /api/certificates/requests/precheck` | ✅ |
| Set a student's password | `POST /api/students/:id/set-password` | ✅ |

## Reception / Supervisor

| Screen | Endpoints | Status |
|---|---|---|
| **Today** — dashboard, approvals waiting | `GET /api/dashboard`, `GET /api/dashboard/approvals` | ✅ |
| **Find a student** | `GET /api/search/students`, `GET /api/search/all`, `GET /api/students` | ✅ |
| **Student profile** — details, enrolments, payments, attendance, follow-ups | `GET /api/students/:id`, `GET /api/students/:id/enrollments`, `GET /api/students/:id/payments`, `GET /api/payments/student/:student_id/summary`, `GET /api/students/:id/attendance-detail`, `GET /api/students/:id/followups` | ✅ |
| **Register a student** — scan the Civil ID, duplicate check, photo | `POST /api/id-extract`, `GET /api/id-extract/areas`, `GET /api/students/duplicate-check`, `POST /api/upload/student`, `POST /api/students` | ✅ (idempotency 🆕 S5) |
| **Enrol** — course, teacher/batch, days and time, discount, instalments | `GET /api/courses`, `POST /api/enrollments` or `POST /api/enrollments/full`, `POST /api/payments/schedule` — **through the AMS's `enrollmentFlow`** | ✅ (idempotency 🆕 S5) |
| **Take a payment** — method, amount, proof photo | `GET /api/payment-methods`, `POST /api/uploads/payment-proof`, `POST /api/payments` | ✅ (idempotency 🆕 S5) |
| Receipt — share PDF / WhatsApp / email | `GET /api/enrollments/:id/receipt-data`, `POST /api/enrollments/:id/email-receipt` | ✅ data · 🆕 PDF for the share sheet (S10) |
| Approve student-uploaded proofs | `GET /api/payment-proofs`, `POST /api/payment-proofs/:id/approve`, `POST /api/payment-proofs/:id/reject` | ✅ |
| Charges (books, items) | `POST /api/students/:studentId/charges` | ✅ |
| Refund request / approvals | `GET /api/refunds`, `POST /api/refunds` | ✅ (manager approves) |
| **Follow-ups** — worklist, centre, cases | `GET /api/students/followups/worklist`, `GET /api/followups/centre`, `GET /api/followups/cases/:id`, `POST /api/followups/cases/:id/log`, `POST /api/followups/cases/:id/close` | ✅ |
| Attendance fixes — substitute teacher | `PATCH /api/attendance/sessions/:session_id/substitute-teacher` | ✅ |

## Marketer

| Screen | Endpoints | Status |
|---|---|---|
| **My leads** — list, filters, stage | `GET /api/referrals/prospects`, `PATCH /api/referrals/prospects/:id/status` | ✅ |
| Lead detail — notes, activity, call / WhatsApp, follow-up | `GET /api/referrals/prospects/:id`, `GET /api/referrals/prospects/:id/activity`, `PATCH /api/referrals/prospects/:id/notes`, `POST /api/referrals/prospects/:id/followup` | ✅ |
| Lost reason, transfer | `POST /api/referrals/prospects/lost-reason`, `POST /api/referrals/prospects/:id/transfer` | ✅ |
| Lookup before adding (by phone / CRS) | `GET /api/referrals/prospects/lookup`, `GET /api/referrals/prospects/by-crs/:crs_number` | ✅ |
| **My links** — create, share | `GET /api/referrals/links`, `POST /api/referrals/links`, `PATCH /api/referrals/links/:id` | ✅ |
| **Referrals** — fee, paid, attendance, bonus; PDF | `GET /api/referrals`, `POST /api/referrals/pdf` | ✅ |
| Coupons & rewards | `GET /api/coupons`, `POST /api/coupons` | ✅ |
| Performance and targets | `GET /api/reports/marketers`, `GET /api/reports/marketers/pipeline`, `GET /api/reports/marketers/:marketer_id` | ✅ |
| My students (referred + registered) | `GET /api/students`, `GET /api/students/:id` | ✅ |
| Register a student | `POST /api/students` | ✅ |

## Manager

| Screen | Endpoints | Status |
|---|---|---|
| **Dashboard** — branches, today, month | `GET /api/dashboard`, `GET /api/reports/dashboard` | ✅ |
| **Approvals** — discounts | `GET /api/payments/discount-requests`, `POST /api/payments/discount-requests/:id/approve`, `POST /api/payments/discount-requests/:id/reject` | ✅ |
| Approvals — certificates | `GET /api/certificates/requests`, `POST /api/certificates/requests/:id/approve`, `POST /api/certificates/requests/:id/decline` | ✅ |
| Approvals — payment proofs, refunds | as Reception, plus manager-only approve paths in `/api/refunds` | ✅ |
| Reports (read-only on phone; full builder stays on the web) | `/api/reports/*` | ✅ |
| Devices — sign out a lost phone | — | 🆕 S2 |

---

## Notes

1. **Lessons and practical quizzes in a WebView.** The AMS plays interactive HTML lessons in a sandbox with its lesson bridge, and live-sheet quiz pages are marked on the server. Re-implementing that natively is months of work for no gain — open those pages in an authenticated WebView (the app hands the WebView a short-lived token; S1/S2 decide how), and keep everything around them native.
2. **Stay on the web, deliberately:** the custom report builder, Site Pages, CAP catalogue editing, inventory, salary runs, user administration. They are desk work, large tables, and rarely urgent. The app links to them ("Open in browser").
3. **Branch scope** is the server's: managers pick a branch; everybody else is pinned to theirs. The app shows the branch the server answered for.
