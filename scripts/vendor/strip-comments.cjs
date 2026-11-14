// VENDORED from the AMS — scripts/strip-comments.js, VERBATIM below the marker.
// The one comment stripper every app check uses (the AMS's, 14 Nov 2026): it
// reads strings, template literals and regular expressions as the language
// does, so the "/*" inside 'image/*' never deletes the code after it.
// scripts/strip.check.ts holds everything below the marker byte-identical to
// the AMS copy on the Mac, and in agreement with TypeScript's own parser on
// every app file. To update it, copy the AMS file again — never edit it here.
// ── verbatim below ──
'use strict';
// Remove JavaScript comments WITHOUT reading inside strings, template literals
// or regular expressions (14 Nov 2026).
//
// The pattern 120 check files used (a lazy regular expression from a slash-star
// to the next star-slash) reads
// the "/*" inside a string — accept="image/*", '/api/*' — as a comment opening,
// and deletes everything up to the next "*/" in the file: real code, which every
// negative assertion over it then passes vacuously. This walks the text the way
// the language does instead.
//
//   stripComments(src)                  both kinds removed
//   stripComments(src, { line: false }) block comments only; a line comment is
//                                       kept, and nothing inside it opens one
//   stripComments(src, { block: false }) line comments only
//
// A block comment is replaced by '' (as the pattern did). JSX `{/* … */}` is a
// block comment inside braces, so `{}` is left — as the pattern left it.
//
// It never throws, and it reads only JavaScript-shaped text well. Strings end
// at a newline (JavaScript's own rule for '' and ""), so an apostrophe in JSX
// text or SQL costs at most the rest of its line, never the rest of the file.

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new',
  'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
const isIdStart = (c) => /[A-Za-z_$]/.test(c);
const isId = (c) => /[\w$]/.test(c);

const stripComments = (src, opts) => {
  const o = opts || {};
  const dropBlock = o.block !== false, dropLine = o.line !== false;
  const s = String(src); const n = s.length;
  let out = ''; let i = 0;
  let prev = ''; let prevWord = '';
  // A template literal's ${…} is code; `stack` remembers, for each open ${, the
  // brace depth at which it returns to the template.
  const stack = []; let depth = 0;

  const scanTemplate = () => {          // at the character after an opening ` or a closing }
    while (i < n) {
      const c = s[i];
      if (c === '\\') { out += s.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { out += c; i++; prev = 'id'; return; }
      if (c === '$' && s[i + 1] === '{') { out += '${'; i += 2; stack.push(depth); depth++; prev = 'punct'; return; }
      out += c; i++;
    }
  };

  while (i < n) {
    const c = s[i], d = s[i + 1];
    if (c === '/' && d === '*') {
      const end = s.indexOf('*/', i + 2); const stop = end < 0 ? n : end + 2;
      if (!dropBlock) out += s.slice(i, stop);
      i = stop; continue;
    }
    if (c === '/' && d === '/') {
      const end = s.indexOf('\n', i); const stop = end < 0 ? n : end;
      if (!dropLine) out += s.slice(i, stop);
      i = stop; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1;
      const stop = j < n && s[j] === c ? j + 1 : j;
      out += s.slice(i, stop); i = stop; prev = 'id'; continue;
    }
    if (c === '`') { out += c; i++; scanTemplate(); continue; }
    if (c === '/') {
      const regexHere = !((prev === 'id' && !KEYWORDS_BEFORE_REGEX.has(prevWord)) || prev === 'num' || prev === ')' || prev === ']');
      if (regexHere) {
        let j = i + 1; let inClass = false; let ok = false;
        while (j < n && s[j] !== '\n') {
          const ch = s[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') inClass = true;
          else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) { ok = true; break; }
          j++;
        }
        if (ok) {
          j++; while (j < n && /[a-z]/i.test(s[j])) j++;
          out += s.slice(i, j); i = j; prev = 'id'; prevWord = ''; continue;
        }
      }
      out += c; i++; prev = 'punct'; continue;
    }
    if (c === '{') { depth++; out += c; i++; prev = 'punct'; continue; }
    if (c === '}') {
      if (stack.length && depth - 1 === stack[stack.length - 1]) {
        stack.pop(); depth--; out += c; i++; scanTemplate(); continue;
      }
      depth = Math.max(0, depth - 1); out += c; i++; prev = 'punct'; continue;
    }
    if (isIdStart(c)) {
      let j = i + 1; while (j < n && isId(s[j])) j++;
      prevWord = s.slice(i, j); prev = 'id'; out += prevWord; i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1; while (j < n && /[\w.]/.test(s[j])) j++;
      out += s.slice(i, j); i = j; prev = 'num'; continue;
    }
    if (c === ')' || c === ']') { prev = c; out += c; i++; continue; }
    if (/\s/.test(c)) { out += c; i++; continue; }
    prev = 'punct'; prevWord = ''; out += c; i++;
  }
  return out;
};

const stripBlockComments = (src) => stripComments(src, { line: false });

// A drop-in for the pattern in a .replace() chain: `s.replace(BLOCK_COMMENTS, '')`
// strips block comments the way stripBlockComments does. String.prototype.replace
// hands its work to a search value's Symbol.replace, so the chains every check
// already had keep their shape and their order (line comments first, where a
// check strips both).
const BLOCK_COMMENTS = Object.freeze({ [Symbol.replace]: (s) => stripBlockComments(s) });

module.exports = { stripComments, stripBlockComments, BLOCK_COMMENTS };
