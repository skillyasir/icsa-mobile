// Today's classes, from GET /attendance/my-context, in the shape the Home card
// and the Attendance tab both draw. Pure, so rules.check.ts runs it.
//
// Batch first, then individual — the website's order (StudentAttendanceCard).

import { batchGate, isClassDay } from './rules.ts';
import type { LearningMode, MyContext, Teacher, TodaysAttendance } from './types';

export type TodayClass = {
  enrollmentId: string;
  kind: 'batch' | 'individual';
  course: string;
  /** "Tue/Fri 4 PM" for a batch, "Individual" otherwise. */
  group: string;
  mode: LearningMode | null;
  /** The class's teacher: who the check-in is under once made, else the assigned one. */
  teacher: { id: string; name: string } | null;
  /** An individual student may check in with any teacher who teaches the course. */
  teachers: Teacher[];
  todays: TodaysAttendance | null;
  /** May a check-in be made now? A batch follows its window; the AMS decides the rest. */
  open: boolean;
  note: string | null;
  classDays: string | null;
  start: string | null;
  end: string | null;
  /** Does this class meet today? A batch: a session today. Individual: a class day, or days not set. */
  isToday: boolean;
};

export function todayClasses(ctx: MyContext | null | undefined): TodayClass[] {
  if (!ctx) return [];
  const out: TodayClass[] = [];
  for (const b of ctx.batch_enrollments ?? []) {
    const gate = batchGate(b.session?.window_state ?? 'no_session');
    out.push({
      enrollmentId: b.enrollment_id,
      kind: 'batch',
      course: b.course_name,
      group: b.batch_name || 'Batch class',
      mode: b.learning_mode ?? null,
      teacher: teacherOf(b.todays_attendance, b.assigned_teacher),
      teachers: [],
      todays: b.todays_attendance ?? null,
      open: gate.open && !b.todays_attendance,
      note: b.todays_attendance ? null : gate.note,
      classDays: b.class_days ?? null,
      start: b.start_time ?? null,
      end: b.end_time ?? null,
      isToday: !!b.session || !!b.todays_attendance,
    });
  }
  for (const i of ctx.individual_enrollments ?? []) {
    out.push({
      enrollmentId: i.enrollment_id,
      kind: 'individual',
      course: i.course_name,
      group: 'Individual',
      mode: i.learning_mode ?? null,
      teacher: teacherOf(i.todays_attendance, i.assigned_teacher),
      teachers: i.available_teachers ?? [],
      todays: i.todays_attendance ?? null,
      open: !i.todays_attendance,
      note: null,
      classDays: i.class_days ?? null,
      start: i.start_time ?? null,
      end: i.end_time ?? null,
      isToday: !!i.todays_attendance || !i.class_days || isClassDay(i.class_days, ctx.today),
    });
  }
  return out;
}

function teacherOf(
  todays: TodaysAttendance | null | undefined,
  assigned: { id: string; name: string } | null | undefined,
): { id: string; name: string } | null {
  if (todays?.teacher_id && todays.teacher_name) return { id: todays.teacher_id, name: todays.teacher_name };
  return assigned ?? null;
}

/**
 * The one class the Home card features: a check-in still open (checked in,
 * not out) first; then one that can be checked in to now; then any class
 * today; then nothing.
 */
export function heroClass(list: TodayClass[]): TodayClass | null {
  return (
    list.find((c) => c.todays && !c.todays.check_out_time) ??
    list.find((c) => c.isToday && c.open) ??
    list.find((c) => c.isToday) ??
    null
  );
}

/** The teacher a new check-in goes under: the one chosen, else the assigned one. */
export function checkInTeacher(c: TodayClass, chosenId: string | null): Teacher | null {
  if (c.kind === 'batch') return null; // a batch's teacher is the session's
  const pick = chosenId ? c.teachers.find((t) => t.id === chosenId) : null;
  if (pick) return pick;
  const assigned = c.teachers.find((t) => t.is_default) ?? (c.teacher ? c.teachers.find((t) => t.id === c.teacher?.id) : undefined);
  return assigned ?? null;
}
