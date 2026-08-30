/* bitesite/app/admin/components/stories-manager.tsx */

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './auth-context';
import { 
  Search, 
  Plus, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff,
  Loader2,
  AlertCircle,
  Clock,
  Calendar
} from 'lucide-react';
import type { Article } from '@/types';

interface StoriesManagerProps {
  onEdit: (slug: string) => void;
  onNew: () => void;
}

export default function StoriesManager({ onEdit, onNew }: StoriesManagerProps) {
  const { token } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchArticles();
  }, [token]);

  const fetchArticles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/stories', {
        headers: { 'x-admin-token': token },
      });
      const data = await res.json();
      if (res.ok) {
        setArticles(data.articles || []);
      } else {
        setError(data.error || 'Failed to load');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Are you sure? This cannot be undone.')) return;
    setDeleting(slug);
    try {
      const res = await fetch(`/api/admin/stories?slug=${slug}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token || '' },
      });
      if (res.ok) {
        setArticles(prev => prev.filter(a => a.slug !== slug));
      } else {
        const data = await res.json();
        alert(data.error || 'Delete failed');
      }
    } catch {
      alert('Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const filtered = articles.filter(a => {
    const matchesSearch = 
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase()) ||
      (a.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'published' ? a.published :
      !a.published;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Stories</h1>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Story
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stories..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80">
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Story</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Category</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Created
                  </span>
                </th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Updated
                  </span>
                </th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No stories found
                  </td>
                </tr>
              ) : (
                filtered.map((article) => (
                  <tr 
                    key={article.id} 
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{article.title}</div>
                      <div className="text-xs text-slate-500">/{article.slug}</div>
                      {article.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {article.tags.map(tag => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                        {article.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {article.published ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Eye className="w-3 h-3" /> Published
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <EyeOff className="w-3 h-3" /> Draft
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(article.created_at).toLocaleDateString('en-MY', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {new Date(article.updated_at).toLocaleDateString('en-MY', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/stories/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => onEdit(article.slug)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(article.slug)}
                          disabled={deleting === article.slug}
                          className="p-1.5 rounded hover:bg-red-950 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === article.slug ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
