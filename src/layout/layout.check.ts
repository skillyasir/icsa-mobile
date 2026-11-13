import { readFileSync } from 'node:fs';

import { run } from '../../scripts/check-harness.ts';

import { COLUMN_MAX, LIST_PANE, SPLIT_MIN, WIDE_MIN, layoutFor } from './breakpoints.ts';

// The iPad layout (Yasir ruled, 10 Nov 2026: "Full iPad layout first";
// designs approved the same day). Phones must not change (Yasir, 10 Nov 2026:
// "Keep tabs on phones"). This holds the breakpoints, the sidebar, the split
// screens and the dashboards — and that a phone takes the path it took before.

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (rel: string) => strip(readFileSync(new URL(rel, import.meta.url), 'utf8'));

run('layout.check — the iPad layout, and phones unchanged', (h) => {
  h.check('§0 strip removes comments and keeps strings', strip("a('x') // gone\n/* gone */b").includes("a('x')") && !strip('a // gone').includes('gone'));

  // §1 the breakpoints
  const phones = [320, 360, 375, 390, 393, 402, 412, 430, 440];
  const ipads = [744, 820, 834, 1024, 1032, 1180, 1194, 1366, 1376];
  h.check('§1 every phone width is a phone (cardinality: 9)', phones.length === 9 && phones.every((w) => !layoutFor(w).wide && !layoutFor(w).split));
  h.check('§1 every iPad width, either orientation, is wide (cardinality: 9)', ipads.length === 9 && ipads.every((w) => layoutFor(w).wide));
  h.check('§1 a list sits beside its item on the 13" either way and the 11" in landscape', [1024, 1032, 1180, 1366, 1376].every((w) => layoutFor(w).split));
  h.check('§1 …but not on iPad mini or an 11" in portrait (too narrow for two panes)', [744, 820, 834].every((w) => !layoutFor(w).split));
  h.check('§1 a width that is not a number is a phone', !layoutFor(Number.NaN).wide && !layoutFor(Number.NaN).split);
  h.check('§1 the numbers', WIDE_MIN === 700 && SPLIT_MIN === 1000 && COLUMN_MAX === 760 && LIST_PANE === 420 && LIST_PANE < SPLIT_MIN / 2);

  // §2 the screen frame
  const screen = read('../components/Screen.tsx');
  h.check('§2 Screen extracts (floor)', screen.length > 2500, String(screen.length));
  h.check('§2 a phone keeps its padding exactly', /: \{ padding: t\.space\.xl \};/.test(screen));
  h.check('§2 on an iPad a single-column screen is centred at COLUMN_MAX, never stretched', /const column = wide && width === 'column' && !sideBySide \? styles\.column : null;/.test(screen) && /column: \{ width: '100%', maxWidth: COLUMN_MAX, alignSelf: 'center' \}/.test(screen));
  h.check('§2 the open item sits beside the list only with room for both', /const sideBySide = split && aside !== undefined;/.test(screen));
  h.check('§2 an embedded screen takes no safe area of its own (its list has it)', /edges=\{embedded \? \[\] :/.test(screen));

  // §3 the sidebar
  const tabs = read('../navigation/ExperienceTabs.tsx');
  h.check('§3 on iPad the tabs become iPadOS\'s own sidebar (and open it on iPadOS 27+)', /\bsidebarAdaptable\b/.test(tabs) && /preferredPlacement="sidebar"/.test(tabs));

  // §4 the split screens: beside on an iPad with room, pushed on a phone
  const splits = [
    { file: '../student/LearnScreen.tsx', detail: 'SubjectScreen', route: "'/student/learn/subject'" },
    { file: '../teacher/AssignmentsScreen.tsx', detail: 'ReviewScreen', route: "'/teacher/assignments/review'" },
    // Teacher and reception share it (13 Nov 2026): the profile route is the map students.ts names, per view.
    { file: '../teacher/StudentsScreen.tsx', detail: 'StudentScreen', route: 'STUDENT_PROFILE\\[who\\]' },
  ];
  h.check('§4 the split screens (cardinality: 3)', splits.length === 3);
  for (const sp of splits) {
    const src = read(sp.file);
    const name = sp.file.split('/').pop();
    h.check(`§4 ${name}: the open item is given as \`aside\` only when split`, new RegExp(`aside=\\{\\s*split\\b`).test(src));
    h.check(`§4 ${name}: …drawn by ${sp.detail} itself, embedded`, new RegExp(`<${sp.detail}\\b[^>]*\\bembedded\\b`).test(src));
    h.check(`§4 ${name}: …and a phone still opens the item's own screen`, new RegExp(`split \\? set\\w+\\([^)]*\\) : router\\.push\\(\\{ pathname: ${sp.route.replace(/\//g, '\\/')}`).test(src.replace(/\s+/g, ' ')));
  }

  // §5 the detail screens drawn beside a list
  for (const f of ['../student/SubjectScreen.tsx', '../teacher/ReviewScreen.tsx', '../teacher/StudentScreen.tsx']) {
    const src = read(f);
    const name = f.split('/').pop();
    h.check(`§5 ${name}: no back link when beside its list`, (src.match(/top=\{embedded \? undefined : back\}/g) ?? []).length >= 1 && !/top=\{back\}/.test(src));
    h.check(`§5 ${name}: …passes embedded to its Screen`, /embedded=\{embedded\}/.test(src));
  }
  const review = read('../teacher/ReviewScreen.tsx');
  h.check('§5 a review sent beside the list reloads the list (onDone); on a phone it goes back', /if \(onDone\) onDone\(\);\s*else router\.back\(\);/.test(review));

  // §6 the dashboards: columns on an iPad, the same order on a phone
  const row = read('../components/WideRow.tsx');
  h.check('§6 WideRow on a phone gives back its children as they were, in order', /if \(!wide\) return <>\{kids\}<\/>;/.test(row));
  h.check('§6 an empty Column draws nothing (no stray gap on a phone)', /if \(kids\.length === 0\) return null;/.test(row));
  const dashboards = ['../student/HomeScreen.tsx', '../student/AttendanceScreen.tsx', '../student/FeesScreen.tsx', '../teacher/TodayScreen.tsx'];
  h.check('§6 the dashboards (cardinality: 4)', dashboards.length === 4);
  for (const f of dashboards) {
    const src = read(f);
    const name = f.split('/').pop();
    const opens = (src.match(/<WideRow\b/g) ?? []).length;
    const closes = (src.match(/<\/WideRow>/g) ?? []).length;
    h.check(`§6 ${name}: the whole width, laid out in WideRows`, /width="full"/.test(src) && opens >= 1 && opens === closes, `${opens} open, ${closes} close`);
    h.check(`§6 ${name}: every Column is closed`, (src.match(/<Column>/g) ?? []).length === (src.match(/<\/Column>/g) ?? []).length);
  }

  // §7 sign-in on an iPad: a centred column
  const signIn = read('../app/sign-in.tsx');
  h.check('§7 the sign-in form and its heading are a centred column on an iPad', (signIn.match(/wide && styles\.narrow/g) ?? []).length === 2 && /narrow: \{ width: '100%', maxWidth: 560, alignSelf: 'center' \}/.test(signIn));
});
