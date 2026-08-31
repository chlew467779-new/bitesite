/* bitesite/app/admin/components/merchant-manager.tsx */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { Search, Plus, Eye, EyeOff, Store, Loader2, ExternalLink, Pencil, Circle } from 'lucide-react';
import MerchantForm from './merchant-form';

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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchMerchants();
  }, [refreshKey]);

  const fetchMerchants = async () => {
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
  };

  const handleNew = () => {
    setEditingMerchant(null);
    setShowForm(true);
  };

  const handleEdit = (merchant: Merchant) => {
    setEditingMerchant(merchant);
    setShowForm(true);
  };

  const handleBack = () => {
    setShowForm(false);
    setEditingMerchant(null);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingMerchant(null);
    setRefreshKey((k) => k + 1);
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

  const getLayoutLabel = (layout?: string) => {
    const labels: Record<string, string> = {
      classic: 'Classic',
      elegant: 'Elegant',
      minimal: 'Minimal',
      modern: 'Modern',
      rustic: 'Rustic',
    };
    return labels[layout || ''] || layout || 'Classic';
  };

  if (showForm) {
    return (
      <MerchantForm
        merchant={editingMerchant}
        onBack={handleBack}
        onSaved={handleSaved}
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
                  {merchant.is_published ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full border border-emerald-500/20">
                      <Eye className="w-3 h-3" /> Live
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-full border border-amber-500/20">
                      <EyeOff className="w-3 h-3" /> Draft
                    </span>
                  )}
                  {merchant.status === 'inactive' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-full border border-red-500/20">
                      <Circle className="w-2 h-2 fill-current" /> Inactive
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-400 text-xs rounded-full border border-slate-600/30">
                      <Circle className="w-2 h-2 fill-emerald-400 text-emerald-400" /> Active
                    </span>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur text-white text-xs rounded-full">
                    <Pencil className="w-3 h-3" /> Click to edit
                  </span>
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
                  <span className="text-xs text-slate-500">
                    {getLayoutLabel(merchant.layout)} layout
                  </span>
                  <a
                    href={`/store/${merchant.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
