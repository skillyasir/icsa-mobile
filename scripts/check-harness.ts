// The tiny harness every *.check.ts uses. Run any check on its own with
// `node path/to/x.check.ts` (Node strips the types), or all of them with
// `npm run checks`.
//
// Exit codes, as in the AMS: 0 every assertion passed; 1 an assertion failed;
// 2 the check could not run (it threw before finishing). A check that could
// not run told you nothing, so it never reads as a pass.
//
// Every check file starts with selfTest(): it proves the harness can fail by
// planting a failure in a separate tally and requiring it to be counted. A
// check whose helper could only ever pass would otherwise look exactly like
// one that passed.

export type Harness = {
  check: (label: string, cond: boolean, detail?: string) => void;
  readonly passed: number;
  readonly failed: number;
};

export function makeHarness(quiet = false): Harness {
  let passed = 0;
  let failed = 0;
  return {
    check(label, cond, detail) {
      if (typeof label !== 'string' || typeof cond !== 'boolean') {
        throw new TypeError(`check(label, cond): got (${typeof label}, ${typeof cond}) for "${String(label)}"`);
      }
      if (cond) {
        passed++;
        if (!quiet) console.log(`  ok    ${label}`);
      } else {
        failed++;
        if (!quiet) console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
      }
    },
    get passed() {
      return passed;
    },
    get failed() {
      return failed;
    },
  };
}

/** §0 of every check: a planted failure must be counted, a planted pass too. */
export function selfTest(h: Harness): void {
  const probe = makeHarness(true);
  probe.check('planted pass', true);
  probe.check('planted failure', false);
  h.check('§0 the harness counts a planted failure and a planted pass', probe.failed === 1 && probe.passed === 1);
}

/** Run a check body; exit 2 if it throws, 1 on any failure, else 0. */
export function run(name: string, body: (h: Harness) => void): void {
  const h = makeHarness();
  console.log(`${name}`);
  try {
    selfTest(h);
    body(h);
  } catch (err) {
    console.log(`  COULD NOT RUN — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  }
  console.log(`  ${h.passed} passed, ${h.failed} failed`);
  process.exit(h.failed > 0 ? 1 : 0);
}
