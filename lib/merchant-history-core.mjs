/**
 * Admin change history of one restaurant (public.merchant_change_log, written by the D1a audit
 * trigger). Turns log rows into readable entries: who, what kind of change, and before/after
 * values where the log keeps them (state columns and the field-save paths). Other columns
 * (slug, links, images, …) are logged by name only.
 */

export const HISTORY_PAGE_SIZE = 30;
export const HISTORY_MAX_PAGE_SIZE = 100;

const STATE_KEYS = Object.freeze(["review_status", "listing_visibility", "platform_restriction", "business_status", "state_source", "is_published", "platform_status", "first_published_at"]);

const DAY = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

const LABELS = Object.freeze({
  "profile.name": "Name", "profile.tagline": "Tagline", "profile.description": "Description",
  "profile.phone": "Phone", "profile.whatsapp": "WhatsApp", "profile.email": "Email",
  "presentation.layout": "Layout", "tags.cuisine": "Cuisine", "tags.amenities": "Amenities", "tags.occasion": "Occasion",
  "location.address": "Address", "location.area": "Area", "location.latitude": "Latitude", "location.longitude": "Longitude",
  review_status: "Review status", listing_visibility: "Visibility", platform_restriction: "Restriction",
  business_status: "Business status", state_source: "State source", is_published: "Published (legacy)",
  platform_status: "Platform status (legacy)", first_published_at: "First published",
  slug: "Web address", website: "Website", instagram: "Instagram", facebook: "Facebook", menu_pdf_url: "Menu link",
  logo_image: "Logo", cover_image: "Cover photo", operating_hours: "Opening hours (other keys)", payment_methods: "Payment methods", currency: "Price currency", tags: "Legacy tags",
});

const OPERATIONS = Object.freeze({
  merchant_field_patch: "Edit",
  merchant_listing_basics: "Listing basics",
  merchant_link_review: "Link request approved",
  merchant_link_admin_set: "Link edited by Admin",
  merchant_slug_change: "Web address changed",
  merchant_listing: "Listing",
  merchant_review: "Restaurant review",
  merchant_owner_business_status: "Open / temporarily closed",
  merchant_business_status_set: "Business status",
  merchant_governance: "Governance",
  merchant_media: "Photo",
});

export function pathLabel(path) {
  if (LABELS[path]) return LABELS[path];
  const hours = /^hours\.(mon|tue|wed|thu|fri|sat|sun)$/.exec(path);
  if (hours) return `Hours: ${DAY[hours[1]]}`;
  const feature = /^features\.(.+)$/.exec(path);
  if (feature) return `Section: ${feature[1].replace(/_/g, " ")}`;
  return path.replace(/_/g, " ");
}

export function operationLabel(operation, action) {
  if (action === "insert") return "Created";
  if (!operation) return "Change";
  const [base, detail] = operation.split(":");
  const label = OPERATIONS[base];
  if (!label) return operation;
  return detail ? `${label} (${detail.replace(/_/g, " ")})` : label;
}

export function actorLabel(actorType, email) {
  if (actorType === "owner") return email ? `Owner ${email}` : "Owner";
  if (actorType === "admin") return "BiteSite Admin";
  if (actorType === "system") return "System";
  return "Unknown (direct database change)";
}

/** Short display text for a logged value. */
export function formatValue(value) {
  if (value === undefined) return null;
  if (value === null) return "—";
  if (Array.isArray(value)) return value.length ? value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ") : "—";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "object") {
    if ("open" in value || "close" in value || "closed" in value) {
      if (value.closed) return "closed";
      return [value.open, value.close].filter(Boolean).join("–") || JSON.stringify(value);
    }
    return JSON.stringify(value);
  }
  const text = String(value);
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

/**
 * One log row -> `{ id, revision, at, operation, actorType, actorId, reason, changes: [{ path, label, before, after }] }`.
 * `before`/`after` are display strings, or null when the log keeps only the path name.
 */
export function describeHistoryRow(row) {
  const before = row.before && typeof row.before === "object" ? row.before : {};
  const after = row.after && typeof row.after === "object" ? row.after : {};
  const changes = [];
  if (row.action === "update") {
    for (const key of STATE_KEYS) {
      if (key in before && key in after && JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        changes.push({ path: key, label: pathLabel(key), before: formatValue(before[key]), after: formatValue(after[key]) });
      }
    }
  }
  for (const path of Array.isArray(row.changed_paths) ? row.changed_paths : []) {
    if (STATE_KEYS.includes(path)) continue;
    const logged = path in before || path in after;
    changes.push({ path, label: pathLabel(path), before: logged ? formatValue(before[path]) : null, after: logged ? formatValue(after[path]) : null });
  }
  return {
    id: row.id,
    revision: row.revision,
    at: row.created_at,
    operation: operationLabel(row.operation, row.action),
    actorType: row.actor_type,
    actorId: row.actor_type === "owner" ? row.actor_id ?? null : null,
    reason: row.reason ?? null,
    changes,
  };
}

/** `?before=<revision>&limit=<n>` -> `{ ok, before, limit }`. */
export function parseHistoryQuery(params) {
  const beforeText = params.get("before");
  const limitText = params.get("limit");
  let before = null;
  if (beforeText !== null) {
    if (!/^\d{1,15}$/.test(beforeText)) return { ok: false, message: "before must be a revision number." };
    before = Number(beforeText);
  }
  let limit = HISTORY_PAGE_SIZE;
  if (limitText !== null) {
    if (!/^\d{1,3}$/.test(limitText) || Number(limitText) < 1 || Number(limitText) > HISTORY_MAX_PAGE_SIZE) return { ok: false, message: `limit must be 1 to ${HISTORY_MAX_PAGE_SIZE}.` };
    limit = Number(limitText);
  }
  return { ok: true, before, limit };
}
