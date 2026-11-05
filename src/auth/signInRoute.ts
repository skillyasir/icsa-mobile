// Which AMS sign-in endpoint an identifier goes to — the web login's own rule
// (AMS client/src/pages/auth/Login.js, handleSubmit). One owner: signInRoute.check.ts
// reads that file and fails if the two ever differ.
//
//   bare digits (22607084) or STU-…   → POST /auth/student-login { student_code }
//   anything else (email, username)  → POST /auth/login         { email }
//
// The staff endpoint also falls through to student resolution when no staff
// row matches, so a student typing their email still gets in — exactly as on
// the web. Both endpoints trim on the server; the app trims too, so an
// autofilled trailing space cannot change which endpoint is asked.

export const STUDENT_CODE_PATTERNS: readonly RegExp[] = [/^[0-9]+$/, /^STU-/i];

export type SignInRoute =
  | { kind: 'student'; path: '/auth/student-login'; body: (password: string, turnstileToken: string) => Record<string, string> }
  | { kind: 'staff'; path: '/auth/login'; body: (password: string, turnstileToken: string) => Record<string, string> };

export function isStudentCode(identifier: string): boolean {
  const id = String(identifier).trim();
  return STUDENT_CODE_PATTERNS.some((re) => re.test(id));
}

export function signInRoute(identifier: string): SignInRoute {
  const id = String(identifier).trim();
  return isStudentCode(id)
    ? { kind: 'student', path: '/auth/student-login', body: (password, turnstileToken) => ({ student_code: id, password, turnstileToken }) }
    : { kind: 'staff', path: '/auth/login', body: (password, turnstileToken) => ({ email: id, password, turnstileToken }) };
}
