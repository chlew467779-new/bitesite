/* bitesite/lib/section-save.mjs */

/**
 * Section save state for the field-level save contract (D2-B; D2B_M1B_DECISIONS §B4).
 *
 * One section (for example "Contact": profile.phone, profile.whatsapp, profile.email) keeps, per
 * path: the server baseline snapshot `{ exists, value }`, the editable draft value, and an edit
 * generation that increases on every edit. A save sends only the dirty paths, with the baseline
 * as `expected`, and remembers which generation of each path it sent. When the reply arrives:
 * - success: every sent path's baseline becomes the confirmed snapshot; the draft follows it only
 *   if the path was not edited again after sending (later typing is never overwritten);
 * - conflict: nothing changes except the recorded conflicts; drafts stay;
 * - "keep current": that path's baseline and draft become the server's current value;
 * - "use mine": that path's baseline becomes the current value the user saw, the draft stays,
 *   so the next save sends it with the new expected (a new request id; it may conflict again).
 * All functions are pure and return new objects. Values compare structurally.
 */

/** Structural equality for JSON values (strings, numbers, booleans, null, arrays, plain objects). */
export function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (typeof a === "object") {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
  }
  return false;
}

/** The editable value of a snapshot: its value, or null when the path does not exist. */
export function snapshotValue(snapshot) {
  return snapshot && snapshot.exists ? snapshot.value : null;
}

/** New section state from server snapshots `{ [path]: { exists, value } }` for the given paths. */
export function createSection(paths, snapshots) {
  const baseline = {}, draft = {}, generation = {};
  for (const path of paths) {
    const snapshot = snapshots?.[path] ?? { exists: false };
    baseline[path] = snapshot;
    draft[path] = snapshotValue(snapshot);
    generation[path] = 0;
  }
  return { paths: [...paths], baseline, draft, generation, pending: null, conflicts: {}, error: null };
}

export function editField(state, path, value) {
  if (!state.paths.includes(path)) throw new Error(`Unknown section path ${path}`);
  return {
    ...state,
    draft: { ...state.draft, [path]: value },
    generation: { ...state.generation, [path]: state.generation[path] + 1 },
    error: state.error && state.error.fieldErrors?.[path] ? { ...state.error, fieldErrors: omit(state.error.fieldErrors, path) } : state.error,
  };
}

export function isDirtyPath(state, path) {
  return !sameValue(state.draft[path], snapshotValue(state.baseline[path]));
}

export function dirtyPaths(state) {
  return state.paths.filter((path) => isDirtyPath(state, path));
}

/**
 * The request for the dirty paths, or null when nothing is dirty. The returned object is the
 * immutable snapshot of what was sent: keep it with the pending save and match the reply to it.
 */
export function buildSave(state, requestId) {
  const paths = dirtyPaths(state);
  if (paths.length === 0) return null;
  return Object.freeze({
    requestId,
    body: { requestId, patches: paths.map((path) => ({ path, expected: state.baseline[path], value: state.draft[path] })) },
    sent: Object.freeze(Object.fromEntries(paths.map((path) => [path, Object.freeze({ generation: state.generation[path], value: state.draft[path] })]))),
  });
}

export function startSave(state, save) {
  return { ...state, pending: save, error: null };
}

/** Success (applied or no-op): `values` holds the confirmed snapshot of every sent path. */
export function applySaved(state, save, values) {
  const baseline = { ...state.baseline }, draft = { ...state.draft };
  for (const [path, sent] of Object.entries(save.sent)) {
    const confirmed = values?.[path];
    if (!confirmed) continue; // not confirmed: leave the path dirty so it is sent again
    baseline[path] = confirmed;
    if (state.generation[path] === sent.generation) draft[path] = snapshotValue(confirmed);
  }
  const conflicts = omit(state.conflicts, ...Object.keys(save.sent));
  return { ...state, baseline, draft, conflicts, pending: null, error: null };
}

/** 409 FIELD_CONFLICT: record `{ [path]: { current, proposed } }`; nothing else changes. */
export function applyConflict(state, save, conflicts) {
  const recorded = { ...state.conflicts };
  for (const conflict of conflicts ?? []) {
    if (save.sent[conflict.path]) recorded[conflict.path] = { current: conflict.current, proposed: conflict.proposed };
  }
  return { ...state, conflicts: recorded, pending: null, error: { code: "FIELD_CONFLICT" } };
}

/** Any other failure: drafts and baselines stay; the pending save is cleared. */
export function applyFailure(state, error) {
  return { ...state, pending: null, error };
}

/** Keep the server's current value for a conflicted path. */
export function keepCurrent(state, path) {
  const conflict = state.conflicts[path];
  if (!conflict) return state;
  return {
    ...state,
    baseline: { ...state.baseline, [path]: conflict.current },
    draft: { ...state.draft, [path]: snapshotValue(conflict.current) },
    generation: { ...state.generation, [path]: state.generation[path] + 1 },
    conflicts: omit(state.conflicts, path),
  };
}

/** Keep my draft for a conflicted path; the next save expects the current value that was shown. */
export function acceptMine(state, path) {
  const conflict = state.conflicts[path];
  if (!conflict) return state;
  return { ...state, baseline: { ...state.baseline, [path]: conflict.current }, conflicts: omit(state.conflicts, path) };
}

export function hasConflicts(state) {
  return Object.keys(state.conflicts).length > 0;
}

/** A section can be saved when something is dirty, no save is pending and every conflict is resolved. */
export function canSave(state) {
  return !state.pending && !hasConflicts(state) && dirtyPaths(state).length > 0;
}

function omit(object, ...keys) {
  const copy = { ...object };
  for (const key of keys) delete copy[key];
  return copy;
}
