import { run } from '../../scripts/check-harness.ts';

import { checkInTeacher, heroClass, todayClasses } from './today.ts';
import type { MyContext, TodaysAttendance } from './types.ts';

// Today's classes, as the Home card and the Attendance tab draw them: which
// classes meet today, which can be checked in to now, which one Home features,
// and which teacher a new check-in goes under.

const sara = { id: 't-sara', name: 'Ms. Sara Khan' };
const omar = { id: 't-omar', name: 'Mr. Omar Ali' };
const checkedIn = (over: Partial<TodaysAttendance> = {}): TodaysAttendance => ({
  id: 'a1', enrollment_id: 'eb', status: 'pending', check_in_time: '2026-11-06T12:41:00Z', check_out_time: null,
  confirmed_at: null, selected_teacher_id: sara.id, attended_branch_id: 'bc', attended_branch_name: 'ICSA City',
  session_id: 's1', attendance_mode: 'classroom', check_in_method: 'student_self', teacher_id: sara.id, teacher_name: sara.name,
  ...over,
});
const ctx = (over: Partial<MyContext> = {}): MyContext => ({
  now: '2026-11-06T12:30:00Z',
  today: '2026-11-06', // a Friday
  gps_radius_m: 150,
  branches: [],
  batch_enrollments: [
    { enrollment_id: 'eb', enrollment_no: 'EN-1', course_name: 'MS Excel', batch_name: 'Tue/Fri 4 PM', learning_mode: 'classroom',
      sessions_attended: 3, assigned_teacher: sara, todays_attendance: null, class_days: 'Tue, Fri', start_time: '16:00:00', end_time: '18:00:00',
      session: { id: 's1', window_open_at: '', window_close_at: '', window_state: 'open' } },
  ],
  individual_enrollments: [
    { enrollment_id: 'ei', enrollment_no: 'EN-2', course_name: 'Graphic Design', learning_mode: 'hybrid', sessions_attended: 0,
      assigned_teacher: sara, todays_attendance: null, class_days: 'Sun, Mon', start_time: '10:00:00', end_time: '12:00:00',
      available_teachers: [{ ...sara, is_default: true }, { ...omar, is_default: false }] },
    { enrollment_id: 'en', enrollment_no: 'EN-3', course_name: 'PowerPoint', learning_mode: 'online', sessions_attended: 0,
      assigned_teacher: null, todays_attendance: null, available_teachers: [{ ...omar, is_default: false }] },
  ],
  ...over,
});

run('today.check — today’s classes for Home and Attendance', (h) => {
  const list = todayClasses(ctx());
  h.check('§1 three classes, batch first (cardinality floor)', list.length === 3 && list[0].kind === 'batch' && list[1].kind === 'individual', list.map((c) => c.enrollmentId).join());
  h.check('§1 nothing from nothing', todayClasses(null).length === 0 && todayClasses(undefined).length === 0);
  const [b, i, n] = list;
  h.check('§2 a batch with a session today meets today, and is open', b.isToday && b.open && b.note === null);
  h.check('§2 a batch names its group, an individual says so', b.group === 'Tue/Fri 4 PM' && i.group === 'Individual');
  h.check('§2 the times come through', b.start === '16:00:00' && b.end === '18:00:00' && b.classDays === 'Tue, Fri');
  h.check('§2 an individual whose days miss today does not meet today', !i.isToday);
  h.check('§2 an individual with no days set may meet any day', n.isToday && n.start === null);
  h.check('§2 an individual is open until checked in', i.open && n.open);

  const closed = todayClasses(ctx({ batch_enrollments: [{ ...ctx().batch_enrollments[0], session: { id: 's1', window_open_at: '', window_close_at: '', window_state: 'closed' } }] }))[0];
  h.check('§3 a closed window: meets today, not open, says why', closed.isToday && !closed.open && (closed.note ?? '').length > 5);
  const none = todayClasses(ctx({ batch_enrollments: [{ ...ctx().batch_enrollments[0], session: null }] }))[0];
  h.check('§3 no session: not today, not open', !none.isToday && !none.open);
  const inB = todayClasses(ctx({ batch_enrollments: [{ ...ctx().batch_enrollments[0], todays_attendance: checkedIn() }] }))[0];
  h.check('§3 checked in: not open again, no note', !inB.open && inB.note === null && !!inB.todays);

  const changed = todayClasses(ctx({ individual_enrollments: [{ ...ctx().individual_enrollments[0], todays_attendance: checkedIn({ enrollment_id: 'ei', session_id: null, teacher_id: omar.id, teacher_name: omar.name }) }] }))[1];
  h.check('§4 the teacher is who the check-in is under once made', changed.teacher?.name === omar.name);
  h.check('§4 else the assigned one', i.teacher?.name === sara.name && n.teacher === null);

  h.check('§5 Home features an open check-in first', heroClass([n, i, { ...inB }])?.enrollmentId === 'eb');
  h.check('§5 …then one that can be checked in to now', heroClass([i, n, b])?.enrollmentId === 'en');
  h.check('§5 …then any class today', heroClass([i, closed])?.enrollmentId === 'eb');
  h.check('§5 …else nothing', heroClass([i, none]) === null && heroClass([]) === null);
  const out = { ...inB, todays: checkedIn({ check_out_time: '2026-11-06T15:00:00Z' }) };
  h.check('§5 a checked-out class is not "open"; another open one wins', heroClass([out, n])?.enrollmentId === 'en');

  h.check('§6 a batch check-in names no teacher', checkInTeacher(b, null) === null && checkInTeacher(b, sara.id) === null);
  h.check('§6 an individual: the one chosen', checkInTeacher(i, omar.id)?.id === omar.id);
  h.check('§6 …else the assigned one', checkInTeacher(i, null)?.id === sara.id);
  h.check('§6 …a choice not on the list is not taken', checkInTeacher(i, 'nobody')?.id === sara.id);
  h.check('§6 …no assigned teacher, no choice: none (the student must choose)', checkInTeacher(n, null) === null);
});
