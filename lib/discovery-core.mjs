/**
 * Area and cuisine landing pages (Master Spec §27): group the public restaurants by area and by
 * cuisine, with stable URL slugs. Pure, so pages, the sitemap and tests share one rule.
 *
 * Cuisine comes from the tag array (`cuisine`, M2-B) and the legacy single `cuisine_type`; both
 * match case-insensitively. A page with fewer than MIN_INDEXABLE restaurants still renders but is
 * not indexed and not in the sitemap (spec: no thin pages).
 */

export const MIN_INDEXABLE = 2;
export const DISCOVERY_KINDS = Object.freeze(["area", "cuisine"]);

/** URL slug for a label: lowercase letters and digits joined by single hyphens; '' if none. */
export function discoverySlug(label) {
  return String(label ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** The restaurant's area label, or null. */
export function merchantArea(merchant) {
  const area = clean(merchant?.area);
  return area && discoverySlug(area) ? area : null;
}

/** The restaurant's cuisine labels (tags first, then the legacy type), without case duplicates. */
export function merchantCuisines(merchant) {
  const labels = [...(Array.isArray(merchant?.cuisine) ? merchant.cuisine : []), merchant?.cuisine_type].map(clean).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const label of labels) {
    const slug = discoverySlug(label);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(label);
  }
  return out;
}

function labelsOf(kind, merchant) {
  if (kind === "area") {
    const area = merchantArea(merchant);
    return area ? [area] : [];
  }
  return merchantCuisines(merchant);
}

/**
 * `[{ slug, label, count, indexable }]` for one kind, most restaurants first, then by label.
 * The label shown is the most common spelling among the restaurants.
 */
export function discoveryGroups(kind, merchants) {
  const groups = new Map();
  for (const merchant of merchants ?? []) {
    for (const label of labelsOf(kind, merchant)) {
      const slug = discoverySlug(label);
      const group = groups.get(slug) ?? { slug, count: 0, spellings: new Map() };
      group.count += 1;
      group.spellings.set(label, (group.spellings.get(label) ?? 0) + 1);
      groups.set(slug, group);
    }
  }
  return [...groups.values()]
    .map(({ slug, count, spellings }) => ({
      slug,
      label: [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      count,
      indexable: count >= MIN_INDEXABLE,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** The landing page for `slug` of a kind: `{ slug, label, merchants, indexable }`, or null. */
export function discoveryLanding(kind, slug, merchants) {
  if (!DISCOVERY_KINDS.includes(kind)) return null;
  const group = discoveryGroups(kind, merchants).find((g) => g.slug === slug);
  if (!group) return null;
  const list = (merchants ?? [])
    .filter((m) => labelsOf(kind, m).some((label) => discoverySlug(label) === slug))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return { slug: group.slug, label: group.label, merchants: list, indexable: group.indexable };
}

export function discoveryPath(kind, slug) {
  return `/${kind}/${slug}`;
}

/** Page title and description for a landing page. */
export function discoveryCopy(kind, label, count) {
  const places = `${count} ${count === 1 ? "place" : "places"}`;
  if (kind === "area") {
    return { title: `Restaurants in ${label}`, heading: `Places to eat in ${label}`, description: `${places} to eat in ${label} on BiteSite: menus, photos, opening hours and how to order.` };
  }
  return { title: `${label} restaurants`, heading: `${label} food`, description: `${places} serving ${label} food on BiteSite: menus, photos, opening hours and how to order.` };
}
