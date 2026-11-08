// Filling an AMS path's parameters, for every screen (moved here from
// teacher/today.ts on 8 Nov 2026, when the student screens needed it too).

/**
 * Fill a path's `:name` parameters. The AMS names them both ways —
 * `:session_id` and `:submissionId` — so a name is any identifier. Until
 * 8 Nov 2026 this matched lowercase and underscore only, so `:submissionId`
 * was read as `:submission` and the review went to `/submissions/Id/review`
 * (the AMS: "Invalid value in request"). A name the caller did not give is a
 * mistake in the app: it throws rather than send a path the AMS would read as
 * an id. today.check §1b holds every path and every call site to this.
 */
export function pathFor(path: string, params: Record<string, string>): string {
  return path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, k: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, k)) throw new Error(`pathFor: no value for :${k} in ${path}`);
    return encodeURIComponent(params[k]);
  });
}
