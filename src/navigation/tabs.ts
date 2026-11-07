import type { AndroidSymbol } from 'expo-symbols';
import type { Href } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { Experience } from '@/lib/roles';

// The tab bar of each experience — the plan in docs/01-advice.md §4, five tabs
// at most. `name` is the route file inside src/app/<experience>/.
// `soon` is what the placeholder says until the real screen is built; `built`
// marks a tab whose real screen is in (its route file then shows that screen,
// never the placeholder). A tab with screens of its own is a folder with a
// _layout.tsx (a stack), its tab screen being the folder's index.tsx.

export type TabDef = {
  name: string;
  label: string;
  sf: SFSymbol | { default: SFSymbol; selected: SFSymbol };
  md: AndroidSymbol;
  soon: string;
  phase: number;
  built?: true;
};

export const HOME: Record<Experience, Href> = {
  student: '/student',
  teacher: '/teacher',
  reception: '/reception',
  marketer: '/marketer',
  manager: '/manager',
};

const ME: TabDef = {
  name: 'me',
  label: 'Me',
  sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
  md: 'account_circle',
  soon: '',
  phase: 1,
};

export const TABS: Record<Experience, TabDef[]> = {
  student: [
    { name: 'index', label: 'Home', sf: { default: 'house', selected: 'house.fill' }, md: 'home', phase: 2, built: true,
      soon: "Today's class, check in, your progress and your next fee." },
    { name: 'learn', label: 'Learn', sf: { default: 'book', selected: 'book.fill' }, md: 'menu_book', phase: 2,
      soon: 'Your courses, subjects, lessons, quizzes and assignments.' },
    { name: 'attendance', label: 'Attendance', sf: 'calendar.badge.checkmark', md: 'event_available', phase: 2, built: true,
      soon: 'Check in at your branch, check out, and your attendance history.' },
    { name: 'fees', label: 'Fees', sf: { default: 'creditcard', selected: 'creditcard.fill' }, md: 'payments', phase: 2, built: true,
      soon: 'Your fee, what you have paid, your balance, and uploading a payment proof.' },
    ME,
  ],
  teacher: [
    { name: 'index', label: 'Today', sf: 'calendar', md: 'today', phase: 2, built: true,
      soon: "Check-ins waiting for you, and today's classes." },
    { name: 'classes', label: 'Classes', sf: { default: 'person.3', selected: 'person.3.fill' }, md: 'groups', phase: 2, built: true,
      soon: 'Your classes and each student’s progress.' },
    { name: 'assignments', label: 'Assignments', sf: { default: 'doc.text', selected: 'doc.text.fill' }, md: 'assignment', phase: 2, built: true,
      soon: 'Submissions to check, score and comment on.' },
    { name: 'students', label: 'Students', sf: { default: 'person.2', selected: 'person.2.fill' }, md: 'school', phase: 2,
      soon: 'Your students, their attendance and follow-ups.' },
    ME,
  ],
  reception: [
    { name: 'index', label: 'Today', sf: 'calendar', md: 'today', phase: 3,
      soon: "Today's figures and what needs reception." },
    { name: 'students', label: 'Students', sf: { default: 'person.2', selected: 'person.2.fill' }, md: 'group', phase: 3,
      soon: 'Find a student by name, phone, STU code or Civil ID.' },
    { name: 'new', label: 'New', sf: { default: 'plus.circle', selected: 'plus.circle.fill' }, md: 'add_circle', phase: 3,
      soon: 'Register a student, enrol, or take a payment.' },
    { name: 'followups', label: 'Follow-ups', sf: { default: 'phone', selected: 'phone.fill' }, md: 'call', phase: 3,
      soon: 'Follow-ups due and overdue, and logging how a call went.' },
    ME,
  ],
  marketer: [
    { name: 'index', label: 'Leads', sf: { default: 'person.crop.rectangle.stack', selected: 'person.crop.rectangle.stack.fill' }, md: 'contacts', phase: 4,
      soon: 'Your leads, their stage and the next step.' },
    { name: 'followups', label: 'Follow-ups', sf: { default: 'phone', selected: 'phone.fill' }, md: 'call', phase: 4,
      soon: 'Calls and WhatsApp follow-ups due today.' },
    { name: 'new', label: 'New', sf: { default: 'plus.circle', selected: 'plus.circle.fill' }, md: 'add_circle', phase: 4,
      soon: 'Add a lead or register a student.' },
    { name: 'referrals', label: 'Referrals', sf: 'link', md: 'link', phase: 4,
      soon: 'Your links, referrals, coupons and targets.' },
    ME,
  ],
  manager: [
    { name: 'index', label: 'Dashboard', sf: { default: 'chart.bar', selected: 'chart.bar.fill' }, md: 'bar_chart', phase: 4,
      soon: 'Today and this month across the branches.' },
    { name: 'approvals', label: 'Approvals', sf: { default: 'checkmark.seal', selected: 'checkmark.seal.fill' }, md: 'verified', phase: 4,
      soon: 'Refunds, discounts, certificates, transfers and payment proofs to approve.' },
    { name: 'students', label: 'Students', sf: { default: 'person.2', selected: 'person.2.fill' }, md: 'group', phase: 4,
      soon: 'Find any student and open their profile.' },
    { name: 'reports', label: 'Reports', sf: { default: 'doc.text.magnifyingglass', selected: 'doc.text.magnifyingglass' }, md: 'summarize', phase: 4,
      soon: 'The key reports, read-only. The full report builder stays on the web.' },
    ME,
  ],
};
