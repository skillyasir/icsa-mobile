import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import { readAmsFile } from './ams.ts';
import { run } from './check-harness.ts';
import { strip, stripBlockComments } from './strip.ts';

// One comment stripper for every check (14 Nov 2026), the AMS's own, held to
// the AMS's file byte for byte and to TypeScript's parser on every app file.
//
//   1. the vendored file is the AMS's, below its marker
//   2. the awkward shapes — strings, templates, regular expressions, JSX, TS
//   3. it agrees with TypeScript on every app source file (and the old pattern would not)
//   4. census: no check defines its own stripper or uses the old pattern again

const APP = new URL('../', import.meta.url).pathname;
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

// The old pattern, built from pieces so that this file is not itself a use of it.
const OLD = new RegExp('\\/\\*' + '[\\s\\S]*?' + '\\*\\/', 'g');
const OLD_TEXT = '\\/\\*' + '[\\s\\S]*?' + '\\*\\/';
const oldStrip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(OLD, '');

const ns = (s: string) => s.replace(/\s+/g, '');

/** The file's code as TypeScript reads it: every token's own text, no comments, no JSDoc. */
function tokensOf(file: string, src: string): string {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : file.endsWith('.mjs') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const parts: string[] = [];
  const visit = (n: ts.Node) => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    const kids = n.getChildren(sf);
    if (kids.length === 0) parts.push(src.slice(n.getStart(sf), n.end));
    else for (const k of kids) visit(k);
  };
  visit(sf);
  return parts.join(' ');
}

const walk = (d: string, out: string[] = []): string[] => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(n)) out.push(p);
  }
  return out;
};

run('strip.check — one comment stripper, the AMS’s, for every check', (h) => {
  // §1 the vendored file
  const marker = '// ── verbatim below ──\n';
  const ven = read('./vendor/strip-comments.cjs');
  const ams = readAmsFile('scripts/strip-comments.js');
  h.check('§1 the vendored stripper is the AMS’s, byte for byte below the marker', ven.includes(marker) && ams.length > 3000 && ven.slice(ven.indexOf(marker) + marker.length) === ams, String(ams.length));

  // §2 the awkward shapes
  const cases: [string, string, string][] = [
    ['a string holding /* is not a comment', '<input accept="image/*" />\nconst x = 1; /* real */ y();', '<input accept="image/*" />\nconst x = 1;  y();'],
    ['single quotes too, and the code after survives', "app.use('/api/*', h);\nkeep(); /* c */ more();", "app.use('/api/*', h);\nkeep();  more();"],
    ['a template literal: its text is text, its ${} is code', '`a /* b ${ x /* real */ } c */ d` /* e */ f', '`a /* b ${ x  } c */ d`  f'],
    ['JSX {/* */} leaves its braces', '<div>{/* note */}<b/></div>', '<div>{}<b/></div>'],
    ['a negated regular expression (the checks’ own shape) is code', "ok(!/Phase/.test(s)); /* c */ k();", "ok(!/Phase/.test(s));  k();"],
    ['TS: a generic arrow and a return type', 'const f = <T,>(a: T): T => a; /* c */ g();', 'const f = <T,>(a: T): T => a;  g();'],
    ['TS: a type holding /* in a string', "type P = { path: '/x/*' }; /* c */ k();", "type P = { path: '/x/*' };  k();"],
  ];
  for (const [label, input, want] of cases) {
    const got = stripBlockComments(input);
    h.check(`§2 ${label}`, got === want, JSON.stringify(got));
  }
  h.check('§2 both kinds by default; a URL inside a string is kept', strip('x = "http://a/b"; // c\ny(); /* d */') === 'x = "http://a/b"; \ny(); ', JSON.stringify(strip('x = "http://a/b"; // c\ny(); /* d */')));
  h.check('§2 CONTROL: the old pattern really is wrong on the first case', oldStrip(cases[0][1]) !== cases[0][2]);

  // §3 agreement with TypeScript's parser on every app file
  const files = [...walk(join(APP, 'src')), ...walk(join(APP, 'scripts'))];
  const differ = files.filter((f) => {
    const src = readFileSync(f, 'utf8');
    return ns(strip(src)) !== ns(tokensOf(f, src));
  });
  h.check('§3 the app’s files were read (floor)', files.length > 150, String(files.length));
  h.check('§3 the stripper agrees with TypeScript on every one', differ.length === 0, differ.map((f) => f.slice(APP.length)).join(', '));
  const planted = "const a = 'image/*';\nkeep_me();\n/* real */\nconst b = '*/';\n";
  h.check('§3 CONTROL: the comparison catches the old pattern (it loses keep_me; the stripper does not)', ns(oldStrip(planted)) !== ns(tokensOf('p.ts', planted)) && !oldStrip(planted).includes('keep_me') && ns(strip(planted)) === ns(tokensOf('p.ts', planted)));

  // §4 census
  const sources = files.filter((f) => !f.endsWith('/scripts/strip.ts') && !f.endsWith('/scripts/strip.check.ts'));
  const oldUses = sources.filter((f) => readFileSync(f, 'utf8').includes(OLD_TEXT));
  h.check('§4 no file uses the old pattern', oldUses.length === 0, oldUses.map((f) => f.slice(APP.length)).join(', '));
  const ownStrippers = sources.filter((f) => /\bconst strip\w* = \(/.test(readFileSync(f, 'utf8')));
  h.check('§4 no check defines its own stripper', ownStrippers.length === 0, ownStrippers.map((f) => f.slice(APP.length)).join(', '));
  const users = sources.filter((f) => /import \{ strip(, stripBlockComments)? \} from '(\.\.\/)+scripts\/strip\.ts';/.test(readFileSync(f, 'utf8')));
  h.check('§4 the checks import the one stripper (floor 20)', users.length >= 20, String(users.length));
});
