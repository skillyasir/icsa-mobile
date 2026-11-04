import { run } from '../../scripts/check-harness.ts';

import { EXPERIENCES, experiencesFor } from './roles.ts';

run('roles.check — which tabs a role sees', (h) => {
  const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const see = (role: string, overlay_roles?: string[] | null) => experiencesFor({ role, overlay_roles });

  // §1 every primary role the AMS has, mapped once
  h.check('§1 student → Student', eq(see('student'), ['student']));
  h.check('§1 teacher → Teacher', eq(see('teacher'), ['teacher']));
  h.check('§1 academic_supervisor (primary) → Teacher', eq(see('academic_supervisor'), ['teacher']));
  h.check('§1 supervisor → Reception', eq(see('supervisor'), ['reception']));
  h.check('§1 marketer → Marketer', eq(see('marketer'), ['marketer']));
  h.check('§1 manager → Manager', eq(see('manager'), ['manager']));
  for (const r of ['accountant', 'cap_coordinator', 'invoice_encoder']) {
    h.check(`§1 ${r} → no app experience (web)`, eq(see(r), []));
  }

  // §2 overlays add experiences after the primary, in the server's order
  h.check('§2 manager + teacher overlay → Manager, Teacher', eq(see('manager', ['teacher']), ['manager', 'teacher']));
  h.check('§2 supervisor + marketer overlay → Reception, Marketer', eq(see('supervisor', ['marketer']), ['reception', 'marketer']));
  h.check('§2 teacher + academic_supervisor overlay → Teacher once', eq(see('teacher', ['academic_supervisor']), ['teacher']));
  h.check('§2 accountant + marketer overlay → Marketer', eq(see('accountant', ['marketer']), ['marketer']));
  h.check(
    '§2 overlays keep the server order and drop repeats',
    eq(see('manager', ['marketer', 'teacher', 'marketer']), ['manager', 'marketer', 'teacher']),
  );

  // §3 what must never happen
  h.check('§3 a student never gets a staff experience from overlays', eq(see('student', ['teacher', 'marketer']), ['student']));
  h.check('§3 an unknown role gets nothing', eq(see('owner'), []));
  h.check('§3 an unknown overlay adds nothing', eq(see('teacher', ['manager', 'student']), ['teacher']));
  h.check('§3 a prototype key is not a role', eq(see('constructor', ['toString']), []));
  h.check('§3 null overlays are no overlays', eq(see('manager', null), ['manager']));

  // §4 every experience is reachable from some role (no orphan tab set)
  const reachable = new Set(
    ['student', 'teacher', 'supervisor', 'marketer', 'manager'].flatMap((r) => see(r)),
  );
  h.check('§4 all five experiences are reachable', EXPERIENCES.length === 5 && EXPERIENCES.every((e) => reachable.has(e)));
});
