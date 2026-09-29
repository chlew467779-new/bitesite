/**
 * M3a Owner menu editing, shared by the API route and the Merchant menu manager. The database
 * (public.merchant_menu_apply) enforces every rule; this module checks the request shape, maps
 * errors and prepares client-side values (prices as numbers or null).
 */

import { mapFieldRpcError } from "./merchant-field-patch-core.mjs";

export const MENU_OP_TYPES = Object.freeze([
  "create_category", "rename_category", "reorder_categories", "delete_category",
  "create_product", "update_product", "move_product", "reorder_products", "delete_product",
]);
export const MAX_MENU_BODY_BYTES = 32 * 1024;
export const MENU_LIMITS = Object.freeze({ categoryName: 80, dishName: 160, description: 2000, maxPrice: 100000 });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalid = (message) => ({ ok: false, status: 400, code: "VALIDATION_FAILED", message });

/** `{ requestId, op: { type, ... } }` — the detail rules live in the database. */
export function parseMenuRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return invalid("Invalid request.");
  if (Object.keys(body).some((key) => key !== "requestId" && key !== "op")) return invalid("Invalid request.");
  if (typeof body.requestId !== "string" || !UUID_PATTERN.test(body.requestId)) return invalid("A valid requestId is required.");
  const op = body.op;
  if (!op || typeof op !== "object" || Array.isArray(op) || !MENU_OP_TYPES.includes(op.type)) return invalid("Unknown menu change.");
  if ("merchantId" in op || "merchant_id" in op) return invalid("Invalid request.");
  return { ok: true, requestId: body.requestId, op };
}

/**
 * A price typed by the user: "" -> null (no price), otherwise a number with at most 2 decimals
 * between 0 and 100000. Returns `{ ok, value }` or `{ ok: false, message }`.
 */
export function parsePriceInput(text) {
  const trimmed = String(text ?? "").trim().replace(/^RM\s*/i, "");
  if (trimmed === "") return { ok: true, value: null };
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return { ok: false, message: "Use a number like 12 or 12.50." };
  const value = Number(trimmed);
  if (value > MENU_LIMITS.maxPrice) return { ok: false, message: "That price looks too high." };
  return { ok: true, value };
}

/** Advisory only: the menu API still accepts duplicate dish names. */
export function findDuplicateDishName(products, categoryId, name, excludedId = null) {
  const normalized = typeof name === "string" ? name.trim().toLocaleLowerCase() : "";
  if (!normalized || !categoryId) return null;
  return products.find((product) => product.id !== excludedId && product.categoryId === categoryId &&
    product.name.trim().toLocaleLowerCase() === normalized) ?? null;
}

const DETAIL = Object.freeze({
  category_has_products: "This category still has dishes. Confirm that the dishes should be deleted too.",
  discount_price: "The discount price needs a normal price and cannot be higher than it.",
  category: "That category no longer exists. The menu has been refreshed.",
  product: "That dish no longer exists. The menu has been refreshed.",
});

/** Map an RPC error; menu-specific codes first, then the shared field-save codes. */
export function mapMenuRpcError(error) {
  const code = typeof error?.message === "string" ? error.message.trim() : "";
  const detail = typeof error?.details === "string" ? error.details : "";
  if (error?.code === "P0001" && code === "PUBLIC_MENU_MINIMUM") return { status: 422, code, message: "Your page is public, so the menu must keep at least one dish. Add another dish first, or ask BiteSite to hide the page." };
  if (error?.code === "P0001" && (code === "VALIDATION_FAILED" || code === "RESOURCE_NOT_FOUND") && Object.hasOwn(DETAIL, detail)) {
    return { status: code === "RESOURCE_NOT_FOUND" ? 409 : 400, code, message: DETAIL[detail] };
  }
  if (error?.code === "P0001" && code === "VALIDATION_FAILED" && detail) return { status: 400, code, message: `Please check the details: ${detail}.` };
  return mapFieldRpcError(error);
}

/** Turn the RPC result into `{ status, body }`; every reply carries the fresh menu. */
export function menuResponse(result, requestId) {
  const replayed = result?.replayed === true;
  const menu = result?.menu ?? null;
  if (result?.status === "conflict") {
    return { status: 409, body: { error: { code: "FIELD_CONFLICT", message: "This changed on another device. The latest menu is shown now; please check and try again.", conflicts: result.conflicts ?? [] }, menu, requestId, replayed } };
  }
  if (result?.status === "applied") return { status: 200, body: { data: { status: "applied", type: result.type, id: result.id ?? null }, menu, requestId, replayed } };
  return { status: 500, body: { error: { code: "INTERNAL_ERROR", message: "Unexpected result." }, requestId } };
}
