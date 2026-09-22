/* bitesite/app/admin/components/menu-editor.tsx */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import ImageUpload from './image-upload';
import {
  Plus,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  Loader2,
  AlertCircle,
  AlertTriangle,
  X,
  Check,
  GripVertical,
  EyeOff,
} from 'lucide-react';

interface Category {
  id: string;
  merchant_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

interface Product {
  id: string;
  merchant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number | null;
  discount_price: number | null;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  show_prices: boolean;
  sort_order: number;
  created_at: string;
}

interface ProductDraft {
  id?: string;
  category_id: string | null;
  name: string;
  description: string;
  price: string;
  discount_price: string;
  image_url: string;
  is_available: boolean;
  is_featured: boolean;
  show_prices: boolean;
}

const EMPTY_DRAFT = (categoryId: string | null): ProductDraft => ({
  category_id: categoryId,
  name: '',
  description: '',
  price: '',
  discount_price: '',
  image_url: '',
  is_available: true,
  is_featured: false,
  show_prices: true,
});

interface MenuEditorProps {
  merchantId: string;
  merchantName: string;
}

/**
 * Admin Menu Editor: category and product (dish) CRUD for one merchant.
 *
 * Scope notes (see PR description / handoff for the full write-up):
 * - `show_prices` is written on every save (carried over from the existing product row, or the
 *   EMPTY_DRAFT default of true for a new dish) but has no checkbox in this editor, because no
 *   public layout renderer (classic/elegant/minimal/modern/rustic) reads it yet — a control that
 *   changed nothing on the public site would be more confusing than no control at all. Wire it up
 *   here once a layout actually renders it.
 * - No public layout renders products with category_id = null ("uncategorized") at all — such
 *   products are invisible on the live menu. This editor surfaces that explicitly rather than
 *   letting it be a silent trap.
 * - This does not touch production menu data on its own: it only writes when an operator
 *   explicitly saves a category or product through this UI.
 */
export default function MenuEditor({ merchantId, merchantName }: MenuEditorProps) {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [editingDraft, setEditingDraft] = useState<ProductDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftError, setDraftError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'category' | 'product'; id: string; label: string } | null>(null);

  const [showPreview, setShowPreview] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch(`/api/admin/menu-categories?merchant_id=${merchantId}`, { headers: { 'x-admin-token': token } }),
        fetch(`/api/admin/menu-products?merchant_id=${merchantId}`, { headers: { 'x-admin-token': token } }),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      if (!catRes.ok) throw new Error(catData.error || 'Failed to load categories');
      if (!prodRes.ok) throw new Error(prodData.error || 'Failed to load products');
      setCategories(catData.categories || []);
      setProducts(prodData.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [token, merchantId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  /* ── Categories ── */

  const addCategory = async () => {
    if (!token || !newCategoryName.trim()) return;
    setAddingCategory(true);
    setActionError('');
    try {
      const res = await fetch('/api/admin/menu-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ merchant_id: merchantId, name: newCategoryName.trim(), sort_order: categories.length }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not add category');
      setCategories((prev) => [...prev, data.category]);
      setNewCategoryName('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add category');
    } finally {
      setAddingCategory(false);
    }
  };

  const startRenameCategory = (category: Category) => {
    setRenamingCategoryId(category.id);
    setRenameValue(category.name);
  };

  const saveRenameCategory = async (category: Category) => {
    if (!token || !renameValue.trim()) return;
    setBusyId(category.id);
    setActionError('');
    try {
      const res = await fetch('/api/admin/menu-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: category.id, merchant_id: merchantId, name: renameValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not rename category');
      setCategories((prev) => prev.map((c) => (c.id === category.id ? data.category : c)));
      setRenamingCategoryId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not rename category');
    } finally {
      setBusyId(null);
    }
  };

  const moveCategory = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length || !token) return;
    const a = categories[index];
    const b = categories[target];
    setBusyId(a.id);
    setActionError('');
    try {
      const [resA, resB] = await Promise.all([
        fetch('/api/admin/menu-categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ id: a.id, merchant_id: merchantId, sort_order: b.sort_order }),
        }),
        fetch('/api/admin/menu-categories', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ id: b.id, merchant_id: merchantId, sort_order: a.sort_order }),
        }),
      ]);
      if (!resA.ok || !resB.ok) throw new Error('Could not reorder categories');
      const next = [...categories];
      next[index] = { ...a, sort_order: b.sort_order };
      next[target] = { ...b, sort_order: a.sort_order };
      next.sort((x, y) => x.sort_order - y.sort_order);
      setCategories(next);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reorder categories');
    } finally {
      setBusyId(null);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/menu-categories?id=${id}&merchant_id=${merchantId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete category');
      setCategories((prev) => prev.filter((c) => c.id !== id));
      // Products that were in this category move to "uncategorized" on the server; mirror that locally.
      setProducts((prev) => prev.map((p) => (p.category_id === id ? { ...p, category_id: null } : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete category');
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  /* ── Products ── */

  const productsFor = (categoryId: string | null) =>
    products.filter((p) => p.category_id === categoryId).sort((a, b) => a.sort_order - b.sort_order);

  const openNewProduct = (categoryId: string | null) => {
    setDraftError('');
    setEditingDraft(EMPTY_DRAFT(categoryId));
  };

  const openEditProduct = (product: Product) => {
    setDraftError('');
    setEditingDraft({
      id: product.id,
      category_id: product.category_id,
      name: product.name,
      description: product.description || '',
      price: product.price?.toString() || '',
      discount_price: product.discount_price?.toString() || '',
      image_url: product.image_url || '',
      is_available: product.is_available,
      is_featured: product.is_featured,
      show_prices: product.show_prices,
    });
  };

  const saveDraft = async () => {
    if (!token || !editingDraft) return;
    if (!editingDraft.name.trim()) {
      setDraftError('Name is required');
      return;
    }
    if (editingDraft.price.trim() && !Number.isFinite(Number(editingDraft.price))) {
      setDraftError('Price must be a number');
      return;
    }
    if (editingDraft.discount_price.trim() && !Number.isFinite(Number(editingDraft.discount_price))) {
      setDraftError('Discount price must be a number');
      return;
    }
    setSavingDraft(true);
    setDraftError('');
    const payload = {
      merchant_id: merchantId,
      category_id: editingDraft.category_id,
      name: editingDraft.name.trim(),
      description: editingDraft.description.trim() || null,
      price: editingDraft.price.trim() ? Number(editingDraft.price) : null,
      discount_price: editingDraft.discount_price.trim() ? Number(editingDraft.discount_price) : null,
      image_url: editingDraft.image_url.trim() || null,
      is_available: editingDraft.is_available,
      is_featured: editingDraft.is_featured,
      show_prices: editingDraft.show_prices,
    };
    try {
      const res = await fetch('/api/admin/menu-products', {
        method: editingDraft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(editingDraft.id ? { id: editingDraft.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save dish');
      const saved: Product = data.product;
      setProducts((prev) => (editingDraft.id ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]));
      setEditingDraft(null);
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : 'Could not save dish');
    } finally {
      setSavingDraft(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!token) return;
    setBusyId(id);
    setActionError('');
    try {
      const res = await fetch(`/api/admin/menu-products?id=${id}&merchant_id=${merchantId}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete dish');
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete dish');
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  const moveProduct = async (categoryId: string | null, index: number, direction: -1 | 1) => {
    const list = productsFor(categoryId);
    const target = index + direction;
    if (target < 0 || target >= list.length || !token) return;
    const a = list[index];
    const b = list[target];
    setBusyId(a.id);
    setActionError('');
    try {
      const [resA, resB] = await Promise.all([
        fetch('/api/admin/menu-products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ id: a.id, merchant_id: merchantId, sort_order: b.sort_order }),
        }),
        fetch('/api/admin/menu-products', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
          body: JSON.stringify({ id: b.id, merchant_id: merchantId, sort_order: a.sort_order }),
        }),
      ]);
      if (!resA.ok || !resB.ok) throw new Error('Could not reorder dishes');
      setProducts((prev) =>
        prev.map((p) => {
          if (p.id === a.id) return { ...p, sort_order: b.sort_order };
          if (p.id === b.id) return { ...p, sort_order: a.sort_order };
          return p;
        })
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reorder dishes');
    } finally {
      setBusyId(null);
    }
  };

  const toggleAvailable = async (product: Product) => {
    if (!token) return;
    setBusyId(product.id);
    setActionError('');
    try {
      const res = await fetch('/api/admin/menu-products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: product.id, merchant_id: merchantId, is_available: !product.is_available }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update availability');
      setProducts((prev) => prev.map((p) => (p.id === product.id ? data.product : p)));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update availability');
    } finally {
      setBusyId(null);
    }
  };

  const uncategorized = productsFor(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 text-sm">{error}</p>
        <button onClick={fetchAll} className="mt-4 text-amber-400 hover:text-amber-300 text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Categories group your dishes and set the order they appear in on your public menu (e.g. Starters, Mains, Drinks).
        Add a category below, then add dishes under it.
      </p>

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Add category */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void addCategory();
            }
          }}
          placeholder="New category name (e.g. Mains, Drinks)"
          className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
        />
        <button
          onClick={addCategory}
          disabled={addingCategory || !newCategoryName.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" /> Add category
        </button>
      </div>

      {categories.length === 0 && uncategorized.length === 0 && (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-slate-500 text-sm">No menu items yet. Add a category to get started.</p>
        </div>
      )}

      {/* Categories + their products */}
      {categories.map((category, catIndex) => {
        const catProducts = productsFor(category.id);
        return (
          <div key={category.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-slate-950/50">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <GripVertical className="w-4 h-4 text-slate-600 shrink-0" />
                {renamingCategoryId === category.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveRenameCategory(category)}
                      className="flex-1 px-2 py-1 bg-slate-900 border border-amber-500/40 rounded text-sm text-white focus:outline-none"
                    />
                    <button onClick={() => saveRenameCategory(category)} className="text-emerald-400 hover:text-emerald-300">
                      <Check className="w-4 h-4" />
                    </button>
                    <button onClick={() => setRenamingCategoryId(null)} className="text-slate-500 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <h3 className="font-semibold text-white truncate">{category.name}</h3>
                )}
              </div>
              {renamingCategoryId !== category.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveCategory(catIndex, -1)}
                    disabled={catIndex === 0 || busyId === category.id}
                    className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500"
                    title="Move up"
                    aria-label={`Move ${category.name} up`}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveCategory(catIndex, 1)}
                    disabled={catIndex === categories.length - 1 || busyId === category.id}
                    className="p-1.5 text-slate-500 hover:text-white disabled:opacity-30 disabled:hover:text-slate-500"
                    title="Move down"
                    aria-label={`Move ${category.name} down`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startRenameCategory(category)}
                    className="p-1.5 text-slate-500 hover:text-amber-400"
                    title="Rename category"
                    aria-label={`Rename ${category.name}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: 'category', id: category.id, label: category.name })}
                    className="p-1.5 text-slate-500 hover:text-red-400"
                    title="Delete category"
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 space-y-2">
              {catProducts.length === 0 && <p className="text-sm text-slate-600 italic">No dishes in this category yet.</p>}
              {catProducts.map((product, prodIndex) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  index={prodIndex}
                  count={catProducts.length}
                  busy={busyId === product.id}
                  onEdit={() => openEditProduct(product)}
                  onDelete={() => setConfirmDelete({ type: 'product', id: product.id, label: product.name })}
                  onMove={(dir) => moveProduct(category.id, prodIndex, dir)}
                  onToggleAvailable={() => toggleAvailable(product)}
                />
              ))}
              <button
                onClick={() => openNewProduct(category.id)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-400 transition-colors mt-1"
              >
                <Plus className="w-3 h-3" /> Add dish to {category.name}
              </button>
            </div>
          </div>
        );
      })}

      {/* Uncategorized products — never shown on the public menu (no layout renders category_id = null) */}
      {uncategorized.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
            <EyeOff className="w-4 h-4 text-amber-400 shrink-0" />
            <h3 className="font-semibold text-amber-300">Uncategorized ({uncategorized.length})</h3>
            <span className="text-xs text-amber-400/80 ml-2">Not shown on the public menu — assign a category to publish.</span>
          </div>
          <div className="p-4 space-y-2">
            {uncategorized.map((product, prodIndex) => (
              <ProductRow
                key={product.id}
                product={product}
                index={prodIndex}
                count={uncategorized.length}
                busy={busyId === product.id}
                onEdit={() => openEditProduct(product)}
                onDelete={() => setConfirmDelete({ type: 'product', id: product.id, label: product.name })}
                onMove={(dir) => moveProduct(null, prodIndex, dir)}
                onToggleAvailable={() => toggleAvailable(product)}
              />
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => openNewProduct(null)}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" /> Add dish
      </button>

      {/* Preview toggle */}
      <div className="pt-4 border-t border-slate-800">
        <button
          onClick={() => setShowPreview((v) => !v)}
          className="text-sm font-medium text-amber-400 hover:text-amber-300"
        >
          {showPreview ? 'Hide' : 'Show'} public menu preview
        </button>
        {showPreview && (
          <MenuPreview merchantName={merchantName} categories={categories} products={products} />
        )}
      </div>

      {/* Product edit panel */}
      {editingDraft && (
        <ProductEditPanel
          draft={editingDraft}
          categories={categories}
          saving={savingDraft}
          error={draftError}
          onChange={setEditingDraft}
          onCancel={() => setEditingDraft(null)}
          onSave={saveDraft}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-white">
                Delete {confirmDelete.type === 'category' ? 'category' : 'dish'}?
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              {confirmDelete.type === 'category'
                ? `"${confirmDelete.label}" will be removed. Dishes in it will move to Uncategorized, not be deleted.`
                : `"${confirmDelete.label}" will be permanently deleted.`}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmDelete.type === 'category' ? deleteCategory(confirmDelete.id) : deleteProduct(confirmDelete.id)
                }
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  index,
  count,
  busy,
  onEdit,
  onDelete,
  onMove,
  onToggleAvailable,
}: {
  product: Product;
  index: number;
  count: number;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggleAvailable: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
      <div className="flex flex-col shrink-0">
        <button
          onClick={() => onMove(-1)}
          disabled={index === 0 || busy}
          className="p-0.5 text-slate-600 hover:text-white disabled:opacity-30"
          title="Move up"
          aria-label={`Move ${product.name} up`}
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={index === count - 1 || busy}
          className="p-0.5 text-slate-600 hover:text-white disabled:opacity-30"
          title="Move down"
          aria-label={`Move ${product.name} down`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">{product.name}</p>
          {product.is_featured && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
              Featured
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {product.discount_price ? (
            <>
              <span className="line-through mr-1">RM {product.price}</span>
              RM {product.discount_price}
            </>
          ) : product.price !== null ? (
            `RM ${product.price}`
          ) : (
            'No price set'
          )}
        </p>
      </div>
      <button
        onClick={onToggleAvailable}
        disabled={busy}
        className={`shrink-0 text-xs px-2 py-1 rounded-full border font-medium transition-colors ${
          product.is_available
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}
        title={product.is_available ? 'Shown as in stock on your public menu — click to mark sold out' : 'Shown as sold out on your public menu — click to mark available'}
      >
        {product.is_available ? 'Available' : 'Unavailable'}
      </button>
      <button onClick={onEdit} className="shrink-0 p-1.5 text-slate-500 hover:text-amber-400" title="Edit dish" aria-label={`Edit ${product.name}`}>
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button onClick={onDelete} className="shrink-0 p-1.5 text-slate-500 hover:text-red-400" title="Delete dish" aria-label={`Delete ${product.name}`}>
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ProductEditPanel({
  draft,
  categories,
  saving,
  error,
  onChange,
  onCancel,
  onSave,
}: {
  draft: ProductDraft;
  categories: Category[];
  saving: boolean;
  error: string;
  onChange: (draft: ProductDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const update = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-lg w-full space-y-4 my-8">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-lg">{draft.id ? 'Edit dish' : 'New dish'}</h3>
          <button onClick={onCancel} className="text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Price (RM)</label>
            <input
              type="text"
              inputMode="decimal"
              value={draft.price}
              onChange={(e) => update('price', e.target.value)}
              placeholder="e.g. 12.90"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Discount price (RM)</label>
            <input
              type="text"
              inputMode="decimal"
              value={draft.discount_price}
              onChange={(e) => update('discount_price', e.target.value)}
              placeholder="Optional"
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">If set, shows as a discount with the regular price struck through. Must not be higher than the price above.</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
          <select
            value={draft.category_id || ''}
            onChange={(e) => update('category_id', e.target.value || null)}
            className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:border-amber-500 focus:outline-none"
          >
            <option value="">Uncategorized (not shown publicly)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <ImageUpload kind="menu" value={draft.image_url} onChange={(v) => update('image_url', v)} label="Photo" help="JPG, PNG, or WebP; compressed for menu display." />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">
              Available
              <span className="block text-xs font-normal text-slate-500">Uncheck to mark sold out — the dish stays on your menu, just shown as unavailable. It won&apos;t be deleted.</span>
            </span>
            <input
              type="checkbox"
              checked={draft.is_available}
              onChange={(e) => update('is_available', e.target.checked)}
              className="w-4 h-4 accent-amber-500 shrink-0 ml-3"
            />
          </label>
          <label className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Featured (shown in seasonal/highlight section)</span>
            <input
              type="checkbox"
              checked={draft.is_featured}
              onChange={(e) => update('is_featured', e.target.checked)}
              className="w-4 h-4 accent-amber-500"
            />
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2.5 text-slate-400 hover:text-white text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {draft.id ? 'Save changes' : 'Add dish'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Read-only preview mirroring the classic-layout public menu markup (grouped by category,
 * image + name + price/discount + description + unavailable badge). The 4 other layouts style
 * this section differently, so this is a representative preview of the content and grouping,
 * not a pixel-accurate render of every theme.
 */
function MenuPreview({
  merchantName,
  categories,
  products,
}: {
  merchantName: string;
  categories: Category[];
  products: Product[];
}) {
  return (
    <div className="mt-4 p-6 bg-amber-50 rounded-xl border border-amber-200">
      <p className="text-xs text-amber-700/70 mb-4">Preview — approximates the Classic layout. Other layouts style this differently.</p>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">{merchantName} — Menu</h2>
      <div className="space-y-8">
        {categories.map((cat) => {
          const catProducts = products.filter((p) => p.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
          if (catProducts.length === 0) return null;
          return (
            <div key={cat.id}>
              <h3 className="text-lg font-semibold text-amber-800 mb-4 pb-2 border-b border-amber-200">{cat.name}</h3>
              <div className="space-y-4">
                {catProducts.map((product) => (
                  <div key={product.id} className="flex gap-4 p-4 bg-white rounded-xl border border-amber-100">
                    {product.image_url && (
                      <img src={product.image_url} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-amber-900">{product.name}</h4>
                        <span className="font-bold text-amber-700 whitespace-nowrap">
                          {product.discount_price ? (
                            <>
                              <span className="line-through opacity-50 text-sm mr-1">RM {product.price}</span>
                              RM {product.discount_price}
                            </>
                          ) : product.price !== null ? (
                            `RM ${product.price}`
                          ) : (
                            ''
                          )}
                        </span>
                      </div>
                      {product.description && <p className="text-sm text-amber-800/60 mt-1">{product.description}</p>}
                      {!product.is_available && (
                        <span className="inline-block mt-1 text-xs font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded">
                          Currently Unavailable
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {categories.every((cat) => products.filter((p) => p.category_id === cat.id).length === 0) && (
          <p className="text-sm text-amber-700/70">No categorized dishes yet — nothing will show on the public menu.</p>
        )}
      </div>
    </div>
  );
}
