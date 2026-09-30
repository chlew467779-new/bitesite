/*
 * Admin menu import (CH 2026-09-30): the Gemini prompt and the reader for what Gemini sends back.
 * Pure, browser-safe; shared by the Admin menu editor, /api/admin/menu-import and
 * scripts/test-menu-import.mjs. The database applies the same limits again
 * (public.merchant_menu_import, supabase/migrations/20260930130000_menu_import.sql).
 *
 * Flow: CH asks the restaurant for photos of its printed menu (overlapping shots of one big menu
 * are fine), uploads them to Gemini with MENU_IMPORT_PROMPT, pastes the answer into Admin, checks
 * the preview and imports. Dishes already on the menu are skipped, never changed.
 */

export const MENU_IMPORT_LIMITS = Object.freeze({ categories: 60, dishes: 1000, categoryName: 80, dishName: 160, description: 2000, price: 100000 });

export const MENU_IMPORT_PROMPT = `You are reading photos of ONE restaurant's printed menu for the BiteSite website.
The photos may overlap: the same part of the menu can appear in several photos. Read every photo and return the complete menu ONCE.

Reply with only this JSON, inside one \`\`\`json code block, and nothing else:
{
  "categories": [
    {
      "name": "Section heading as printed, e.g. Rice, Noodles, Drinks",
      "dishes": [
        { "name": "Dish name as printed", "description": "Text printed with the dish, or null", "price": 12.5, "unclear": false }
      ]
    }
  ],
  "notes": ["Anything you could not read or were unsure about"]
}

Rules:
1. Each dish appears only once, even if it is in several photos. Keep the order of the menu.
2. Copy names exactly as printed. If a name is printed in two languages, write both joined by " / " (for example "Nasi Lemak / 椰浆饭"). Do not translate. Do not invent descriptions.
3. "price" is a number in RM without "RM" (for example 8.5). Use null when no price is printed, or when it says market price or seasonal price (then put those words in "description").
4. If one dish has several sizes or options with different prices (Small/Large, Hot/Cold, Rice/Noodle), write one dish per option, for example "Teh Tarik (Hot)" and "Teh Tarik (Cold)".
5. Add-ons and extras (for example "Add egg +RM1.00") go in a section called "Add-ons".
6. If the menu has no section headings, use one section called "Menu".
7. If you are not sure about a name or a price, still include the dish and set "unclear": true. Otherwise set "unclear": false.
8. Section names up to 80 characters, dish names up to 160, descriptions up to 300.`;

const clean = (value) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '');
/** Same-dish key: case, spacing and a trailing full stop do not matter. */
export const dishKey = (name) => clean(name).toLowerCase().replace(/[.\s]+$/, '');

/** "RM 12.50", "12,50", 12.5 → 12.5; null/"" → null; anything else → NaN (an error). */
export function parsePrice(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) / 100 : NaN;
  if (typeof value !== 'string') return NaN;
  const text = value.trim();
  if (!text || /^(-|n\/?a|null)$/i.test(text)) return null;
  const match = text.replace(/^(rm|myr|\$)\s*/i, '').match(/^(\d{1,6})(?:[.,](\d{1,2}))?$/);
  if (!match) return NaN;
  return Math.round(Number(`${match[1]}.${match[2] || '0'}`) * 100) / 100;
}

function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Paste what Gemini sent back.' };
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf('}'), body.lastIndexOf(']'));
  if (start < 0 || end < start) return { error: 'No menu found. Paste the whole answer from Gemini, including the ```json block.' };
  try { return { value: JSON.parse(body.slice(start, end + 1)) }; }
  catch { return { error: 'The pasted text is not complete JSON. Ask Gemini to "send the full JSON again" and paste it all.' }; }
}

/**
 * Read Gemini's answer. Merges the same section and the same dish seen in overlapping photos
 * (keeping the first and filling in a missing price or description from the others).
 * Returns { ok, categories, notes, problems, warnings, merged }: `problems` block the import,
 * `warnings` only need a look.
 */
export function parseMenuImport(text) {
  const parsed = extractJson(text);
  if (parsed.error) return { ok: false, message: parsed.error };
  const root = parsed.value;
  const rawCategories = Array.isArray(root) ? root : root && Array.isArray(root.categories) ? root.categories : null;
  if (!rawCategories) return { ok: false, message: 'The answer has no "categories" list. Use the prompt above so Gemini replies in BiteSite\'s format.' };

  const problems = [];
  const warnings = [];
  let merged = 0;
  const categories = [];
  const byName = new Map();

  rawCategories.forEach((rawCategory, ci) => {
    const name = clean(rawCategory?.name) || 'Menu';
    if (name.length > MENU_IMPORT_LIMITS.categoryName) problems.push(`Section "${name.slice(0, 40)}…" is longer than ${MENU_IMPORT_LIMITS.categoryName} characters.`);
    const key = dishKey(name);
    let category = byName.get(key);
    if (!category) {
      category = { name, dishes: [], index: new Map() };
      byName.set(key, category);
      categories.push(category);
    }
    const dishes = Array.isArray(rawCategory?.dishes) ? rawCategory.dishes : [];
    if (!Array.isArray(rawCategory?.dishes)) problems.push(`Section ${ci + 1} ("${name}") has no "dishes" list.`);
    dishes.forEach((raw) => {
      const dishName = clean(raw?.name);
      if (!dishName) { problems.push(`A dish in "${name}" has no name.`); return; }
      const price = parsePrice(raw?.price);
      const description = clean(raw?.description) || null;
      const unclear = raw?.unclear === true;
      if (Number.isNaN(price) || (price !== null && (price < 0 || price > MENU_IMPORT_LIMITS.price))) problems.push(`"${dishName}" (${name}): the price "${raw?.price}" is not a number of RM.`);
      if (dishName.length > MENU_IMPORT_LIMITS.dishName) problems.push(`"${dishName.slice(0, 40)}…" (${name}) is longer than ${MENU_IMPORT_LIMITS.dishName} characters.`);
      if (description && description.length > MENU_IMPORT_LIMITS.description) problems.push(`The description of "${dishName}" is longer than ${MENU_IMPORT_LIMITS.description} characters.`);
      const dk = dishKey(dishName);
      const existing = category.index.get(dk);
      if (existing) {
        merged += 1;
        if (existing.price === null && price !== null && !Number.isNaN(price)) existing.price = price;
        else if (price !== null && !Number.isNaN(price) && existing.price !== price) {
          existing.unclear = true;
          warnings.push(`"${dishName}" (${name}) was read with two prices: RM ${existing.price.toFixed(2)} and RM ${price.toFixed(2)}. The first is kept; check it.`);
        }
        if (!existing.description && description) existing.description = description;
        if (unclear) existing.unclear = true;
        return;
      }
      const dish = { name: dishName, description, price: Number.isNaN(price) ? null : price, unclear };
      category.index.set(dk, dish);
      category.dishes.push(dish);
    });
  });

  // The same dish name under two sections is usually a heading misread across photos.
  const seen = new Map();
  for (const category of categories) {
    for (const dish of category.dishes) {
      const other = seen.get(dishKey(dish.name));
      if (other && other !== category.name) warnings.push(`"${dish.name}" is in both "${other}" and "${category.name}". Remove one after importing if it is the same dish.`);
      else seen.set(dishKey(dish.name), category.name);
    }
  }

  const list = categories.filter((c) => c.dishes.length > 0).map(({ name, dishes }) => ({ name, dishes }));
  const total = list.reduce((sum, c) => sum + c.dishes.length, 0);
  if (total === 0) return { ok: false, message: 'No dishes found in the answer.' };
  if (list.length > MENU_IMPORT_LIMITS.categories) problems.push(`${list.length} sections: import at most ${MENU_IMPORT_LIMITS.categories} at a time.`);
  if (total > MENU_IMPORT_LIMITS.dishes) problems.push(`${total} dishes: import at most ${MENU_IMPORT_LIMITS.dishes} at a time.`);
  const notes = Array.isArray(root?.notes) ? root.notes.map(clean).filter(Boolean) : [];
  return { ok: true, categories: list, notes, problems, warnings, merged, total, unclear: list.reduce((n, c) => n + c.dishes.filter((d) => d.unclear).length, 0) };
}

/** Mark each section and dish as new or already on the menu (same matching as the database). */
export function compareWithMenu(categories, menu) {
  const existingCats = new Map(menu.categories.map((c) => [dishKey(c.name), c.id]));
  const existingDishes = new Set(menu.products.map((p) => `${p.categoryId}|${dishKey(p.name)}`));
  let newDishes = 0;
  const rows = categories.map((category) => {
    const categoryId = existingCats.get(dishKey(category.name)) ?? null;
    const dishes = category.dishes.map((dish) => {
      const exists = categoryId !== null && existingDishes.has(`${categoryId}|${dishKey(dish.name)}`);
      if (!exists) newDishes += 1;
      return { ...dish, exists };
    });
    return { name: category.name, isNew: categoryId === null, dishes };
  });
  return { rows, newDishes, newCategories: rows.filter((r) => r.isNew && r.dishes.some((d) => !d.exists)).length };
}

/** What /api/admin/menu-import sends to the database. */
export function toImportItems(categories) {
  return categories.map((c) => ({ name: c.name, dishes: c.dishes.map((d) => ({ name: d.name, description: d.description, price: d.price })) }));
}

/** Server-side check of the request body: same shape the database expects. */
export function parseImportRequest(body) {
  const fail = (message) => ({ ok: false, message });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid request.');
  const keys = Object.keys(body);
  if (!keys.every((k) => ['merchantId', 'categories'].includes(k))) return fail('Unknown field.');
  if (typeof body.merchantId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.merchantId)) return fail('Invalid restaurant.');
  if (!Array.isArray(body.categories) || body.categories.length === 0) return fail('Nothing to import.');
  return { ok: true, merchantId: body.merchantId, items: toImportItems(body.categories.map((c) => ({ name: c?.name, dishes: Array.isArray(c?.dishes) ? c.dishes : [] }))) };
}
