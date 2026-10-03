/* bitesite/app/merchant/components/menu-manager.tsx */
'use client';

/**
 * Owner menu manager (M3a), mobile first. Each change (add, rename, reorder, move, edit, sold-out
 * toggle, delete) is one request to /api/merchant/restaurants/[id]/menu and the reply carries the
 * fresh menu, which replaces the list. Dish edits send only changed fields with the value this
 * page showed, so a change made on another device is reported instead of overwritten. If a
 * result is unknown (network), Retry resends the same request id, so nothing is applied twice.
 * Dish photos use the checked photo flow (ProfileImageField with slot 'dish'); a new dish gets a
 * photo after it is saved.
 */

import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { findDuplicateDishName, MENU_LIMITS, parsePriceInput, type MenuCategory, type MenuProduct, type MenuSnapshot } from '@/lib/merchant-menu-core.mjs';
import { ProfileImageField } from '@/app/components/media/profile-image-field';

type Op = { type: string } & Record<string, unknown>;
type Pending = { requestId: string; op: Op };
type DishForm = {
  id: string | null;
  categoryId: string;
  name: string;
  description: string;
  price: string;
  discountPrice: string;
  showPrices: boolean;
  isFeatured: boolean;
  isAvailable: boolean;
};

const card = 'rounded-2xl border border-[#DDE5DC] bg-white';
const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium disabled:opacity-50';
const iconBtn = 'inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#DDE5DC] text-[#2C3E2D] disabled:opacity-40';
const input = 'mt-1 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-3 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

const priceText = (value: number | null) => (value === null ? '' : value.toFixed(2));
const priceLabel = (product: MenuProduct) => {
  if (product.price === null) return 'No price';
  if (product.discountPrice !== null) return `RM ${product.discountPrice.toFixed(2)} (was ${product.price.toFixed(2)})`;
  return `RM ${product.price.toFixed(2)}`;
};
const byOrder = <T extends { sortOrder: number | null }>(list: T[]) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
const moved = (ids: string[], index: number, delta: number) => {
  const next = [...ids];
  const target = index + delta;
  if (target < 0 || target >= next.length) return null;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

export function MenuManager({ merchantId, getHeaders, readOnly, register, onChanged }: {
  merchantId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
  onChanged?: () => void;
}) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/menu`;
  const [menu, setMenu] = useState<MenuSnapshot | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [unknown, setUnknown] = useState<Pending | null>(null);
  const [dish, setDish] = useState<DishForm | null>(null);
  const [dishError, setDishError] = useState('');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [rename, setRename] = useState<{ id: string; name: string; original: string } | null>(null);
  const busyRef = useRef(false);
  useEffect(() => {
    register?.('menu', { status: () => ({ dirty: !!dish || newCategory !== null || !!rename, pending: busy, unknown: !!unknown, conflicts: false }), save: async () => 'skipped', discard: () => { setDish(null); setNewCategory(null); setRename(null); } });
    return () => register?.('menu', null);
  }, [register, busy, unknown, dish, newCategory, rename]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setLoadError('Your session has ended. Sign in again.'); return; }
      const response = await fetch(api, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.menu) { setLoadError(data?.error?.message || data?.error || 'Could not load your menu.'); return; }
      setMenu(data.menu as MenuSnapshot);
      setIsPublic(data.public === true);
    } catch {
      setLoadError('Could not reach BiteSite. Check your connection.');
    }
  }, [api, getHeaders]);

  useEffect(() => { void load(); }, [load]);

  /** Send one change; returns true when it was applied. */
  const send = async (pending: Pending, success: string): Promise<boolean> => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again, then retry.' }); return false; }
      let response: Response;
      try {
        response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
      } catch {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'Could not reach BiteSite. Retry sends the same change, so it is never applied twice.' });
        return false;
      }
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        setUnknown(pending);
        setMessage({ kind: 'error', text: 'The result is not confirmed. Retry sends the same change, so it is never applied twice.' });
        return false;
      }
      setUnknown(null);
      if (data.menu) setMenu(data.menu as MenuSnapshot);
      if (response.ok) { setMessage({ kind: 'ok', text: success }); return true; }
      setMessage({ kind: 'error', text: data.error?.message || 'The change was not saved.' });
      if (response.status === 409 && !data.menu) void load();
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const change = (op: Op, success: string) => send({ requestId: crypto.randomUUID(), op }, success);

  if (loadError) return <p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>;
  if (!menu) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;

  const categories = byOrder(menu.categories);
  const productsOf = (categoryId: string | null) => byOrder(menu.products.filter((p) => p.categoryId === categoryId));
  const uncategorized = menu.products.filter((p) => !p.categoryId || !categories.some((c) => c.id === p.categoryId));
  const locked = readOnly || busy || !!unknown;
  const originalDish = dish?.id ? menu.products.find((product) => product.id === dish.id) : null;
  const nameOrCategoryChanged = dish && (!originalDish || originalDish.name.trim().toLocaleLowerCase() !== dish.name.trim().toLocaleLowerCase() || originalDish.categoryId !== dish.categoryId);
  const duplicateDish = dish && nameOrCategoryChanged ? findDuplicateDishName(menu.products, dish.categoryId, dish.name, dish.id) : null;

  const openDish = (categoryId: string, product?: MenuProduct) => {
    setDishError('');
    setDish(product
      ? { id: product.id, categoryId, name: product.name, description: product.description ?? '', price: priceText(product.price), discountPrice: priceText(product.discountPrice), showPrices: product.showPrices, isFeatured: product.isFeatured, isAvailable: product.isAvailable }
      : { id: null, categoryId, name: '', description: '', price: '', discountPrice: '', showPrices: true, isFeatured: false, isAvailable: true });
  };

  const saveDish = async () => {
    if (!dish) return;
    const name = dish.name.trim();
    if (!name) { setDishError('Give the dish a name.'); return; }
    const price = parsePriceInput(dish.price);
    if (!price.ok) { setDishError(`Price: ${price.message}`); return; }
    const discount = parsePriceInput(dish.discountPrice);
    if (!discount.ok) { setDishError(`Discount price: ${discount.message}`); return; }
    if (discount.value !== null && (price.value === null || discount.value > price.value)) { setDishError('The discount price needs a normal price and cannot be higher than it.'); return; }
    const values = { name, description: dish.description.trim() || null, price: price.value, discountPrice: discount.value, showPrices: dish.showPrices, isFeatured: dish.isFeatured, isAvailable: dish.isAvailable };
    if (!dish.id) {
      if (await change({ type: 'create_product', categoryId: dish.categoryId, ...values }, `${name} added.`)) setDish(null);
      return;
    }
    const original = menu.products.find((p) => p.id === dish.id);
    if (!original) { setDish(null); return; }
    const current: Record<string, unknown> = { name: original.name, description: original.description, price: original.price, discountPrice: original.discountPrice, showPrices: original.showPrices, isFeatured: original.isFeatured, isAvailable: original.isAvailable };
    const changes: Record<string, unknown> = {};
    const expected: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== current[key]) { changes[key] = value; expected[key] = current[key]; }
    }
    let ok = true;
    if (Object.keys(changes).length > 0) ok = await change({ type: 'update_product', id: dish.id, changes, expected }, `${name} saved.`);
    if (ok && original.categoryId !== dish.categoryId) ok = await change({ type: 'move_product', id: dish.id, categoryId: dish.categoryId, expectedCategoryId: original.categoryId }, `${name} moved.`);
    if (ok) setDish(null);
  };

  const toggleAvailable = (product: MenuProduct) =>
    change({ type: 'update_product', id: product.id, changes: { isAvailable: !product.isAvailable }, expected: { isAvailable: product.isAvailable } },
      product.isAvailable ? `${product.name} marked sold out.` : `${product.name} is available again.`);

  const reorderDish = (categoryId: string, index: number, delta: number) => {
    const ids = moved(productsOf(categoryId).map((p) => p.id), index, delta);
    if (ids) void change({ type: 'reorder_products', categoryId, ids }, 'Order saved.');
  };
  const reorderCategory = (index: number, delta: number) => {
    const ids = moved(categories.map((c) => c.id), index, delta);
    if (ids) void change({ type: 'reorder_categories', ids }, 'Order saved.');
  };
  const deleteCategory = (category: MenuCategory) => {
    const count = productsOf(category.id).length;
    const text = count > 0 ? `Delete “${category.name}” and its ${count} dish${count === 1 ? '' : 'es'}?` : `Delete “${category.name}”?`;
    if (window.confirm(text)) void change({ type: 'delete_category', id: category.id, withProducts: count > 0 }, `${category.name} deleted.`);
  };

  return (
    <div className="space-y-4">
      {readOnly && <p className="text-sm text-[#6B6560]">This restaurant is read only right now, so the menu cannot be changed.</p>}
      {isPublic && <p className="text-xs text-[#6B6560]">Your page is public: changes show on it right away. Sold-out dishes stay on the menu, marked as unavailable.</p>}

      {categories.length === 0 && <p className="text-sm text-[#6B6560]">No categories yet. Add one (for example “Mains” or “Drinks”), then add dishes to it.</p>}

      {categories.map((category, ci) => {
        const products = productsOf(category.id);
        return (
          <section key={category.id} className={card}>
            <div className="flex items-center gap-2 border-b border-[#EEF2EC] p-3">
              {rename?.id === category.id ? (
                <form className="flex flex-1 flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (rename.name.trim()) void change({ type: 'rename_category', id: category.id, name: rename.name, expectedName: rename.original }, 'Category renamed.').then((ok) => { if (ok) setRename(null); }); }}>
                  <input aria-label="Category name" className={input} maxLength={MENU_LIMITS.categoryName} placeholder="e.g. Mains" value={rename.name} onChange={(event) => setRename({ ...rename, name: event.target.value })} autoFocus />
                  <div className="flex gap-2">
                    <button type="submit" disabled={locked || !rename.name.trim()} className={`${btn} flex-1 bg-[#2C3E2D] text-white`}>Save</button>
                    <button type="button" onClick={() => setRename(null)} className={`${btn} flex-1 border border-[#C9D6C7]`}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-[#2C3E2D]">{category.name}</h3>
                  <button type="button" aria-label={`Move ${category.name} up`} disabled={locked || ci === 0} onClick={() => reorderCategory(ci, -1)} className={iconBtn}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Move ${category.name} down`} disabled={locked || ci === categories.length - 1} onClick={() => reorderCategory(ci, 1)} className={iconBtn}><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Rename ${category.name}`} disabled={locked} onClick={() => setRename({ id: category.id, name: category.name, original: category.name })} className={iconBtn}><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Delete ${category.name}`} disabled={locked} onClick={() => deleteCategory(category)} className={`${iconBtn} text-red-700`}><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </div>

            <ul className="divide-y divide-[#EEF2EC]">
              {products.map((product, pi) => (
                <li key={product.id} className="flex items-center gap-2 p-3">
                  {product.imageUrl && // eslint-disable-next-line @next/next/no-img-element -- merchant menu previews use uploaded image URLs
                  <img src={product.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
                  <button type="button" disabled={locked} onClick={() => openDish(category.id, product)} className="min-w-0 flex-1 text-left disabled:opacity-60">
                    <span className="block truncate text-sm font-medium text-[#2C3E2D]">{product.name}{product.isFeatured ? ' ★' : ''}</span>
                    <span className="block text-xs text-[#6B6560]">{product.showPrices ? priceLabel(product) : 'Price hidden'}</span>
                  </button>
                  <div className="flex flex-col gap-1 sm:flex-row">
                    <button type="button" aria-label={`Move ${product.name} up`} disabled={locked || pi === 0} onClick={() => reorderDish(category.id, pi, -1)} className={`${iconBtn} h-8 sm:h-11`}><ArrowUp className="h-4 w-4" /></button>
                    <button type="button" aria-label={`Move ${product.name} down`} disabled={locked || pi === products.length - 1} onClick={() => reorderDish(category.id, pi, 1)} className={`${iconBtn} h-8 sm:h-11`}><ArrowDown className="h-4 w-4" /></button>
                  </div>
                  <button type="button" disabled={locked} onClick={() => void toggleAvailable(product)}
                    className={`${btn} w-28 shrink-0 px-2 ${product.isAvailable ? 'border border-emerald-700 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                    {product.isAvailable ? 'Available' : 'Sold out'}
                  </button>
                </li>
              ))}
            </ul>
            <div className="p-3">
              <button type="button" disabled={locked} onClick={() => openDish(category.id)} className={`${btn} w-full border border-dashed border-[#2C3E2D] text-[#2C3E2D]`}><Plus className="h-4 w-4" /> Add dish</button>
            </div>
          </section>
        );
      })}

      {uncategorized.length > 0 && (
        <section className={`${card} p-3`}>
          <h3 className="text-sm font-semibold text-[#2C3E2D]">Not on your page</h3>
          <p className="text-xs text-[#6B6560]">These dishes have no category, so they are not shown. Open one and choose a category.</p>
          <ul className="mt-2 divide-y divide-[#EEF2EC]">
            {uncategorized.map((product) => (
              <li key={product.id}><button type="button" disabled={locked || categories.length === 0} onClick={() => openDish(categories[0]?.id ?? '', product)} className="min-h-11 w-full text-left text-sm disabled:opacity-60">{product.name}</button></li>
            ))}
          </ul>
        </section>
      )}

      {newCategory === null ? (
        <button type="button" disabled={locked} onClick={() => setNewCategory('')} className={`${btn} w-full bg-[#2C3E2D] text-white sm:w-auto`}><Plus className="h-4 w-4" /> Add category</button>
      ) : (
        <form className={`${card} flex flex-col gap-2 p-3 sm:flex-row sm:items-end`} onSubmit={(event) => { event.preventDefault(); if (newCategory.trim()) void change({ type: 'create_category', name: newCategory }, `${newCategory.trim()} added.`).then((ok) => { if (ok) setNewCategory(null); }); }}>
          <label className="flex-1 text-sm font-medium text-[#2C3E2D]">New category
            <input className={input} maxLength={MENU_LIMITS.categoryName} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Mains" autoFocus />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={locked || !newCategory.trim()} className={`${btn} flex-1 bg-[#2C3E2D] text-white`}>Add</button>
            <button type="button" onClick={() => setNewCategory(null)} className={`${btn} flex-1 border border-[#C9D6C7]`}>Cancel</button>
          </div>
        </form>
      )}

      {unknown && <button type="button" disabled={busy} onClick={() => void send(unknown, 'Saved.')} className={`${btn} w-full border border-[#2C3E2D] sm:w-auto`}>{busy ? 'Retrying…' : 'Retry'}</button>}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {dish && (
        <div role="dialog" aria-modal="true" aria-labelledby="dish-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <form className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 text-[#2C3E2D] shadow-xl sm:max-w-lg sm:rounded-2xl"
            onSubmit={(event) => { event.preventDefault(); void saveDish(); }}>
            <h2 id="dish-title" className="text-lg font-semibold">{dish.id ? 'Edit dish' : 'New dish'}</h2>
            <label className="mt-4 block text-sm font-medium">Name
              <input className={input} maxLength={MENU_LIMITS.dishName} placeholder="e.g. Nasi lemak with ayam berempah" value={dish.name} onChange={(event) => setDish({ ...dish, name: event.target.value })} autoFocus={!dish.id} />
            </label>
            {duplicateDish && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">This category already has &quot;{duplicateDish.name}&quot;. Add it anyway?</p>}
            <label className="mt-3 block text-sm font-medium">Description (optional)
              <textarea className={input} rows={3} maxLength={MENU_LIMITS.description} placeholder="e.g. Coconut rice with sambal, egg, cucumber and spiced chicken." value={dish.description} onChange={(event) => setDish({ ...dish, description: event.target.value })} />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">Price (RM)
                <input className={input} inputMode="decimal" placeholder="e.g. 18.00" value={dish.price} onChange={(event) => setDish({ ...dish, price: event.target.value })} />
              </label>
              <label className="block text-sm font-medium">Discount (RM)
                <input className={input} inputMode="decimal" placeholder="e.g. 15.00" value={dish.discountPrice} onChange={(event) => setDish({ ...dish, discountPrice: event.target.value })} />
              </label>
            </div>
            <p className="mt-1 text-xs text-[#6B6560]">Leave the price empty for “no price” and discount empty for none. 0 means free.</p>
            <div className="mt-3 space-y-1">
              {([['isAvailable', 'Available (off = sold out)'], ['showPrices', 'Show the price'], ['isFeatured', 'Featured dish']] as const).map(([key, label]) => (
                <label key={key} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5" checked={dish[key]} onChange={(event) => setDish({ ...dish, [key]: event.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
            {dish.id && categories.length > 1 && (
              <label className="mt-3 block text-sm font-medium">Category
                <select className={input} value={dish.categoryId} onChange={(event) => setDish({ ...dish, categoryId: event.target.value })}>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
            )}
            <div className="mt-4 border-t border-[#EEF2EC] pt-4">
              {dish.id ? (
                <ProfileImageField
                  key={`dish-photo:${dish.id}`}
                  slot="dish"
                  productId={dish.id}
                  label="Dish photo"
                  value={menu.products.find((p) => p.id === dish.id)?.imageUrl ?? null}
                  apiBase={`${api}/dish-photo`}
                  getHeaders={getHeaders}
                  disabled={readOnly}
                  onChanged={(value) => setMenu((current) => current ? { ...current, products: current.products.map((p) => (p.id === dish.id ? { ...p, imageUrl: value } : p)) } : current)}
                />
              ) : (
                <p className="text-sm text-[#6B6560]">Save the dish first, then open it again to add a photo.</p>
              )}
            </div>
            {dishError && <p className="mt-3 text-sm text-red-700" role="alert">{dishError}</p>}
            {message?.kind === 'error' && <p className="mt-3 text-sm text-red-700" role="alert">{message.text}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="submit" disabled={locked} className={`${btn} bg-[#2C3E2D] text-white`}>{busy ? 'Saving…' : 'Save'}</button>
              <button type="button" disabled={busy} onClick={() => setDish(null)} className={`${btn} border border-[#C9D6C7]`}>Cancel</button>
              {dish.id && (
                <button type="button" disabled={locked} className={`${btn} text-red-700`}
                  onClick={() => { if (window.confirm(`Delete “${dish.name}”?`)) void change({ type: 'delete_product', id: dish.id }, `${dish.name} deleted.`).then((ok) => { if (ok) setDish(null); }); }}>
                  <Trash2 className="h-4 w-4" /> Delete dish
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
