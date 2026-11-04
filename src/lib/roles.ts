// Which app "experience" (set of tabs) a signed-in person sees.
//
// DISPLAY ROUTING ONLY. This decides which screens to offer, never what a
// person may do: every permission stays in the AMS API, which refuses anything
// a role may not do whatever an app shows. An app version stays on phones for
// months, so no rule here may be load-bearing.
//
// Read from the AMS's own role model (server/src/utils/roles.js and
// middleware/auth.js, AMS commit 43b55d0):
// - every user has ONE primary role (users.role): manager, supervisor,
//   accountant, teacher, marketer, cap_coordinator, invoice_encoder, student,
//   and academic_supervisor;
// - staff may also hold OVERLAY roles (user_roles, active while revoked_at IS
//   NULL). The overlay CHECK admits marketer, teacher and academic_supervisor.
// - An academic supervisor is a teacher who works across every course and
//   branch; on the phone that is the Teacher tabs, with the server answering
//   for the wider scope.
//
// Roles with no app experience in v1 (accountant, cap_coordinator,
// invoice_encoder) get none — they are sent to the AMS on the web.

export type Experience = 'student' | 'teacher' | 'reception' | 'marketer' | 'manager';

export const EXPERIENCES: readonly Experience[] = ['student', 'teacher', 'reception', 'marketer', 'manager'];

export const EXPERIENCE_LABEL: Record<Experience, string> = {
  student: 'Student',
  teacher: 'Teacher',
  reception: 'Reception',
  marketer: 'Marketer',
  manager: 'Manager',
};

const FROM_PRIMARY: Readonly<Record<string, Experience>> = {
  student: 'student',
  teacher: 'teacher',
  academic_supervisor: 'teacher',
  supervisor: 'reception',
  marketer: 'marketer',
  manager: 'manager',
};

const FROM_OVERLAY: Readonly<Record<string, Experience>> = {
  teacher: 'teacher',
  academic_supervisor: 'teacher',
  marketer: 'marketer',
};

export type RoleHolder = { role: string; overlay_roles?: readonly string[] | null };

/**
 * The experiences a person can switch between, primary first, then overlays
 * in the order the server sent them, without repeats. A student never gets a
 * staff experience, whatever arrives in overlay_roles.
 */
export function experiencesFor(user: RoleHolder): Experience[] {
  const out: Experience[] = [];
  const add = (e: Experience | undefined) => {
    if (e && !out.includes(e)) out.push(e);
  };
  add(Object.hasOwn(FROM_PRIMARY, user.role) ? FROM_PRIMARY[user.role] : undefined);
  if (user.role === 'student') return out;
  for (const r of user.overlay_roles ?? []) {
    add(Object.hasOwn(FROM_OVERLAY, r) ? FROM_OVERLAY[r] : undefined);
  }
  return out;
}
