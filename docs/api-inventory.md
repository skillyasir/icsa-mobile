# AMS API inventory

Generated 3 Nov 2026 from the AMS at commit `43b55d0` by `scripts/api-inventory.js`. **673 endpoints**, 46 reachable with a student token. Regenerate it; never edit it by hand — a hand-kept list drifts.

- **Roles** — what the route line's `authorize(...)` admits. Overlay roles count (a supervisor with the marketer overlay passes `marketer`). The controller usually narrows further (own branch, own students, own leads): the route gate is the outer wall, not the whole rule.
- **any signed-in** — `auth` with no role gate on the route line; the controller decides.
- **PUBLIC** — no `auth` on the route line (website forms, verification, health); some check a secret or token inside.
- **Student ✓** — a student token reaches it. The firewall (`server/src/middleware/studentFirewall.js`, 41 entries) refuses a student on every other path, whatever the route says. A new student screen needs a new allowlist line on the server.
- Base URL: `https://app.icsasystem.com`; the token travels as `Authorization: Bearer <token>`.

> ⚠️ **1 allowlist entry names a `:param` literally and can never match a real request**, so students get a 403 there: `GET /api/auth/student/typing/:lessonId/attempts`. Found while preparing this inventory; not fixed.

## Areas

- `/api/public/certificates` — 1
- `/api/auth` — 37
- `/api/users` — 9
- `/api/settings` — 5
- `/api/branches` — 6
- `/api/students` — 18
- `/api/legacy` — 12
- `/api/courses` — 29
- `/api/content` — 3
- `/api/preview` — 8
- `/api/public-content` — 19
- `/api/course-categories` — 4
- `/api/enrollments` — 26
- `/api/payments` — 14
- `/api/payment-methods` — 5
- `/api/uploads` — 1
- `/api/payment-proofs` — 6
- `/api/refunds` — 9
- `/api/payment-transfers` — 7
- `/api/fee-items` — 5
- `/api/job-orders` — 10
- `/api/student-charges` — 3
- `/api/inventory` — 33
- `/api/attendance` — 15
- `/api/dashboard` — 4
- `/api/audit` — 3
- `/api/search` — 2
- `/api/salary` — 22
- `/api/teacher-bonus` — 8
- `/api/expenses` — 7
- `/api/recurring-expenses` — 5
- `/api/referrals` — 34
- `/api/careers` — 14
- `/api/email-alerts` — 3
- `/api/coupon-templates` — 5
- `/api/coupons` — 23
- `/api/ambassador` — 4
- `/api/rewards` — 29
- `/api/followups` — 12
- `/api/marketer-targets` — 4
- `/api/branch-targets` — 3
- `/api/reports` — 31
- `/api/roadmap` — 4
- `/api/id-extract` — 2
- `/api/cap` — 21
- `/api/cap/students` — 5
- `/api/cap/enrollments` — 4
- `/api/cap/reports` — 1
- `/api/cap/refunds` — 10
- `/api/cap/student-edits` — 6
- `/api/cap/charges` — 4
- `/api/notifications` — 5
- `/api/subjects` — 11
- `/api/lessons` — 18
- `/api/assignments` — 11
- `/api/quizzes` — 16
- `/api/grades` — 17
- `/api/progress` — 5
- `/api/certificates` — 24
- `/api/upload (index.js)` — 11

## `/api/public/certificates`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/public/certificates/:code` | PUBLIC |  |

## `/api/auth`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/auth/login` | PUBLIC |  |
| POST | `/api/auth/student-login` | PUBLIC | ✓ |
| GET | `/api/auth/me` | any signed-in | ✓ |
| POST | `/api/auth/refresh` | any signed-in | ✓ |
| PUT | `/api/auth/change-password` | any signed-in | ✓ |
| PATCH | `/api/auth/me` | any signed-in |  |
| GET | `/api/auth/student/dashboard` | any signed-in | ✓ |
| POST | `/api/auth/student/typing/attempt` | any signed-in | ✓ |
| GET | `/api/auth/student/typing/:lessonId/attempts` | any signed-in |  |
| GET | `/api/auth/student/profile` | any signed-in | ✓ |
| GET | `/api/auth/student/fees` | any signed-in | ✓ |
| GET | `/api/auth/student/certificates` | any signed-in | ✓ |
| POST | `/api/auth/student/certificates/request` | any signed-in | ✓ |
| POST | `/api/auth/student/certificates/resubmit` | any signed-in | ✓ |
| GET | `/api/auth/student/lessons` | any signed-in | ✓ |
| GET | `/api/auth/student/lessons/:id` | any signed-in | ✓ |
| GET | `/api/auth/student/courses` | any signed-in | ✓ |
| GET | `/api/auth/student/courses/:courseId/subjects` | any signed-in | ✓ |
| GET | `/api/auth/student/subjects/:subjectId/lessons` | any signed-in | ✓ |
| POST | `/api/auth/student/lessons/:id/complete` | any signed-in | ✓ |
| POST | `/api/auth/student/lessons/:id/progress` | any signed-in | ✓ |
| GET | `/api/auth/student/assignments` | any signed-in | ✓ |
| GET | `/api/auth/student/subjects/:subjectId/assignments` | any signed-in | ✓ |
| GET | `/api/auth/student/assignments/:id` | any signed-in | ✓ |
| POST | `/api/auth/student/assignments/:id/submit` | any signed-in | ✓ |
| GET | `/api/auth/student/assignments/submissions/:submissionId/comments` | any signed-in | ✓ |
| POST | `/api/auth/student/assignments/submissions/:submissionId/comments` | any signed-in | ✓ |
| GET | `/api/auth/student/subjects/:subjectId/quizzes` | any signed-in | ✓ |
| GET | `/api/auth/student/quizzes/:id` | any signed-in | ✓ |
| POST | `/api/auth/student/quizzes/:id/submit` | any signed-in | ✓ |
| GET | `/api/auth/student/quizzes/:id/attempts` | any signed-in | ✓ |
| GET | `/api/auth/student/quizzes/:quizId/attempts/:attemptId` | any signed-in | ✓ |
| GET | `/api/auth/student/progress` | any signed-in | ✓ |
| GET | `/api/auth/student/grades` | any signed-in | ✓ |
| POST | `/api/auth/forgot-password` | PUBLIC |  |
| POST | `/api/auth/reset-password` | PUBLIC |  |
| POST | `/api/auth/google` | PUBLIC |  |

## `/api/users`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/users` | manager, supervisor, academic_supervisor |  |
| GET | `/api/users/:id` | manager, supervisor, academic_supervisor |  |
| POST | `/api/users` | manager, academic_supervisor |  |
| PUT | `/api/users/:id` | manager, academic_supervisor |  |
| PATCH | `/api/users/:id/toggle-status` | manager, academic_supervisor |  |
| DELETE | `/api/users/:id` | manager |  |
| POST | `/api/users/:id/overlays` | manager, academic_supervisor |  |
| DELETE | `/api/users/:id/overlays/:role` | manager |  |
| PUT | `/api/users/:id/reports-to` | manager |  |

## `/api/settings`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/settings` | manager |  |
| GET | `/api/settings/:key` | manager |  |
| POST | `/api/settings` | manager |  |
| PATCH | `/api/settings/:key` | manager |  |
| DELETE | `/api/settings/:key` | manager |  |

## `/api/branches`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/branches` | any signed-in |  |
| GET | `/api/branches/next-code` | manager |  |
| GET | `/api/branches/:id` | any signed-in |  |
| POST | `/api/branches` | manager |  |
| PUT | `/api/branches/:id` | manager |  |
| PATCH | `/api/branches/:id/active` | manager |  |

## `/api/students`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/students` | manager, supervisor, teacher, marketer |  |
| GET | `/api/students/followups/worklist` | manager, supervisor, teacher, marketer |  |
| GET | `/api/students/duplicate-check` | manager, supervisor, marketer |  |
| GET | `/api/students/:id` | manager, supervisor, teacher, marketer |  |
| POST | `/api/students` | manager, supervisor, marketer |  |
| PUT | `/api/students/:id` | manager, supervisor |  |
| GET | `/api/students/:id/payments` | manager, supervisor |  |
| GET | `/api/students/:id/attendance` | manager, supervisor, teacher |  |
| GET | `/api/students/:id/attendance-detail` | manager, supervisor, teacher, marketer |  |
| GET | `/api/students/:id/enrollments` | manager, supervisor, teacher |  |
| POST | `/api/students/:studentId/charges` | manager, supervisor |  |
| POST | `/api/students/:id/set-password` | manager, supervisor, academic_supervisor, teacher |  |
| GET | `/api/students/:id/delete-impact` | manager |  |
| DELETE | `/api/students/:id` | manager |  |
| PATCH | `/api/students/:id/status` | manager |  |
| GET | `/api/students/:id/followups` | any signed-in |  |
| POST | `/api/students/:id/followups` | any signed-in |  |
| DELETE | `/api/students/:id/followups/:fid` | manager |  |

## `/api/legacy`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/legacy/summary` | ...STAFF |  |
| GET | `/api/legacy/students` | ...STAFF |  |
| GET | `/api/legacy/students/:civilId` | ...STAFF |  |
| GET | `/api/legacy/for-student/:studentId` | ...STAFF |  |
| GET | `/api/legacy/history/:studentId` | ...STAFF |  |
| GET | `/api/legacy/files/:kind/:name` | ...STAFF |  |
| GET | `/api/legacy/sync-health` | manager |  |
| POST | `/api/legacy/sync-now` | manager |  |
| GET | `/api/legacy/promote/:civilId` | ...REGISTER |  |
| POST | `/api/legacy/promote/:civilId` | ...REGISTER |  |
| GET | `/api/legacy/promotions` | ...STAFF |  |
| POST | `/api/legacy/promotions/:id/undo` | manager |  |

## `/api/courses`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/courses` | any signed-in |  |
| GET | `/api/courses/:id` | any signed-in |  |
| POST | `/api/courses` | manager, supervisor, academic_supervisor |  |
| PUT | `/api/courses/:id` | manager, supervisor, academic_supervisor |  |
| PATCH | `/api/courses/:id/retire` | manager |  |
| DELETE | `/api/courses/:id` | manager |  |
| GET | `/api/courses/:id/schedules` | any signed-in |  |
| GET | `/api/courses/all/teachers` | manager, supervisor, teacher, marketer |  |
| GET | `/api/courses/:id/teachers` | any signed-in |  |
| POST | `/api/courses/:id/teachers` | manager, supervisor, academic_supervisor |  |
| DELETE | `/api/courses/:id/teachers/:teacherId` | manager, supervisor, academic_supervisor |  |
| POST | `/api/courses/:id/schedules` | manager, supervisor, academic_supervisor |  |
| PUT | `/api/courses/schedules/:id` | manager, supervisor, academic_supervisor |  |
| PATCH | `/api/courses/schedules/:id/toggle` | manager, academic_supervisor |  |
| DELETE | `/api/courses/schedules/:id` | manager, supervisor, academic_supervisor |  |
| GET | `/api/courses/schedules/:id/sessions` | any signed-in |  |
| DELETE | `/api/courses/schedules/:id/sessions` | manager |  |
| DELETE | `/api/courses/sessions/:id` | manager |  |
| GET | `/api/courses/:id/groups` | any signed-in |  |
| POST | `/api/courses/:id/groups` | manager, academic_supervisor |  |
| PATCH | `/api/courses/:id/groups/:groupId/toggle` | manager, academic_supervisor |  |
| DELETE | `/api/courses/:id/groups/:groupId` | manager |  |
| PATCH | `/api/courses/:id/tabs` | manager, academic_supervisor |  |
| GET | `/api/courses/:id/books` | any signed-in |  |
| POST | `/api/courses/:id/books` | manager |  |
| PUT | `/api/courses/:id/books/matrix` | manager |  |
| PATCH | `/api/courses/:id/books/reorder` | manager |  |
| DELETE | `/api/courses/:id/books/:bookId` | manager |  |
| PATCH | `/api/courses/:id/free-books` | manager |  |

## `/api/content`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/content/targets` | manager, supervisor, teacher |  |
| POST | `/api/content/:type/:id/copy` | manager, teacher |  |
| POST | `/api/content/:type/:id/move` | manager |  |

## `/api/preview`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/preview/courses/:courseId` | manager, supervisor, teacher |  |
| GET | `/api/preview/courses/:courseId/subjects` | manager, supervisor, teacher |  |
| GET | `/api/preview/subjects/:subjectId/lessons` | manager, supervisor, teacher |  |
| GET | `/api/preview/subjects/:subjectId/quizzes` | manager, supervisor, teacher |  |
| GET | `/api/preview/subjects/:subjectId/assignments` | manager, supervisor, teacher |  |
| GET | `/api/preview/lessons/:id` | manager, supervisor, teacher |  |
| GET | `/api/preview/quizzes/:id` | manager, supervisor, teacher |  |
| GET | `/api/preview/assignments/:id` | manager, supervisor, teacher |  |

## `/api/public-content`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/public-content/analytics` | any signed-in |  |
| POST | `/api/public-content/lead-alert` | PUBLIC |  |
| GET | `/api/public-content/leads` | manager |  |
| GET | `/api/public-content/leads/attribution` | manager |  |
| GET | `/api/public-content/leads/known` | manager |  |
| GET | `/api/public-content/leads/:id/matches` | manager |  |
| PUT | `/api/public-content/leads/:id` | manager |  |
| POST | `/api/public-content/leads/:id/assign` | manager |  |
| POST | `/api/public-content/leads/delete` | manager |  |
| GET | `/api/public-content/settings` | any signed-in |  |
| PUT | `/api/public-content/settings` | manager |  |
| POST | `/api/public-content/republish` | manager |  |
| GET | `/api/public-content/images` | manager, supervisor |  |
| POST | `/api/public-content/images` | manager, supervisor |  |
| GET | `/api/public-content/:type` | any signed-in |  |
| GET | `/api/public-content/:type/:id` | any signed-in |  |
| POST | `/api/public-content/:type` | manager, supervisor |  |
| PUT | `/api/public-content/:type/:id` | manager, supervisor |  |
| DELETE | `/api/public-content/:type/:id` | manager |  |

## `/api/course-categories`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/course-categories` | any signed-in |  |
| POST | `/api/course-categories` | manager, supervisor |  |
| PUT | `/api/course-categories/:id` | manager, supervisor |  |
| DELETE | `/api/course-categories/:id` | manager |  |

## `/api/enrollments`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/enrollments` | manager, supervisor, teacher |  |
| GET | `/api/enrollments/:id` | manager, supervisor, teacher |  |
| GET | `/api/enrollments/:id/subjects` | manager, supervisor, teacher |  |
| GET | `/api/enrollments/:id/subject-access/history` | manager, supervisor, teacher |  |
| POST | `/api/enrollments/:id/subject-access` | manager, supervisor, academic_supervisor |  |
| DELETE | `/api/enrollments/:id/subject-access/:subjectId` | manager, supervisor, academic_supervisor |  |
| POST | `/api/enrollments/full` | manager, supervisor |  |
| POST | `/api/enrollments` | manager, supervisor |  |
| PUT | `/api/enrollments/:id` | manager, supervisor |  |
| PATCH | `/api/enrollments/:id/teacher` | manager, supervisor, academic_supervisor |  |
| PATCH | `/api/enrollments/:id/attribution` | manager |  |
| POST | `/api/enrollments/:id/withdraw` | manager |  |
| POST | `/api/enrollments/:id/freeze` | manager, supervisor |  |
| POST | `/api/enrollments/:id/unfreeze` | manager, supervisor |  |
| GET | `/api/enrollments/:id/status-history` | manager, supervisor, teacher |  |
| DELETE | `/api/enrollments/:id` | manager |  |
| GET | `/api/enrollments/books/approvals` | manager |  |
| GET | `/api/enrollments/:id/receipt-data` | any signed-in |  |
| POST | `/api/enrollments/:id/email-receipt` | manager, supervisor |  |
| POST | `/api/enrollments/:id/notify-teacher` | manager, supervisor |  |
| GET | `/api/enrollments/:id/books` | any signed-in |  |
| POST | `/api/enrollments/:id/books/claim-free` | manager, supervisor |  |
| POST | `/api/enrollments/:id/books/:courseBookId/buy` | manager, supervisor |  |
| POST | `/api/enrollments/:id/books/:courseBookId/request-free` | manager, supervisor |  |
| POST | `/api/enrollments/:id/books/:releaseId/approve` | manager |  |
| POST | `/api/enrollments/:id/books/:releaseId/reject` | manager |  |

## `/api/payments`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/payments` | manager, supervisor |  |
| GET | `/api/payments/overdue` | manager, supervisor |  |
| GET | `/api/payments/student/:student_id/summary` | manager, supervisor, teacher |  |
| GET | `/api/payments/unrecorded-upfront` | manager, supervisor |  |
| GET | `/api/payments/discount-requests` | manager, supervisor |  |
| POST | `/api/payments/discount-requests/:id/approve` | manager |  |
| POST | `/api/payments/discount-requests/:id/reject` | manager |  |
| GET | `/api/payments/:id` | manager, supervisor |  |
| POST | `/api/payments/schedule` | manager, supervisor |  |
| PUT | `/api/payments/schedule/:id` | manager |  |
| POST | `/api/payments/schedule/:id/discount-override` | manager, supervisor |  |
| POST | `/api/payments` | manager, supervisor |  |
| PUT | `/api/payments/:id` | manager |  |
| DELETE | `/api/payments/:id` | manager |  |

## `/api/payment-methods`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/payment-methods` | manager, supervisor, accountant, invoice_encoder |  |
| GET | `/api/payment-methods/:id` | manager, supervisor, accountant, invoice_encoder |  |
| POST | `/api/payment-methods` | manager |  |
| PUT | `/api/payment-methods/:id` | manager |  |
| DELETE | `/api/payment-methods/:id` | manager |  |

## `/api/uploads`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/uploads/payment-proof` | manager, supervisor, cap_coordinator, invoice_encoder, accountant |  |

## `/api/payment-proofs`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/payment-proofs` | any signed-in | ✓ |
| GET | `/api/payment-proofs/mine` | any signed-in | ✓ |
| GET | `/api/payment-proofs/methods` | any signed-in | ✓ |
| GET | `/api/payment-proofs` | manager, supervisor |  |
| POST | `/api/payment-proofs/:id/approve` | manager, supervisor |  |
| POST | `/api/payment-proofs/:id/reject` | manager, supervisor |  |

## `/api/refunds`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/refunds` | manager, supervisor |  |
| GET | `/api/refunds/:id` | manager, supervisor |  |
| POST | `/api/refunds` | manager, supervisor |  |
| POST | `/api/refunds/:id/approve` | manager |  |
| POST | `/api/refunds/:id/reject` | manager |  |
| POST | `/api/refunds/:id/approve-without-proof` | manager |  |
| POST | `/api/refunds/:id/complete` | manager, supervisor |  |
| PUT | `/api/refunds/:id` | manager, supervisor |  |
| DELETE | `/api/refunds/:id` | manager, supervisor |  |

## `/api/payment-transfers`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/payment-transfers` | manager, supervisor |  |
| GET | `/api/payment-transfers/find-target` | manager, supervisor |  |
| GET | `/api/payment-transfers/source/:enrollmentId` | manager, supervisor |  |
| POST | `/api/payment-transfers` | manager, supervisor |  |
| POST | `/api/payment-transfers/:id/approve` | manager |  |
| POST | `/api/payment-transfers/:id/reject` | manager |  |
| POST | `/api/payment-transfers/:id/cancel` | manager, supervisor |  |

## `/api/fee-items`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/fee-items` | manager, supervisor |  |
| GET | `/api/fee-items/:id` | manager, supervisor |  |
| POST | `/api/fee-items` | manager |  |
| PUT | `/api/fee-items/:id` | manager |  |
| DELETE | `/api/fee-items/:id` | manager |  |

## `/api/job-orders`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/job-orders/reports/summary` | manager, supervisor |  |
| GET | `/api/job-orders/staff` | manager, supervisor |  |
| GET | `/api/job-orders` | manager, supervisor, teacher |  |
| GET | `/api/job-orders/:id` | manager, supervisor, teacher |  |
| POST | `/api/job-orders` | manager, supervisor |  |
| DELETE | `/api/job-orders/:id` | manager, supervisor |  |
| PUT | `/api/job-orders/:id` | manager, supervisor, teacher |  |
| PATCH | `/api/job-orders/:id/status` | manager, supervisor, teacher |  |
| POST | `/api/job-orders/:id/logs` | manager, supervisor, teacher |  |
| PATCH | `/api/job-orders/:id/payment` | manager, supervisor |  |

## `/api/student-charges`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/student-charges` | manager, supervisor |  |
| GET | `/api/student-charges/:id` | manager, supervisor |  |
| PUT | `/api/student-charges/:id` | manager |  |

## `/api/inventory`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/inventory/items` | manager, supervisor |  |
| GET | `/api/inventory/items/:id` | manager, supervisor |  |
| GET | `/api/inventory/items/:id/movements` | manager, supervisor |  |
| GET | `/api/inventory/items/:id/detail` | manager, supervisor |  |
| POST | `/api/inventory/items` | manager |  |
| PUT | `/api/inventory/items/:id` | manager |  |
| DELETE | `/api/inventory/items/:id` | manager |  |
| POST | `/api/inventory/items/:id/adjust` | manager |  |
| GET | `/api/inventory/sales` | manager, supervisor |  |
| GET | `/api/inventory/sales-register` | manager, supervisor |  |
| GET | `/api/inventory/sales/:id` | manager, supervisor |  |
| GET | `/api/inventory/suppliers` | manager, supervisor |  |
| POST | `/api/inventory/suppliers` | manager, supervisor |  |
| GET | `/api/inventory/receipts` | manager, supervisor |  |
| GET | `/api/inventory/receipts/:id` | manager, supervisor |  |
| POST | `/api/inventory/receipts` | manager, supervisor |  |
| POST | `/api/inventory/receipts/:id/void` | manager |  |
| GET | `/api/inventory/transfers` | manager, supervisor |  |
| GET | `/api/inventory/transfers/:id` | manager, supervisor |  |
| POST | `/api/inventory/transfers` | manager, supervisor |  |
| POST | `/api/inventory/transfers/:id/receive` | manager, supervisor |  |
| POST | `/api/inventory/transfers/:id/cancel` | manager, supervisor |  |
| GET | `/api/inventory/counts` | manager, supervisor |  |
| GET | `/api/inventory/counts/:id` | manager, supervisor |  |
| POST | `/api/inventory/counts` | manager, supervisor |  |
| PUT | `/api/inventory/counts/:id/lines` | manager, supervisor |  |
| POST | `/api/inventory/counts/:id/submit` | manager, supervisor |  |
| POST | `/api/inventory/counts/:id/approve` | manager |  |
| POST | `/api/inventory/counts/:id/send-back` | manager |  |
| POST | `/api/inventory/counts/:id/cancel` | manager, supervisor |  |
| GET | `/api/inventory/overview` | manager, supervisor |  |
| GET | `/api/inventory/reports` | manager, supervisor |  |
| GET | `/api/inventory/reports/export` | manager, supervisor |  |

## `/api/attendance`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/attendance/my-context` | student | ✓ |
| POST | `/api/attendance/check-in` | student | ✓ |
| POST | `/api/attendance/check-out` | student | ✓ |
| POST | `/api/attendance/attended-at-branch` | student | ✓ |
| GET | `/api/attendance/my-history` | student | ✓ |
| POST | `/api/attendance/my-teacher` | student | ✓ |
| GET | `/api/attendance/staff-context` | teacher, supervisor, manager |  |
| POST | `/api/attendance/sessions/:session_id/confirm` | teacher, supervisor, manager |  |
| POST | `/api/attendance/individual/:enrollment_id/confirm` | teacher, supervisor, manager |  |
| PATCH | `/api/attendance/sessions/:session_id/substitute-teacher` | supervisor, manager, academic_supervisor |  |
| POST | `/api/attendance/manual` | manager |  |
| GET | `/api/attendance/staff-range` | teacher, supervisor, manager |  |
| POST | `/api/attendance/confirm-present` | teacher, supervisor, manager |  |
| GET | `/api/attendance/records/:attendance_id/teacher-options` | manager, academic_supervisor |  |
| PATCH | `/api/attendance/records/:attendance_id/teacher` | manager, academic_supervisor |  |

## `/api/dashboard`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/dashboard` | manager, supervisor, accountant, cap_coordinator |  |
| GET | `/api/dashboard/approvals` | manager, supervisor |  |
| GET | `/api/dashboard/teacher` | teacher |  |
| GET | `/api/dashboard/student` | student | ✓ |

## `/api/audit`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/audit` | manager |  |
| GET | `/api/audit/filters` | manager |  |
| GET | `/api/audit/student/:student_id` | manager |  |

## `/api/search`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/search/students` | manager, supervisor, teacher |  |
| GET | `/api/search/all` | manager, supervisor, teacher, marketer, accountant |  |

## `/api/salary`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/salary` | manager, accountant |  |
| GET | `/api/salary/mine` | any signed-in |  |
| GET | `/api/salary/mine/:id` | any signed-in |  |
| POST | `/api/salary/:id/accept` | any signed-in |  |
| POST | `/api/salary/:id/request-review` | any signed-in |  |
| POST | `/api/salary/:id/resolve-review` | manager |  |
| GET | `/api/salary/:id` | manager, accountant |  |
| POST | `/api/salary` | manager |  |
| PUT | `/api/salary/:id` | manager |  |
| GET | `/api/salary/:id/bonuses` | manager, accountant |  |
| POST | `/api/salary/:id/bonuses` | manager |  |
| PATCH | `/api/salary/bonuses/:id/approve` | manager |  |
| GET | `/api/salary/:id/deductions` | manager, accountant |  |
| POST | `/api/salary/:id/deductions` | manager |  |
| PATCH | `/api/salary/deductions/:id/approve` | manager |  |
| PUT | `/api/salary/bonuses/:id` | manager |  |
| DELETE | `/api/salary/bonuses/:id` | manager |  |
| PUT | `/api/salary/deductions/:id` | manager |  |
| DELETE | `/api/salary/deductions/:id` | manager |  |
| POST | `/api/salary/:id/pay` | manager |  |
| POST | `/api/salary/:id/unpay` | manager |  |
| DELETE | `/api/salary/:id` | manager |  |

## `/api/teacher-bonus`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/teacher-bonus/me` | manager, academic_supervisor, teacher |  |
| GET | `/api/teacher-bonus/teacher/:teacherId` | manager, academic_supervisor, teacher |  |
| GET | `/api/teacher-bonus/ledger` | manager, academic_supervisor, teacher |  |
| GET | `/api/teacher-bonus/rates/:teacherId` | manager, academic_supervisor, teacher |  |
| GET | `/api/teacher-bonus/overview` | manager, academic_supervisor |  |
| POST | `/api/teacher-bonus/rates/:teacherId` | manager |  |
| POST | `/api/teacher-bonus/months/:ym/close` | manager |  |
| POST | `/api/teacher-bonus/months/:ym/reopen` | manager |  |

## `/api/expenses`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/expenses/categories` | manager, supervisor, accountant, invoice_encoder |  |
| GET | `/api/expenses` | manager, supervisor, accountant, invoice_encoder |  |
| GET | `/api/expenses/:id` | manager, supervisor, accountant, invoice_encoder |  |
| POST | `/api/expenses` | manager, supervisor, accountant, invoice_encoder |  |
| PUT | `/api/expenses/:id` | manager, supervisor, accountant, invoice_encoder |  |
| PATCH | `/api/expenses/:id/payment` | manager, supervisor, accountant |  |
| DELETE | `/api/expenses/:id` | manager, supervisor, accountant |  |

## `/api/recurring-expenses`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/recurring-expenses/generate` | manager |  |
| GET | `/api/recurring-expenses` | manager |  |
| POST | `/api/recurring-expenses` | manager |  |
| PUT | `/api/recurring-expenses/:id` | manager |  |
| DELETE | `/api/recurring-expenses/:id` | manager |  |

## `/api/referrals`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/referrals/public/branches` | PUBLIC |  |
| GET | `/api/referrals/public/courses` | PUBLIC |  |
| GET | `/api/referrals/public/link/:token` | PUBLIC |  |
| GET | `/api/referrals` | manager, supervisor, marketer |  |
| PATCH | `/api/referrals/:id/status` | manager |  |
| POST | `/api/referrals/pdf` | manager, supervisor, marketer |  |
| GET | `/api/referrals/links` | any signed-in |  |
| POST | `/api/referrals/links` | any signed-in |  |
| PATCH | `/api/referrals/links/:id` | any signed-in |  |
| GET | `/api/referrals/link-courses` | manager, supervisor, marketer |  |
| POST | `/api/referrals/link-courses` | manager |  |
| PATCH | `/api/referrals/link-courses/:id` | manager |  |
| POST | `/api/referrals/prospects` | PUBLIC |  |
| GET | `/api/referrals/prospects` | manager, supervisor, marketer |  |
| GET | `/api/referrals/lost-reasons` | manager, supervisor, marketer, accountant |  |
| GET | `/api/referrals/prospects/lost-no-reason` | manager, supervisor, marketer |  |
| POST | `/api/referrals/prospects/lost-reason` | manager, supervisor, marketer |  |
| GET | `/api/referrals/prospects/lookup` | manager, supervisor, marketer |  |
| GET | `/api/referrals/prospects/by-crs/:crs_number` | manager, supervisor, marketer |  |
| GET | `/api/referrals/prospects/:id` | manager, supervisor, marketer |  |
| PATCH | `/api/referrals/prospects/:id/convert` | manager, supervisor |  |
| PATCH | `/api/referrals/prospects/:id/status` | manager, supervisor, marketer |  |
| PATCH | `/api/referrals/prospects/:id/notes` | manager, supervisor, marketer |  |
| GET | `/api/referrals/prospects/:id/activity` | manager, supervisor, marketer |  |
| POST | `/api/referrals/prospects/:id/followup` | manager, supervisor, marketer |  |
| PATCH | `/api/referrals/prospects/:id/reassign` | manager |  |
| PATCH | `/api/referrals/prospects/:id` | manager, supervisor, marketer |  |
| POST | `/api/referrals/prospects/reassign-bulk` | manager |  |
| POST | `/api/referrals/prospects/reassign-preview` | manager |  |
| POST | `/api/referrals/prospects/reassign-undo/:batch_id` | manager |  |
| GET | `/api/referrals/transfers/recipients` | manager, supervisor, marketer |  |
| GET | `/api/referrals/transfers` | manager, supervisor, marketer |  |
| POST | `/api/referrals/transfers/:id/respond` | manager, supervisor, marketer |  |
| POST | `/api/referrals/prospects/:id/transfer` | manager, supervisor, marketer |  |

## `/api/careers`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/careers/public/form/:slug` | PUBLIC |  |
| POST | `/api/careers/apply` | PUBLIC |  |
| GET | `/api/careers/form-catalogue` | manager |  |
| GET | `/api/careers/openings` | manager |  |
| POST | `/api/careers/openings` | manager |  |
| GET | `/api/careers/openings/:id` | manager |  |
| PUT | `/api/careers/openings/:id` | manager |  |
| DELETE | `/api/careers/openings/:id` | manager |  |
| GET | `/api/careers/applications` | manager |  |
| GET | `/api/careers/applications/:id` | manager |  |
| PATCH | `/api/careers/applications/:id` | manager |  |
| POST | `/api/careers/applications/:id/notes` | manager |  |
| DELETE | `/api/careers/applications/:id` | manager |  |
| GET | `/api/careers/applications/:id/cv` | manager |  |

## `/api/email-alerts`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/email-alerts` | manager |  |
| PUT | `/api/email-alerts` | manager |  |
| POST | `/api/email-alerts/test` | manager |  |

## `/api/coupon-templates`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/coupon-templates` | manager, marketer |  |
| GET | `/api/coupon-templates/:id` | manager, marketer |  |
| POST | `/api/coupon-templates` | manager |  |
| PATCH | `/api/coupon-templates/:id` | manager |  |
| DELETE | `/api/coupon-templates/:id` | manager |  |

## `/api/coupons`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/coupons/validate` | any signed-in |  |
| GET | `/api/coupons/for-phone` | manager, supervisor, marketer, accountant, teacher |  |
| POST | `/api/coupons/redeem` | any signed-in |  |
| GET | `/api/coupons/ambassador/pending` | manager |  |
| GET | `/api/coupons/ambassador/balances` | manager |  |
| POST | `/api/coupons/ambassador/payouts` | manager |  |
| GET | `/api/coupons/ambassador/settings` | manager |  |
| PATCH | `/api/coupons/ambassador/settings` | manager |  |
| POST | `/api/coupons/redemptions/:id/award` | manager |  |
| GET | `/api/coupons/:id/image` | PUBLIC |  |
| GET | `/api/coupons/:id/card` | PUBLIC |  |
| POST | `/api/coupons/:id/image` | manager, marketer |  |
| DELETE | `/api/coupons/:id/image` | manager |  |
| PATCH | `/api/coupons/:id/theme` | manager |  |
| GET | `/api/coupons` | manager, marketer |  |
| GET | `/api/coupons/:id` | manager, marketer |  |
| POST | `/api/coupons` | manager, marketer |  |
| PATCH | `/api/coupons/:id` | manager |  |
| PATCH | `/api/coupons/:id/approve` | manager |  |
| PATCH | `/api/coupons/:id/reject` | manager |  |
| PATCH | `/api/coupons/:id/enable` | manager |  |
| PATCH | `/api/coupons/:id/disable` | manager |  |
| DELETE | `/api/coupons/:id` | manager |  |

## `/api/ambassador`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/ambassador/me` | student | ✓ |
| POST | `/api/ambassador/vouchers` | student | ✓ |
| POST | `/api/ambassador/shared` | student | ✓ |
| POST | `/api/ambassador/claims` | student | ✓ |

## `/api/rewards`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/rewards/dashboard` | manager |  |
| GET | `/api/rewards/ledger` | manager |  |
| GET | `/api/rewards/rules` | manager |  |
| PUT | `/api/rewards/rules` | manager |  |
| PUT | `/api/rewards/course-rules/:courseId` | manager |  |
| DELETE | `/api/rewards/course-rules/:courseId` | manager |  |
| GET | `/api/rewards/issuers` | manager |  |
| PUT | `/api/rewards/issuers/:userId` | manager |  |
| GET | `/api/rewards/wallet` | manager |  |
| POST | `/api/rewards/wallet/adjust` | manager |  |
| POST | `/api/rewards/catalogue` | manager |  |
| PATCH | `/api/rewards/catalogue/:id` | manager |  |
| GET | `/api/rewards/claims` | manager |  |
| POST | `/api/rewards/claims/:id/decide` | manager |  |
| GET | `/api/rewards/staff-payouts` | manager |  |
| POST | `/api/rewards/staff-payouts` | manager |  |
| DELETE | `/api/rewards/staff-payouts/:walletId` | manager |  |
| POST | `/api/rewards/settle` | manager |  |
| GET | `/api/rewards/old-referrals` | manager |  |
| POST | `/api/rewards/old-referrals/sync` | manager |  |
| POST | `/api/rewards/old-referrals/hold` | manager |  |
| GET | `/api/rewards/mine` | marketer, teacher |  |
| GET | `/api/rewards/teacher-students` | teacher |  |
| POST | `/api/rewards/codes` | marketer, teacher |  |
| GET | `/api/rewards/codes/:id/history` | manager, marketer, teacher |  |
| POST | `/api/rewards/codes/:id/shared` | manager, marketer, teacher |  |
| POST | `/api/rewards/codes/:id/void` | manager, marketer, teacher |  |
| GET | `/api/rewards/catalogue` | manager, marketer, teacher |  |
| POST | `/api/rewards/claims` | marketer, teacher |  |

## `/api/followups`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/followups/mine` | any signed-in |  |
| GET | `/api/followups/cases/:id` | any signed-in |  |
| POST | `/api/followups/cases/:id/log` | any signed-in |  |
| POST | `/api/followups/cases/:id/close` | manager, supervisor, academic_supervisor |  |
| POST | `/api/followups/cases/:id/keep` | manager, supervisor, academic_supervisor |  |
| POST | `/api/followups/cases/assign` | manager, supervisor, academic_supervisor |  |
| POST | `/api/followups/cases/:id/assign` | manager, supervisor, academic_supervisor |  |
| GET | `/api/followups/centre` | manager, supervisor, academic_supervisor |  |
| GET | `/api/followups/list` | manager, supervisor, academic_supervisor |  |
| GET | `/api/followups/cases` | manager, supervisor, academic_supervisor |  |
| GET | `/api/followups/digest` | manager, supervisor, academic_supervisor |  |
| POST | `/api/followups/digest/test` | manager, supervisor, academic_supervisor |  |

## `/api/marketer-targets`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/marketer-targets` | manager |  |
| POST | `/api/marketer-targets` | manager |  |
| GET | `/api/marketer-targets/my-progress` | any signed-in |  |
| DELETE | `/api/marketer-targets/:id` | manager |  |

## `/api/branch-targets`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/branch-targets` | manager |  |
| POST | `/api/branch-targets` | manager |  |
| DELETE | `/api/branch-targets/:id` | manager |  |

## `/api/reports`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/reports/dashboard` | manager, supervisor, accountant |  |
| GET | `/api/reports/financial` | manager, supervisor, accountant |  |
| GET | `/api/reports/overdue` | manager, supervisor, accountant |  |
| GET | `/api/reports/students` | manager, supervisor |  |
| GET | `/api/reports/attendance` | manager, supervisor, teacher |  |
| GET | `/api/reports/marketers` | manager, supervisor, accountant, marketer |  |
| GET | `/api/reports/marketers/pdf` | manager, supervisor, accountant, marketer |  |
| GET | `/api/reports/marketers/pipeline` | manager, supervisor, marketer |  |
| GET | `/api/reports/marketers/:marketer_id/sheet.pdf` | manager, supervisor, accountant, marketer |  |
| GET | `/api/reports/marketers/:marketer_id` | manager, supervisor, accountant, marketer |  |
| GET | `/api/reports/branch-detail` | manager, supervisor, accountant |  |
| GET | `/api/reports/refunds` | manager, supervisor, accountant |  |
| GET | `/api/reports/charges-services` | manager, supervisor, accountant |  |
| GET | `/api/reports/course-revenue` | manager, supervisor, accountant |  |
| GET | `/api/reports/today-summary` | manager, supervisor, accountant |  |
| GET | `/api/reports/transactions` | manager, supervisor, accountant |  |
| GET | `/api/reports/leads` | manager, supervisor |  |
| GET | `/api/reports/monthly` | manager, supervisor, accountant |  |
| GET | `/api/reports/income-statement` | manager, accountant |  |
| GET | `/api/reports/custom/options` | ...CUSTOM |  |
| POST | `/api/reports/custom/run` | ...CUSTOM |  |
| POST | `/api/reports/custom/export` | ...CUSTOM |  |
| GET | `/api/reports/custom/saved` | ...CUSTOM |  |
| POST | `/api/reports/custom/saved` | ...CUSTOM |  |
| GET | `/api/reports/custom/saved/:id` | ...CUSTOM |  |
| PUT | `/api/reports/custom/saved/:id` | ...CUSTOM |  |
| DELETE | `/api/reports/custom/saved/:id` | ...CUSTOM |  |
| GET | `/api/reports/custom/saved/:id/schedule` | ...CUSTOM |  |
| PUT | `/api/reports/custom/saved/:id/schedule` | ...CUSTOM |  |
| DELETE | `/api/reports/custom/saved/:id/schedule` | ...CUSTOM |  |
| POST | `/api/reports/custom/saved/:id/send-now` | ...CUSTOM |  |

## `/api/roadmap`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/roadmap` | manager, supervisor |  |
| POST | `/api/roadmap` | manager, supervisor |  |
| PATCH | `/api/roadmap/:id` | manager, supervisor |  |
| DELETE | `/api/roadmap/:id` | manager |  |

## `/api/id-extract`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/id-extract` | manager, supervisor |  |
| GET | `/api/id-extract/areas` | manager, supervisor |  |

## `/api/cap`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/degrees` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/degrees` | manager |  |
| PUT | `/api/cap/degrees/:id` | manager |  |
| GET | `/api/cap/subjects` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/subjects` | manager |  |
| PUT | `/api/cap/subjects/:id` | manager |  |
| GET | `/api/cap/pricing` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/pricing` | manager |  |
| POST | `/api/cap/pricing/bulk` | manager |  |
| GET | `/api/cap/batches` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/batches` | manager |  |
| PUT | `/api/cap/batches/:id` | manager |  |
| GET | `/api/cap/countries` | manager, supervisor, cap_coordinator, accountant |  |
| GET | `/api/cap/curriculum` | manager, supervisor, cap_coordinator, accountant |  |
| GET | `/api/cap/terms` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/terms` | manager |  |
| PUT | `/api/cap/terms/reorder` | manager |  |
| POST | `/api/cap/terms/:id/subjects` | manager |  |
| PUT | `/api/cap/terms/:id` | manager |  |
| DELETE | `/api/cap/terms/:id` | manager |  |
| PUT | `/api/cap/subject-order` | manager |  |

## `/api/cap/students`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/students` | manager, supervisor, cap_coordinator |  |
| GET | `/api/cap/students/:id` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/students` | manager, supervisor, cap_coordinator |  |
| PUT | `/api/cap/students/:id` | manager |  |
| GET | `/api/cap/students/:id/audit` | manager |  |

## `/api/cap/enrollments`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/enrollments/by-student/:capStudentId` | manager, supervisor, cap_coordinator |  |
| GET | `/api/cap/enrollments/pricing-preview` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/enrollments` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/enrollments/sessions/:sessionId/payments` | manager, supervisor, cap_coordinator |  |

## `/api/cap/reports`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/reports/transactions` | manager, supervisor, accountant, cap_coordinator |  |

## `/api/cap/refunds`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/refunds` | manager, supervisor, accountant, cap_coordinator |  |
| GET | `/api/cap/refunds/:id` | manager, supervisor, accountant, cap_coordinator |  |
| POST | `/api/cap/refunds` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/refunds/charge` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/refunds/return` | manager, supervisor, cap_coordinator |  |
| PUT | `/api/cap/refunds/:id` | manager, supervisor, cap_coordinator |  |
| DELETE | `/api/cap/refunds/:id` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/refunds/:id/approve` | manager |  |
| POST | `/api/cap/refunds/:id/reject` | manager |  |
| POST | `/api/cap/refunds/:id/complete` | manager, supervisor, cap_coordinator |  |

## `/api/cap/student-edits`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/student-edits` | manager, supervisor, accountant, cap_coordinator |  |
| GET | `/api/cap/student-edits/:id` | manager, supervisor, accountant, cap_coordinator |  |
| POST | `/api/cap/student-edits` | supervisor, cap_coordinator |  |
| POST | `/api/cap/student-edits/:id/apply` | manager |  |
| POST | `/api/cap/student-edits/:id/reject` | manager |  |
| POST | `/api/cap/student-edits/:id/cancel` | supervisor, cap_coordinator |  |

## `/api/cap/charges`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/cap/charges` | manager, supervisor, cap_coordinator, accountant |  |
| GET | `/api/cap/charges/:id` | manager, supervisor, cap_coordinator, accountant |  |
| POST | `/api/cap/charges` | manager, supervisor, cap_coordinator |  |
| POST | `/api/cap/charges/:id/payments` | manager, supervisor, cap_coordinator |  |

## `/api/notifications`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/notifications` | any signed-in |  |
| GET | `/api/notifications/unread-count` | any signed-in |  |
| POST | `/api/notifications/:id/read` | any signed-in |  |
| POST | `/api/notifications/read-all` | any signed-in |  |
| DELETE | `/api/notifications/:id` | any signed-in |  |

## `/api/subjects`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/subjects` | manager, supervisor, teacher |  |
| GET | `/api/subjects/:id` | manager, supervisor, teacher |  |
| GET | `/api/subjects/:id/access` | manager, supervisor, teacher |  |
| PATCH | `/api/subjects/reorder` | manager, supervisor, teacher |  |
| POST | `/api/subjects` | manager, supervisor, teacher |  |
| PUT | `/api/subjects/:id` | manager, supervisor, teacher |  |
| DELETE | `/api/subjects/:id` | manager, supervisor, teacher |  |
| POST | `/api/subjects/:id/access` | manager, supervisor, academic_supervisor |  |
| DELETE | `/api/subjects/:id/access/:student_id` | manager, supervisor, academic_supervisor |  |
| POST | `/api/subjects/:id/access/:student_id/extend` | manager, supervisor, academic_supervisor |  |
| POST | `/api/subjects/:id/access/:student_id/active` | manager, supervisor, academic_supervisor |  |

## `/api/lessons`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/lessons/index-page/:subjectId` | manager, supervisor, teacher |  |
| PUT | `/api/lessons/index-page/:subjectId` | manager, supervisor, teacher |  |
| DELETE | `/api/lessons/index-page/:subjectId` | manager, supervisor, teacher |  |
| GET | `/api/lessons` | manager, supervisor, teacher |  |
| POST | `/api/lessons/interactive/count` | manager, supervisor, teacher |  |
| GET | `/api/lessons/:id/interactive/progress` | manager, supervisor, teacher |  |
| GET | `/api/lessons/:id` | manager, supervisor, teacher |  |
| GET | `/api/lessons/curriculum/:subjectId` | manager, supervisor, teacher |  |
| POST | `/api/lessons` | manager, supervisor, teacher |  |
| PUT | `/api/lessons/:id` | manager, supervisor, teacher |  |
| DELETE | `/api/lessons/:id` | manager, supervisor, teacher |  |
| PUT | `/api/lessons/:id/resources` | manager, supervisor, teacher |  |
| POST | `/api/lessons/:id/move` | manager, supervisor, teacher |  |
| PATCH | `/api/lessons/:id/publish` | manager, supervisor, teacher |  |
| PUT | `/api/lessons/curriculum/:subjectId/order` | manager, supervisor, teacher |  |
| POST | `/api/lessons/:id/duplicate` | manager, supervisor, teacher |  |
| PUT | `/api/lessons/:id/interactive` | manager, supervisor, teacher |  |
| PATCH | `/api/lessons/:id/interactive/quiz-mode` | manager, supervisor, teacher |  |

## `/api/assignments`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/assignments/review-queue` | manager, supervisor, teacher |  |
| GET | `/api/assignments` | manager, supervisor, teacher |  |
| GET | `/api/assignments/:id/submissions` | manager, supervisor, teacher |  |
| POST | `/api/assignments` | manager, supervisor, teacher |  |
| PUT | `/api/assignments/:id` | manager, supervisor, teacher |  |
| DELETE | `/api/assignments/:id` | manager, supervisor, teacher |  |
| POST | `/api/assignments/:id/attachment` | manager, supervisor, teacher |  |
| DELETE | `/api/assignments/:id/attachment` | manager, supervisor, teacher |  |
| POST | `/api/assignments/submissions/:submissionId/review` | manager, supervisor, teacher |  |
| GET | `/api/assignments/submissions/:submissionId/comments` | any signed-in |  |
| POST | `/api/assignments/submissions/:submissionId/comments` | any signed-in |  |

## `/api/quizzes`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/quizzes` | manager, supervisor, teacher |  |
| GET | `/api/quizzes/:id/full` | manager, supervisor, teacher |  |
| POST | `/api/quizzes` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/import/read` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/import` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/try-sheet` | manager, supervisor, teacher |  |
| PUT | `/api/quizzes/:id` | manager, supervisor, teacher |  |
| DELETE | `/api/quizzes/:id` | manager, supervisor, teacher |  |
| PUT | `/api/quizzes/:id/questions` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/try-typed` | manager, supervisor, teacher |  |
| GET | `/api/quizzes/:id/settings-impact` | manager, supervisor, teacher |  |
| GET | `/api/quizzes/:quizId/attempts/:attemptId/review` | manager, supervisor, teacher |  |
| GET | `/api/quizzes/:id/rescores` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/:id/rescore/preview` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/:id/rescore` | manager, supervisor, teacher |  |
| POST | `/api/quizzes/:id/rescore/:rescoreId/undo` | manager, supervisor, teacher |  |

## `/api/grades`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/grades/report-cards` | manager, supervisor, teacher, marketer |  |
| POST | `/api/grades/report-cards` | manager, supervisor, teacher |  |
| GET | `/api/grades/report-cards/:id` | manager, supervisor, teacher, marketer |  |
| POST | `/api/grades/report-cards/:id/revoke` | manager |  |
| GET | `/api/grades/student/:studentId` | manager, supervisor, teacher, marketer |  |
| POST | `/api/grades/enrollments/:enrollmentId/override` | manager, teacher |  |
| DELETE | `/api/grades/overrides/:id` | manager, teacher |  |
| GET | `/api/grades/subjects/:subjectId/final-exam` | manager, supervisor, teacher |  |
| PUT | `/api/grades/subjects/:subjectId/final-exam` | manager, supervisor, teacher |  |
| DELETE | `/api/grades/subjects/:subjectId/final-exam` | manager, supervisor, teacher |  |
| PUT | `/api/grades/subjects/:subjectId/final-exam/paper-required` | manager |  |
| PUT | `/api/grades/final-exams/:examId/scores/:studentId` | manager, supervisor, teacher |  |
| DELETE | `/api/grades/final-exams/:examId/scores/:studentId` | manager, supervisor, teacher |  |
| PUT | `/api/grades/subjects/:subjectId/final-exam/quiz` | manager, supervisor, teacher |  |
| DELETE | `/api/grades/subjects/:subjectId/final-exam/quiz` | manager, supervisor, teacher |  |
| POST | `/api/grades/final-exams/:examId/unlocks/:studentId` | manager, teacher |  |
| DELETE | `/api/grades/final-exams/:examId/unlocks/:studentId` | manager, teacher |  |

## `/api/progress`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/progress/courses/:courseId/roster` | manager, supervisor, teacher, marketer |  |
| GET | `/api/progress/my-classes` | teacher |  |
| GET | `/api/progress/students/:studentId` | manager, supervisor, teacher, marketer |  |
| GET | `/api/progress/subjects/:subjectId/class` | manager, supervisor, teacher, marketer |  |
| GET | `/api/progress/subjects/:subjectId/students/:studentId` | manager, supervisor, teacher, marketer |  |

## `/api/certificates`

| Method | Path | Roles | Student |
|---|---|---|---|
| GET | `/api/certificates/eligibility` | manager, supervisor, teacher |  |
| GET | `/api/certificates` | manager, supervisor, teacher, marketer |  |
| POST | `/api/certificates` | any signed-in |  |
| GET | `/api/certificates/requests` | manager, supervisor, teacher |  |
| POST | `/api/certificates/requests` | manager, supervisor, teacher |  |
| GET | `/api/certificates/requests/:id/preview` | manager, academic_supervisor |  |
| PATCH | `/api/certificates/requests/:id/overrides` | manager, academic_supervisor |  |
| POST | `/api/certificates/requests/:id/photo` | manager, academic_supervisor |  |
| POST | `/api/certificates/requests/:id/approve` | manager |  |
| POST | `/api/certificates/requests/:id/decline` | manager |  |
| GET | `/api/certificates/queue` | manager, academic_supervisor, supervisor, teacher |  |
| GET | `/api/certificates/requests/precheck` | manager, academic_supervisor, supervisor, teacher |  |
| GET | `/api/certificates/requests/:id/detail` | manager, academic_supervisor, supervisor, teacher |  |
| POST | `/api/certificates/requests/:id/forward` | manager, academic_supervisor |  |
| POST | `/api/certificates/requests/:id/send-back` | manager, academic_supervisor |  |
| POST | `/api/certificates/requests/:id/resubmit` | manager, academic_supervisor, supervisor, teacher |  |
| POST | `/api/certificates/requests/:id/mark-ready` | manager, academic_supervisor |  |
| POST | `/api/certificates/requests/:id/collected` | manager, supervisor |  |
| POST | `/api/certificates/requests/:id/note` | manager, academic_supervisor, supervisor, teacher |  |
| GET | `/api/certificates/completion/enrollment/:enrollmentId` | manager, supervisor, teacher |  |
| GET | `/api/certificates/completion/course/:courseId` | manager |  |
| GET | `/api/certificates/completion/course/:courseId/history` | manager |  |
| POST | `/api/certificates/:id/revoke` | manager |  |
| GET | `/api/certificates/:id` | manager, supervisor, teacher, marketer |  |

## `/api/upload (index.js)`

| Method | Path | Roles | Student |
|---|---|---|---|
| POST | `/api/upload/student` | canUploadStudentDoc |  |
| POST | `/api/upload/user` | canUploadUserPhoto |  |
| POST | `/api/upload/cap-student` | canUploadCapDoc |  |
| POST | `/api/upload/subject-image` | canAuthorContent |  |
| POST | `/api/upload/course-image` | canUploadCourseImage |  |
| POST | `/api/upload/lesson-pdf` | canAuthorContent |  |
| POST | `/api/upload/lesson-material` | canAuthorContent |  |
| POST | `/api/upload/lesson-html` | canAuthorContent |  |
| POST | `/api/upload/assignment-file` | canSubmitAssignment | ✓ |
| POST | `/api/upload/quiz-image` | canAuthorContent |  |
| GET | `/api/health` | PUBLIC |  |
