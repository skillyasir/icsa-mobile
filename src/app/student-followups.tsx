import { FollowupsScreen } from '@/reception/FollowupsScreen';

// A marketer's students' follow-ups — the Follow-up Centre the AMS scopes to the
// students she referred or registered (31 Oct 2026). Pushed from her Follow-ups tab.
export default function StudentFollowups() {
  return <FollowupsScreen back="/marketer/followups" backLabel="‹ Follow-ups" />;
}
