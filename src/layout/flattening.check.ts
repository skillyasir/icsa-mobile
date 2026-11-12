import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { run } from '../../scripts/check-harness.ts';

// Android's renderer (Fabric) leaves out — "flattens" — a plain View that draws
// nothing, and puts its children straight into the nearest View that is drawn.
// A View that draws only SOMETIMES (a dim, a background or a border added under
// a condition) is flattened and unflattened as the condition changes, and its
// native children are moved from one parent to another.
//
// 12 Nov 2026: that crashed the Play build the moment a sign-in finished
// ("addViewAt: failed to insert view … The specified child already has a
// parent"). The wrapper round Google's button dims while busy, and undimming
// put the button back while Android still had it in the wrapper. iPhone moves
// views without complaint, and the Android debug sign-in had used the preview,
// so it showed only on the Play build.
//
// The rule, for every .tsx under src/: a plain View whose style ADDS something
// visible under a condition is kept drawn always (collapsable false). One that
// only swaps one colour for another is drawn either way and needs nothing.

const ROOT = new URL('../../', import.meta.url).pathname;
const VISUAL = /\b(opacity|backgroundColor|borderWidth|borderColor|borderRadius|transform|elevation|shadow\w*)\b/;

const strip = (s: string) => s.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) tsxFiles(p, out);
    else if (name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

/** Every opening tag of a plain View (not ViewPager and the like), braces counted so a `>` inside {…} does not end it. */
function viewTags(src: string): { at: number; text: string }[] {
  const out: { at: number; text: string }[] = [];
  for (let i = src.indexOf('<View'); i >= 0; i = src.indexOf('<View', i + 5)) {
    if (!/[\s>/]/.test(src[i + 5] ?? '')) continue;
    let depth = 0;
    let j = i + 5;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) break;
    }
    out.push({ at: i, text: src.slice(i, j + 1) });
  }
  return out;
}

/** The StyleSheet entries of a file: `  name: { … },` → its body. */
function styleDefs(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of src.matchAll(/^\s{2}(\w+):\s*\{([^}]*)\}/gm)) out[m[1]] = m[2];
  return out;
}

/** Does this View's style add something visible only under a condition? */
function addsDrawingUnderCondition(tag: string, defs: Record<string, string>): boolean {
  const style = tag.match(/style=\{([\s\S]*)\}/)?.[1] ?? '';
  if (!/&&|\?/.test(style)) return false;
  const picked = [...style.matchAll(/(?:&&|\?|:)\s*styles\.(\w+)/g)].map((m) => m[1]);
  if (picked.some((k) => VISUAL.test(defs[k] ?? ''))) return true;
  return /&&\s*\{[^}]*\b(opacity|backgroundColor|borderWidth|borderColor|transform|elevation)\b/.test(style);
}

const keptDrawn = (tag: string) => /\bcollapsable=\{false\}/.test(tag);

run('flattening.check — a View that draws only sometimes is kept drawn on Android', (h) => {
  // §1 the helpers, on shapes planted here
  h.check('§1 strip removes comments and keeps strings', strip("a('x') // gone\n/* gone */b").includes("a('x')") && !strip('a // gone').includes('gone'));
  const planted = viewTags('<ViewPager x /><View style={[a, { b: 1 }]} onLayout={() => x > 1}>\n<View/>');
  h.check('§1 viewTags finds plain Views only, whole, past braces and a > inside them', planted.length === 2 && planted[0].text === '<View style={[a, { b: 1 }]} onLayout={() => x > 1}>' && planted[1].text === '<View/>', JSON.stringify(planted));
  const defs = styleDefs('const styles = StyleSheet.create({\n  dim: { opacity: 0.55 },\n  lift: { paddingBottom: 20 },\n});');
  h.check('§1 styleDefs reads a StyleSheet', defs.dim === ' opacity: 0.55 ' && defs.lift === ' paddingBottom: 20 ');
  h.check('§1 FOUND: a dim added under a condition (the sign-in wrapper, 12 Nov 2026)', addsDrawingUnderCondition('<View style={[styles.logoButton, busy && styles.dim]}>', defs));
  h.check('§1 FOUND: an opacity object added under a condition', addsDrawingUnderCondition('<View style={[styles.x, off && { opacity: 0.5 }]}>', defs));
  h.check('§1 not found: a colour swapped for another (drawn either way)', !addsDrawingUnderCondition("<View style={{ backgroundColor: done ? 'green' : 'blue' }}>", defs));
  h.check('§1 not found: padding added under a condition (never drawn)', !addsDrawingUnderCondition('<View style={fix ? styles.lift : undefined}>', defs));
  h.check('§1 keptDrawn reads the attribute, not a mention', keptDrawn('<View collapsable={false} style={x}>') && !keptDrawn('<View style={x}>') && !keptDrawn('<View collapsable style={x}>'));

  // §2 every View in the app
  const files = tsxFiles(join(ROOT, 'src'));
  let scanned = 0;
  const found: { where: string; tag: string }[] = [];
  for (const f of files) {
    const src = strip(readFileSync(f, 'utf8'));
    const d = styleDefs(src);
    for (const t of viewTags(src)) {
      scanned++;
      if (addsDrawingUnderCondition(t.text, d)) found.push({ where: `${relative(ROOT, f)}:${src.slice(0, t.at).split('\n').length}`, tag: t.text.replace(/\s+/g, ' ') });
    }
  }
  h.check('§2 the census reads the app (floor: 60 files, 150 Views)', files.length >= 60 && scanned >= 150, `${files.length} files, ${scanned} Views`);
  h.check('§2 it finds the sign-in wrapper round Google\'s button (a census that finds nothing proves nothing)', found.some((x) => x.where.startsWith('src/app/sign-in.tsx') && /styles\.dim/.test(x.tag)), found.map((x) => x.where).join(', '));
  const loose = found.filter((x) => !keptDrawn(x.tag));
  h.check(`§2 every View that draws only sometimes is kept drawn (found ${found.length})`, loose.length === 0, loose.map((x) => `${x.where} ${x.tag}`).join(' | '));
});
