import { FollowupsScreen } from '@/reception/FollowupsScreen';

// A teacher's student follow-ups (15 Nov 2026): the Follow-up Centre's cases the
// AMS gives him — his students' attendance cases, and their fee cases. Opened
// from Today's "Follow-ups due" card and the Students tab's Follow-ups row.
export default function TeacherFollowups() {
  return <FollowupsScreen back="/teacher" />;
}
