// What the AMS answers for the student's attendance and home screens, as the
// app reads it. Every field is optional where the AMS can send null, so a
// screen has to say what it shows when a figure is missing.
//
//   GET /api/attendance/my-context      → MyContext   (attendanceController.getMyContext)
//   GET /api/attendance/my-history      → MyHistory   (attendanceController.getMyHistory)
//   GET /api/auth/student/dashboard     → Dashboard   (studentDashboardController.getDashboard)

export type LearningMode = 'classroom' | 'online' | 'hybrid';
export type WindowState = 'open' | 'not_yet_open' | 'closed' | 'no_session';
export type AttendanceStatus = 'pending' | 'pending_review' | 'present' | 'late' | 'absent' | 'excused';

export type Teacher = { id: string; name: string; is_default?: boolean };

/** Today's check-in on one enrolment, if there is one. */
export type TodaysAttendance = {
  id: string;
  enrollment_id: string;
  status: AttendanceStatus | string;
  check_in_time: string | null;
  check_out_time: string | null;
  confirmed_at: string | null;
  selected_teacher_id: string | null;
  attended_branch_id: string | null;
  attended_branch_name: string | null;
  session_id: string | null;
  attendance_mode: 'classroom' | 'online' | null;
  check_in_method: string | null;
  teacher_id: string | null;
  teacher_name: string | null;
  // Added to my-context on 6 Nov 2026 — an older AMS does not send them.
  check_in_distance_m?: number | null;
  check_in_accuracy_m?: number | null;
};

type EnrolmentBase = {
  enrollment_id: string;
  enrollment_no: string | null;
  course_name: string;
  learning_mode: LearningMode | null;
  sessions_attended: number | string | null;
  assigned_teacher: { id: string; name: string } | null;
  todays_attendance: TodaysAttendance | null;
  // Added to my-context on 6 Nov 2026 — an older AMS does not send them.
  class_days?: string | null; //   "Sun, Mon, Tue"
  start_time?: string | null; //   "16:00:00"
  end_time?: string | null;
};

export type BatchEnrolment = EnrolmentBase & {
  kind?: 'batch';
  batch_name: string | null;
  session: { id: string; window_open_at: string; window_close_at: string; window_state: WindowState } | null;
};

export type IndividualEnrolment = EnrolmentBase & {
  kind?: 'individual';
  available_teachers: Teacher[];
};

export type Branch = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  is_mine: boolean;
};

export type MyContext = {
  now: string;
  today: string; // YYYY-MM-DD, Kuwait
  gps_radius_m: number;
  branches?: Branch[];
  batch_enrollments: BatchEnrolment[];
  individual_enrollments: IndividualEnrolment[];
};

export type HistoryRecord = {
  id: string;
  attendance_date: string;
  status: AttendanceStatus | string;
  attendance_mode: 'classroom' | 'online' | null;
  check_in_time: string | null;
  confirmed_at: string | null;
  check_in_distance_m: number | null;
  course_name: string;
  confirmed_by_name: string | null;
  attended_branch_name: string | null;
};

export type MyHistory = {
  summary: { total: number; present: number; late: number; absent: number; excused: number; pending: number; pending_review: number };
  records: HistoryRecord[];
};

export type CheckInAnswer = {
  success: boolean;
  attendance_id: string;
  status: string;
  attended_branch: { id: string; name: string } | null;
  attendance_mode: 'classroom' | 'online';
  hybrid_note: string | null;
  distance_m: number | null;
  accuracy_m: number | null;
  message: string;
};

export type DashboardCourse = {
  id: string;
  name: string;
  enrollment_id: string;
  enrollment_status: string;
  frozen: boolean;
  teacher_name: string | null;
  lessons_total: number | string | null;
  lessons_done: number | string | null;
  resume_lesson_id: string | null;
  resume_lesson_title: string | null;
  resume_subject_name: string | null;
  resume_subject_id: string | null;
};

export type Dashboard = {
  courses: DashboardCourse[];
  attendance: { total: number; present: number; rate: number | null; last_present: string | null };
  payments: {
    total_fee: number;
    total_paid: number;
    remaining: number;
    next_due: { amount: number | string; due_date: string; installment_no: number } | null;
    arrears: number;
  };
  due_soon: { kind: string; id: string; title: string; due_date: string | null; subject_name: string | null; days_until: number | null }[];
  streak: number;
};
