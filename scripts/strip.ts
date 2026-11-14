// The one comment stripper for every check: the AMS's, vendored verbatim in
// scripts/vendor/strip-comments.cjs (14 Nov 2026).
//
// Every check here used to strip block comments with a lazy pattern from a
// slash-star to the next star-slash. It reads the "/*" inside a string such as
// 'image/*' as a comment and deletes real code up to the next "*/", after which
// a "must not" assertion passes over nothing. The AMS found 37 of its checks
// fooled that way. Measured here the same day: no app check had been — none of
// the AMS files the app reads, and no app source, lost code — so no earlier
// green was wrong. This closes it before one is.
import { createRequire } from 'node:module';

type Stripper = {
  stripComments: (src: string, opts?: { line?: boolean; block?: boolean }) => string;
  stripBlockComments: (src: string) => string;
};
const S = createRequire(import.meta.url)('./vendor/strip-comments.cjs') as Stripper;

/** Line and block comments removed; strings, template literals and regular expressions read as the language reads them. */
export const strip = (src: string): string => S.stripComments(src);

/** Block comments only (a line comment is kept, and nothing inside it opens one). */
export const stripBlockComments = (src: string): string => S.stripBlockComments(src);
