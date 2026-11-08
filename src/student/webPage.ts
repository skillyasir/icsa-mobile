// Lessons and quizzes as the website's OWN pages, inside the app.
//
// Yasir ruled, 8 Nov 2026: the app opens a lesson or a quiz as the AMS
// website's subject page, in a web view — every lesson kind, the interactive
// lesson bridge, typing and all eight quiz kinds work as they do on the
// website, and their rules keep one owner. The website knows it is inside the
// app by one flag (client/src/lib/appMode.js): then it shows no header or menu,
// never times out or renews the sign-in itself, and tells the app when its
// sign-in has run out instead of showing the login page.
//
// THE APP OWNS THE SIGN-IN. The page is handed the app's own short-lived token
// before it loads, a fresh one every minute while it is open, and nothing
// else. The web view keeps nothing once closed (incognito), and the token is
// only ever written for the AMS's own address. Pure — no React Native — so
// webPage.check.ts can hold every name here to the AMS's.

import { AMS_WEB_URL } from '../config.ts';

export const AMS_ORIGIN = AMS_WEB_URL;

/** client/src/lib/appMode.js APP_MODE_KEY — the flag the app sets in the tab's sessionStorage. */
export const APP_MODE_KEY = 'icsa_app';
/** Where the website keeps its sign-in (client/src/context/AuthContext.js). */
export const TOKEN_KEY = 'icsa_token';
export const USER_KEY = 'icsa_user';

/** A fresh sign-in is handed to the page this often. A token lives the AMS's idle minutes + 120 s; asking costs nothing until the app's own token nears its end. */
export const TOKEN_PUSH_EVERY_MS = 60_000;

/** The website's subject page, opened on the item the student tapped. */
export function subjectPageUrl(subjectId: string, itemId: string | null): string {
  const base = `${AMS_ORIGIN}/student/lessons/subjects/${encodeURIComponent(subjectId)}`;
  return itemId ? `${base}?item=${encodeURIComponent(itemId)}` : base;
}

/** The website's user object, as much of it as the app knows; the page asks /auth/me for the rest as it loads. */
export function pageUser(u: { full_name: string; role: string; email?: string | null; student_code?: string | null }): Record<string, string | null> {
  return { full_name: u.full_name, role: u.role, email: u.email ?? null, student_code: u.student_code ?? null };
}

/** JavaScript that runs only on the AMS's own address. Values go in through JSON.stringify — never pasted. */
function onAms(body: string): string {
  return `(function(){try{if(window.location.origin!==${JSON.stringify(AMS_ORIGIN)})return;${body}}catch(e){}})();true;`;
}

/** Before the page loads: app mode, the sign-in and the user. */
export function bootScript(token: string, user: Record<string, string | null>): string {
  return onAms(
    `window.sessionStorage.setItem(${JSON.stringify(APP_MODE_KEY)},"1");` +
      `window.localStorage.setItem(${JSON.stringify(TOKEN_KEY)},${JSON.stringify(token)});` +
      `window.localStorage.setItem(${JSON.stringify(USER_KEY)},${JSON.stringify(JSON.stringify(user))});`,
  );
}

/** While it is open: a fresh sign-in, read by the page's next request. */
export function tokenScript(token: string): string {
  return onAms(`window.localStorage.setItem(${JSON.stringify(TOKEN_KEY)},${JSON.stringify(token)});`);
}

/**
 * May the web view go there? The page's own frames (a video, the slides, an
 * interactive lesson in its sandbox) always may — iOS asks about every frame,
 * and refusing one would try to open it in Safari (captchaLoadDecision, 5 Nov
 * 2026). The page itself stays on the AMS's student pages; a material and any
 * other site open outside the app; any other AMS page is refused.
 */
export function pageLoadDecision(r: { url: string; isTopFrame?: boolean }): 'load' | 'outside' | 'refuse' {
  if (r.isTopFrame === false) return 'load';
  if (r.url === 'about:blank') return 'load';
  if (r.url.startsWith(`${AMS_ORIGIN}/student/`) || r.url === `${AMS_ORIGIN}/student`) return 'load';
  // A lesson's materials are plain links to /uploads/materials/ (LessonContent's
  // Download): the phone's browser downloads or opens them.
  if (r.url.startsWith(`${AMS_ORIGIN}/uploads/`)) return 'outside';
  if (/^https?:\/\//i.test(r.url) && !r.url.startsWith(`${AMS_ORIGIN}/`)) return 'outside';
  return 'refuse';
}

/** client/src/lib/appMode.js APP_MESSAGES — everything the page may say. */
export const PAGE_MESSAGES = { authExpired: 'auth-expired' } as const;
export type PageMessage = (typeof PAGE_MESSAGES)[keyof typeof PAGE_MESSAGES];

/**
 * A message from the page, or null. Only the AMS page may speak (iOS names the
 * page's URL, Android only its origin; a lesson's sandboxed frame is "null"),
 * and only in appMode.toApp's shape.
 */
export function pageMessage(data: string, from: string): PageMessage | null {
  if (!(from === AMS_ORIGIN || from.startsWith(`${AMS_ORIGIN}/`))) return null;
  try {
    const m = JSON.parse(data) as { icsa?: unknown; v?: unknown; type?: unknown };
    if (m.icsa !== 'ams-page' || m.v !== 1) return null;
    return (Object.values(PAGE_MESSAGES) as string[]).includes(String(m.type)) ? (m.type as PageMessage) : null;
  } catch {
    return null;
  }
}

/** A run-out sign-in is fixed by reloading with a fresh one — at most this often, so a page that keeps failing cannot loop. */
export const RELOAD_AT_MOST_EVERY_MS = 15_000;
