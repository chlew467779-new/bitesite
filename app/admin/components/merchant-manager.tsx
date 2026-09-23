/* bitesite/app/admin/components/merchant-manager.tsx */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';
import { Search, Plus, Eye, EyeOff, Store, Loader2, ExternalLink, Pencil, Circle, UserPlus } from 'lucide-react';
import MerchantForm from './merchant-form';
import MerchantProfileChangeRequests from './merchant-profile-change-requests';
import { describeLayoutValueForLog, getLayoutMeta, isLayoutKey, isPersistableLayout } from '@/lib/layout-registry.mjs';

/** A stored value the public page renders as intended: a production-ready key, or null, which is
 *  the ordinary "no layout chosen yet" default and legitimately means Classic. An empty string or
 *  any other value is bad data and gets flagged in the UI. */
const isPublishableLayoutValue = (layout?: string | null) =>
  layout === null || layout === undefined ? true : isPersistableLayout(layout);

interface Merchant {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  description?: string;
  layout?: string;
  logo_image?: string;
  cover_image?: string;
  is_published: boolean;
  status?: string;
  platform_status?: string;
  business_status?: string;
  created_at: string;
  updated_at: string;
  product_count: number;
  view_count: number;
  cuisine_type?: string;
  area?: string;
  tags?: string[] | null;
  address?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  latitude?: number | null;
  longitude?: number | null;
  operating_hours?: Record<string, string> | null;
  features?: Record<string, boolean> | null;
  menu_pdf_url?: string;
}

/*
 * Primary platform-status badge for a Merchant Manager card. This reads `platform_status`
 * directly so PENDING_REVIEW / SUSPENDED / ARCHIVED are visually distinct from DRAFT instead
 * of all collapsing into a generic "Draft" pill. `is_published` is the actual public
 * visibility gate (unchanged by this function) — PUBLISHED + is_published=false is a real,
 * possible state (the two fields can disagree) and must never be labeled "Live".
 * Active/Inactive stays a separate badge rendered alongside this one; do not merge them.
 */
function getPlatformStatusBadge(merchant: Merchant) {
  const platformStatus = merchant.platform_status || (merchant.is_published ? 'PUBLISHED' : 'DRAFT');

  if (platformStatus === 'PUBLISHED' && merchant.is_published) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/20">
        <Eye className="w-3 h-3" /> Live
      </span>
    );
  }
  if (platformStatus === 'PUBLISHED' && !merchant.is_published) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-1 bg-violet-500/10 text-violet-400 text-xs rounded-full border border-violet-500/20"
        title="Platform status is Published, but Published is off — this merchant is not publicly visible."
      >
        <EyeOff className="w-3 h-3" /> Published / hidden
      </span>
    );
  }
  if (platformStatus === 'PENDING_REVIEW') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-sky-500/10 text-sky-400 text-xs rounded-full border border-sky-500/20">
        <EyeOff className="w-3 h-3" /> Pending review
      </span>
    );
  }
  if (platformStatus === 'SUSPENDED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">
        <EyeOff className="w-3 h-3" /> Suspended
      </span>
    );
  }
  if (platformStatus === 'ARCHIVED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-600/20 text-slate-400 text-xs rounded-full border border-slate-500/30">
        <EyeOff className="w-3 h-3" /> Archived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-full border border-amber-500/20">
      <EyeOff className="w-3 h-3" /> Draft
    </span>
  );
}

export default function MerchantManager() {
  const { token } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState<Merchant | null>(null);
  const [editLoadWarning, setEditLoadWarning] = useState('');
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [linkingMerchant, setLinkingMerchant] = useState<Merchant | null>(null);
  const [membershipEmail, setMembershipEmail] = useState('');
  const [linking, setLinking] = useState(false);

  const fetchMerchants = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/merchants-crud', {
        headers: { 'x-admin-token': token || '' },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch merchants');
      }
      const data = await res.json();
      setMerchants(data.merchants || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchMerchants();
  }, [fetchMerchants, refreshKey]);

  const handleNew = () => {
    setEditingMerchant(null);
    setEditLoadWarning('');
    setShowForm(true);
  };

  /*
   * Edit must never trust the list's local `merchants` array as-is: that array can be
   * momentarily stale (e.g. right after a Create/Update, before this component's own
   * list state has settled), and MerchantForm only initializes its Status/Platform
   * status/Published fields from whatever `merchant` object it is handed. So before
   * opening the form we re-fetch the merchant list from the server and hand MerchantForm
   * the freshly-fetched record for this id. If that refresh fails (or the record has
   * disappeared), we fall back to the originally-clicked record rather than opening a
   * blank form, and surface a visible warning so the operator knows the data may be stale.
   */
  const handleEdit = async (merchant: Merchant) => {
    setEditLoadWarning('');
    setRefreshingId(merchant.id);
    try {
      const res = await fetch('/api/admin/merchants-crud', {
        headers: { 'x-admin-token': token || '' },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to refresh merchant');
      }
      const data = await res.json();
      const freshList: Merchant[] = data.merchants || [];
      setMerchants(freshList);
      const fresh = freshList.find((m) => m.id === merchant.id);
      if (fresh) {
        setEditingMerchant(fresh);
      } else {
        setEditingMerchant(merchant);
        setEditLoadWarning('Could not find this merchant in the latest server data — showing the last loaded values. Reload before changing status fields.');
      }
    } catch (err) {
      setEditingMerchant(merchant);
      setEditLoadWarning(
        `Could not refresh this merchant from the server (${err instanceof Error ? err.message : 'unknown error'}) — showing the last loaded values. Reload before changing status fields.`
      );
    } finally {
      setRefreshingId(null);
      setShowForm(true);
    }
  };

  const handleBack = () => {
    setShowForm(false);
    setEditingMerchant(null);
    setEditLoadWarning('');
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingMerchant(null);
    setEditLoadWarning('');
    setRefreshKey((k) => k + 1);
  };

  const linkUser = async () => {
    if (!token || !linkingMerchant || !membershipEmail.trim()) return;
    setLinking(true);
    setError('');
    try {
      const res = await fetch('/api/admin/merchant-memberships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ merchant_id: linkingMerchant.id, user_email: membershipEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not link user');
      setLinkingMerchant(null);
      setMembershipEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link user');
    } finally {
      setLinking(false);
    }
  };

  const filteredMerchants = merchants.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.slug.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'published'
        ? m.is_published
        : !m.is_published;
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? m.status === 'active'
        : m.status === 'inactive';
    return matchesSearch && matchesFilter && matchesStatus;
  });

  /** Labels come from the layout registry. A stored value that cannot be published is called out
   *  here, because the public page silently renders Classic for it. */
  const getLayoutLabel = (layout?: string | null) => {
    if (layout === null || layout === undefined) return 'Classic layout';
    if (isPersistableLayout(layout)) return `${getLayoutMeta(layout).displayName} layout`;
    if (isLayoutKey(layout)) return `${getLayoutMeta(layout).displayName} layout — not public-ready, renders as Classic`;
    return 'Unknown layout — renders as Classic';
  };

  if (showForm) {
    return (
      <MerchantForm
        merchant={editingMerchant}
        onBack={handleBack}
        onSaved={handleSaved}
        loadWarning={editLoadWarning}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchMerchants}
          className="mt-4 text-amber-400 hover:text-amber-300 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
      <div className="space-y-6">
        <MerchantProfileChangeRequests />
      {linkingMerchant && (
        <div className="rounded-xl border border-amber-500/40 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Link merchant user</h2><p className="text-xs text-slate-400">{linkingMerchant.name} — the user must have signed in with a magic link first.</p></div><button onClick={() => setLinkingMerchant(null)} className="text-slate-400 hover:text-white text-sm">Cancel</button></div>
          <div className="flex flex-col sm:flex-row gap-2"><input type="email" value={membershipEmail} onChange={(event) => setMembershipEmail(event.target.value)} placeholder="owner@example.com" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><button onClick={linkUser} disabled={linking || !membershipEmail.trim()} className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-slate-950 disabled:opacity-50">{linking ? 'Linking…' : 'Link user'}</button></div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Merchant Manager</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your restaurant partners — {merchants.length} total
          </p>
        </div>
        <button
          onClick={handleNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Merchant
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or slug..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'published', 'draft'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-1">Status:</span>
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filteredMerchants.length === 0 ? (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
          <Store className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">
            {search || filter !== 'all' || statusFilter !== 'all'
              ? 'No merchants match your filters'
              : 'No merchants yet. Click "New Merchant" to add one.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMerchants.map((merchant) => (
            <div
              key={merchant.id}
              onClick={() => handleEdit(merchant)}
              className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-colors cursor-pointer group"
            >
              {/* Cover Image */}
              <div className="relative h-32 bg-slate-800 overflow-hidden">
                {merchant.cover_image ? (
                  <img
                    src={merchant.cover_image}
                    alt={merchant.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Store className="w-8 h-8 text-slate-600" />
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  {getPlatformStatusBadge(merchant)}
                  {merchant.business_status === 'TEMPORARILY_CLOSED' || merchant.business_status === 'PERMANENTLY_CLOSED' || merchant.status === 'inactive' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">
                      <Circle className="w-2 h-2 fill-current" /> Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded-full border border-slate-600/30">
                      <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" /> Active
                    </span>
                  )}
                </div>
                <div
                  className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                    refreshingId === merchant.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {refreshingId === merchant.id ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur text-white text-xs rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin" /> Loading latest data…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur text-white text-xs rounded-full">
                      <Pencil className="w-3 h-3" /> Click to edit
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {merchant.logo_image ? (
                    <img
                      src={merchant.logo_image}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover border border-slate-700 bg-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                      <Store className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {merchant.name}
                    </h3>
                    <p className="text-slate-500 text-xs truncate">
                      /store/{merchant.slug}
                    </p>
                  </div>
                </div>

                {(merchant.tagline || merchant.description) && (
                  <p className="mt-3 text-slate-400 text-sm line-clamp-2">
                    {merchant.tagline || merchant.description}
                  </p>
                )}

                <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    {merchant.view_count.toLocaleString()} views
                  </span>
                  <span className="flex items-center gap-1">
                    <Store className="w-3.5 h-3.5" />
                    {merchant.product_count} dishes
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span
                    className={isPublishableLayoutValue(merchant.layout) ? 'text-xs text-slate-500' : 'text-xs text-amber-400'}
                    title={isPublishableLayoutValue(merchant.layout) ? undefined : `Stored value: ${describeLayoutValueForLog(merchant.layout).value ?? 'not a string'}`}
                  >
                    {getLayoutLabel(merchant.layout)}
                  </span>
                  <div className="flex items-center gap-3"><button onClick={(event) => { event.stopPropagation(); setLinkingMerchant(merchant); }} className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"><UserPlus className="w-3 h-3" /> Link user</button><a
                    href={`/store/${merchant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
