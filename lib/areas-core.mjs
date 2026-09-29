/*
 * Area list matching (issue #7): the fixed list lives in public.areas; the database turns any
 * listed name or alias into the listed spelling and refuses the rest. This module ranks the
 * suggestions an owner or admin sees while typing, and finds the listed area for typed text.
 */

const norm = (value) => (typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, " ") : "");

/** The listed area whose name or alias equals `text` (case and spacing ignored), or null. */
export function findArea(areas, text) {
  const key = norm(text);
  if (!key) return null;
  return areas.find((a) => norm(a.name) === key) ?? areas.find((a) => (a.aliases ?? []).some((x) => norm(x) === key)) ?? null;
}

/**
 * Suggestions for `query`, best first: exact name or alias, name starts with it, a word in the
 * name starts with it, an alias starts with it, then the name contains it. Ties sort by name.
 */
export function matchAreas(areas, query, limit = 8) {
  const key = norm(query);
  if (!key) return [];
  const rank = (a) => {
    const name = norm(a.name);
    const aliases = (a.aliases ?? []).map(norm);
    if (name === key || aliases.includes(key)) return 0;
    if (name.startsWith(key)) return 1;
    if (name.split(" ").some((w) => w.startsWith(key))) return 2;
    if (aliases.some((x) => x.startsWith(key))) return 3;
    if (name.includes(key)) return 4;
    return -1;
  };
  return areas
    .map((a) => ({ a, r: rank(a) }))
    .filter((x) => x.r >= 0)
    .sort((x, y) => x.r - y.r || x.a.name.localeCompare(y.a.name))
    .slice(0, limit)
    .map((x) => x.a);
}
