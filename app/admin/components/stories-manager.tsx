/* bitesite/app/admin/components/stories-manager.tsx */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-context';
import { 
  Plus, 
  Search, 
  Edit3, 
  Eye, 
  Trash2, 
  BookOpen, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Filter,
  ExternalLink
} from 'lucide-react';

interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string;
  tags: string[] | null;
  published: boolean;
  view_count: number;
  background_style: string;
  created_at: string;
  updated_at: string;
}

interface StoriesManagerProps {
  onEdit: (slug: string) => void;
  onNew: () => void;
}

export default function StoriesManager({ onEdit, onNew }: StoriesManagerProps) {
  const { token } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [filtered, setFiltered] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchArticles();
  }, []);

  useEffect(() => {
    let result = [...articles];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => 
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(a => 
        statusFilter === 'published' ? a.published : !a.published
      );
    }
    
    setFiltered(result);
  }, [articles, searchQuery, statusFilter]);

  const fetchArticles = async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/stories', {
        headers: { 'x-admin-token': token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setArticles(data.articles || []);
      setFiltered(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/stories?slug=${slug}`, {
        method: 'DELETE',
        headers: { 'x-admin-token': token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setArticles(prev => prev.filter(a => a.slug !== slug));
      setDeleteConfirm(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (published: boolean) => {
    if (published) {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Published
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-400">
        <XCircle className="w-3 h-3" />
        Draft
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Stories Editor</h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage articles, create new stories, and edit existing content.
          </p>
        </div>
        <button
          onClick={onNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium rounded-lg transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          New Story
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by title, category, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'published' | 'draft')}
            className="px-3 py-2.5 rounded-lg border border-slate-700 bg-slate-950 text-sm text-slate-200 focus:border-amber-500 focus:outline-none transition-colors"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-4 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left">
                <th className="px-6 py-3 text-slate-500 font-medium">Title</th>
                <th className="px-6 py-3 text-slate-500 font-medium">Category</th>
                <th className="px-6 py-3 text-slate-500 font-medium">Status</th>
                <th className="px-6 py-3 text-slate-500 font-medium text-right">Views</th>
                <th className="px-6 py-3 text-slate-500 font-medium">Date</th>
                <th className="px-6 py-3 text-slate-500 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    {articles.length === 0 ? (
                      <div className="space-y-2">
                        <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
                        <p>No stories yet.</p>
                        <button
                          onClick={onNew}
                          className="text-amber-400 hover:text-amber-300 text-sm"
                        >
                          Create your first story →
                        </button>
                      </div>
                    ) : (
                      <p>No stories match your filters.</p>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((article) => (
                  <tr
                    key={article.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-200">{article.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">/{article.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400">{article.category}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(article.published)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-mono">
                      {article.view_count.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {formatDate(article.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/stories/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                          title="Preview"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => onEdit(article.slug)}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(article.slug)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-white mb-2">Delete Story?</h3>
            <p className="text-sm text-slate-400 mb-6">
              This will permanently delete the story. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
