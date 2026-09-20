/* bitesite/app/admin/components/story-editor.tsx */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from './auth-context';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Bold,
  Italic,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  Smile,
  Eye,
  EyeOff,
  Send,
  RotateCcw
} from 'lucide-react';
import { StoryHero } from '@/components/sections/story-hero';
import { StoryContent } from '@/components/sections/story-content';
import type { Article } from '@/types';

type EditorialStatus = NonNullable<Article['editorial_status']>;

interface MerchantOption {
  slug: string;
  name: string;
}

interface StoryEditorProps {
  slug?: string | null;
  onBack: () => void;
  onSaved: () => void;
}

const bgThemes = [
  { value: 'default', label: 'Default', bg: '#FAFBF7', text: '#2C3E2D' },
  { value: 'warm', label: 'Warm', bg: '#FDF8F3', text: '#4A3728' },
  { value: 'cool', label: 'Cool', bg: '#F5F7FA', text: '#2D3748' },
  { value: 'dark', label: 'Dark', bg: '#1A1A1A', text: '#E8E8E8' },
  { value: 'nature', label: 'Nature', bg: '#F4F7F0', text: '#2C3E2D' },
  { value: 'minimal', label: 'Minimal', bg: '#FFFFFF', text: '#1A1A1A' },
];

const emojis = ['🍕','🍔','🍟','🌭','🍿','🧂','🥓','🥚','🥞','🧇','🥐','🥨','🥯','🥖','🧀','🥗','🥙','🥪','🌮','🌯','🫔','🥫','🍖','🍗','🥩','🍠','🥟','🥠','🥡','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🍡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','☕','🍵','🧃','🥤','🍶','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🍽️','🍴','🥄','🔪','🧋','🧉','🧊','🥢','🥡','🍽️','🌶️','🧄','🧅','🍄','🥦','🥬','🥒','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🫘','🌰','🥜','🫚','🫛','🍞','🥐','🥖','🫓','🥨','🥯','🥞','🧇','🧀','🍖','🍗','🥩','🍠','🥓','🍔','🍟','🍕','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥚','🍳','🥘','🍲','🫕','🥣','🥗','🍿','🧈','🧂','🥫','🍱','🍘','🍙','🍚','🍛','🍜','🍝','🍠','🍢','🍣','🍤','🍥','🍡','🍦','🍧','🍨','🍩','🍪','🎂','🍰','🧁','🥧','🍫','🍬','🍭','🍮','🍯','☕','🍵','🧃','🥤','🍶','🍷','🍸','🍹','🍺','🍻','🥂','🥃','🫗','🍽️','🍴','🥄','🔪','🧋','🧉','🧊','🥢','🥡'];

function getDraftKey(slug: string | null | undefined) {
  return `bitesite_story_draft_${slug || 'new'}`;
}

function countWords(text: string) {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return chineseChars + englishWords;
}

export default function StoryEditor({ slug, onBack, onSaved }: StoryEditorProps) {
  const { token } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [draftData, setDraftData] = useState<Record<string, unknown> | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image: '',
    category: '',
    tags: '',
    merchant_slug: '',
    author: 'BiteSite Team',
    background_style: 'default',
    published: false,
    editorial_status: 'draft' as EditorialStatus,
    rights_declared: false,
    review_notes: '',
  });

  // Load categories from existing articles
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/admin/stories', {
          headers: { 'x-admin-token': token || '' },
        });
        if (res.ok) {
          const data = await res.json();
          const cats = Array.from(new Set((data.articles || []).map((a: Article) => a.category))).filter(Boolean) as string[];
          setCategories(cats.sort());
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    if (token) fetchCategories();
  }, [token]);

  // Load article, merchants, check draft
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/merchants-list', {
          headers: { 'x-admin-token': token || '' },
        });
        if (res.ok) {
          const data = await res.json();
          setMerchants(data.merchants || []);
        }
      } catch (err) {
        console.error('Failed to load merchants:', err);
      }

      const draftKey = getDraftKey(slug);
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          if (parsed.form && parsed.timestamp) {
            setDraftData(parsed);
            setShowDraftRestore(true);
          }
        } catch {
          localStorage.removeItem(draftKey);
        }
      }

      if (slug) {
        try {
          const res = await fetch(`/api/admin/stories?slug=${slug}`, {
            headers: { 'x-admin-token': token || '' },
          });
          const data = await res.json();
          if (data.article) {
            const a = data.article;
            setForm({
              title: a.title || '',
              slug: a.slug || '',
              excerpt: a.excerpt || '',
              content: a.content || '',
              cover_image: a.cover_image || '',
              category: a.category || '',
              tags: (a.tags || []).join(', '),
              merchant_slug: a.merchant_slug || '',
              author: a.author || 'BiteSite Team',
              background_style: a.background_style || 'default',
              published: a.published || false,
              editorial_status: a.editorial_status || (a.published ? 'published' : 'draft'),
              rights_declared: a.rights_declared === true,
              review_notes: a.review_notes || '',
            });
          }
        } catch (err) {
          setError('Failed to load article');
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug, token]);

  // Auto-save every 30s
  useEffect(() => {
    if (loading) return;
    if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setInterval(() => {
      if (form.title || form.content) {
        localStorage.setItem(getDraftKey(slug), JSON.stringify({
          form,
          timestamp: new Date().toISOString(),
        }));
        setLastSavedAt(new Date().toLocaleTimeString());
      }
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [form, slug, loading]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
    setDirty(true);
  };

  // Auto-generate slug (consistent with backend, no toLowerCase)
  useEffect(() => {
    if (!slug && form.title && !form.slug) {
      const base = form.title
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)
        .replace(/^-|-$/g, '');
      if (base) setForm(prev => ({ ...prev, slug: base }));
    }
  }, [form.title, slug, form.slug]);

  const restoreDraft = () => {
    if (draftData?.form) {
      setForm(draftData.form as typeof form);
      setShowDraftRestore(false);
      setDirty(true);
    }
  };

  const discardDraft = () => {
    localStorage.removeItem(getDraftKey(slug));
    setShowDraftRestore(false);
    setDraftData(null);
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = form.content;
    const selected = text.substring(start, end);
    const replacement = before + selected + after;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setForm(prev => ({ ...prev, content: newContent }));
    setDirty(true);
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + before.length + selected.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    insertMarkdown(emoji);
    setShowEmoji(false);
  };

  const insertLink = () => {
    const url = prompt('Enter URL:', 'https://');
    if (url) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = form.content.substring(start, end) || 'link text';
      insertMarkdown(`[${selected}](${url})`, '');
    }
  };

  const insertImage = () => {
    const url = prompt('Enter image URL:', 'https://');
    if (url) {
      const alt = prompt('Enter image description:', '');
      insertMarkdown(`![${alt || 'image'}](${url})`, '');
    }
  };

  const validateBeforeSave = (requestedStatus: EditorialStatus): string | null => {
    if (!form.title.trim()) return 'Title is required.';
    if (!form.content.trim()) return 'Story content is required.';
    if (!form.category.trim()) return 'Category is required.';
    if (!form.slug.trim()) return 'Slug is required.';
    if (form.slug.length > 100) return 'Slug must be 100 characters or fewer.';
    if (/[\\/\s]/.test(form.slug)) return 'Slug cannot contain spaces or slashes.';
    if (form.cover_image.trim()) {
      try {
        const imageUrl = new URL(form.cover_image.trim());
        if (imageUrl.protocol !== 'http:' && imageUrl.protocol !== 'https:') {
          return 'Cover image must use an http:// or https:// URL.';
        }
      } catch {
        return 'Cover image must be a valid URL.';
      }
    }
    if (requestedStatus === 'pending_review' && !form.rights_declared) {
      return 'Declare image and content rights before submitting for review.';
    }
    return null;
  };

  const handleSave = async (publish: boolean, requestedStatus?: EditorialStatus) => {
    if (!token) return;
    const editorialStatus = requestedStatus || (publish ? 'published' : 'draft');
    const validationError = validateBeforeSave(editorialStatus);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const payload = {
        ...form,
        published: publish,
        editorial_status: editorialStatus,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        merchant_slug: form.merchant_slug || null,
      };

      const isNew = !slug;
      const res = await fetch('/api/admin/stories', {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token,
        },
        body: JSON.stringify(isNew ? payload : { ...payload, slug: form.slug }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      localStorage.removeItem(getDraftKey(slug));
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const generateAiDraft = async () => {
    if (!token || !form.title.trim()) {
      setError('Add a title before generating an AI draft.');
      return;
    }
    setGeneratingDraft(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ title: form.title, facts: { excerpt: form.excerpt, content: form.content, merchant_slug: form.merchant_slug } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI not available, please edit manually');
      setForm((current) => ({ ...current, title: data.draft.title, excerpt: data.draft.excerpt, content: data.draft.content }));
      setAiGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI not available, please edit manually');
    } finally {
      setGeneratingDraft(false);
    }
  };
  const handleBack = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    onBack();
  };

  const previewArticle: Article = {
    id: 'preview',
    slug: form.slug || 'preview',
    title: form.title || 'Untitled Story',
    excerpt: form.excerpt || null,
    content: form.content,
    cover_image: form.cover_image || null,
    category: form.category || 'Uncategorized',
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    merchant_slug: form.merchant_slug || null,
    author: form.author,
    published: form.published,
    view_count: 0,
    background_style: form.background_style,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const theme = bgThemes.find(t => t.value === form.background_style) || bgThemes[0];
  const wordCount = countWords(form.content);
  const copyChecks = [
    {
      label: 'Title is specific',
      ok: form.title.trim().length >= 12 && form.title.trim().length <= 80,
      hint: 'Aim for 12–80 characters.',
    },
    {
      label: 'Excerpt is useful',
      ok: form.excerpt.trim().length >= 40 && form.excerpt.trim().length <= 220,
      hint: 'Add a 40–220 character summary for cards and SEO.',
    },
    {
      label: 'Story has enough detail',
      ok: wordCount >= 80,
      hint: 'Aim for at least 80 words so readers get useful context.',
    },
    {
      label: 'Cover image is ready',
      ok: Boolean(form.cover_image.trim()),
      hint: 'A cover image improves Story discovery and sharing.',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 shrink-0">
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <div className="flex items-center gap-3">
          {lastSavedAt && (
            <span className="text-xs text-slate-600">
              Auto-saved at {lastSavedAt}
            </span>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
          )}
          <button onClick={generateAiDraft} disabled={generatingDraft || saving} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700/60 px-3 py-2 text-sm text-violet-300 hover:bg-violet-950/40 disabled:opacity-50">
            {generatingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : null}{generatingDraft ? 'Generating…' : 'Generate AI Draft'}
          </button>
          <button
            onClick={() => handleSave(false, 'draft')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            {saving && !form.published ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true, 'published')}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium transition-colors disabled:opacity-50"
          >
            {saving && form.published ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Send className="w-3.5 h-3.5 inline mr-1" />}
            {form.published ? 'Update' : 'Publish'}
          </button>
          <button
            onClick={() => handleSave(false, 'pending_review')}
            disabled={saving || !form.rights_declared}
            className="px-4 py-2 rounded-lg text-sm border border-sky-700 text-sky-300 hover:text-sky-200 hover:border-sky-500 transition-colors disabled:opacity-50"
            title={!form.rights_declared ? 'Declare rights below before submitting' : 'Submit this Story for editorial review'}
          >
            {saving && form.editorial_status === 'pending_review' ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Send className="w-3.5 h-3.5 inline mr-1" />}
            Submit for Review
          </button>
        </div>
      </div>

      {/* Draft Restore Banner */}
      {showDraftRestore && draftData && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-3 text-amber-400 text-sm flex items-center justify-between gap-2 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Found unsaved draft from {new Date(draftData.timestamp as string).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={restoreDraft} className="px-3 py-1 rounded text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors">Restore</button>
            <button onClick={discardDraft} className="px-3 py-1 rounded text-xs hover:bg-slate-800 text-slate-400 transition-colors">Discard</button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm flex items-center gap-2 mb-4 shrink-0">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {aiGenerated && (
        <div className="rounded-xl border border-violet-700/50 bg-violet-950/30 p-3 text-sm text-violet-200 mb-4 shrink-0">AI Generated — requires editorial review before publishing.</div>
      )}

      {/* Lightweight editorial quality guardrails. These keep AI-assisted or manually written copy reviewable. */}
      <div className="mb-4 shrink-0 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Copy quality check</h2>
            <p className="text-xs text-slate-500">Helpful guidance only — editors still approve every Story.</p>
          </div>
          <span className="text-xs text-slate-500">{wordCount} words</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {copyChecks.map((check) => (
            <div key={check.label} className="flex items-start gap-2 rounded-lg bg-slate-950/60 px-2.5 py-2">
              {check.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              )}
              <div>
                <p className={`text-xs font-medium ${check.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{check.label}</p>
                {!check.ok && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{check.hint}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        {/* Left: Editor */}
        <div className="overflow-y-auto pr-2 space-y-4 pb-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Story title"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => updateField('slug', e.target.value)}
              placeholder="url-friendly-name"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">Auto-generated from title. Supports Chinese characters.</p>
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Excerpt</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => updateField('excerpt', e.target.value)}
              placeholder="Short summary for list page and SEO..."
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Cover Image with Preview */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cover Image URL</label>
            <input
              type="text"
              value={form.cover_image}
              onChange={(e) => updateField('cover_image', e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
            {form.cover_image && (
              <div className="mt-2">
                <img
                  src={form.cover_image}
                  alt="Cover preview"
                  className="w-full max-h-40 object-cover rounded-lg border border-slate-800"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    const next = (e.target as HTMLImageElement).nextElementSibling;
                    if (next) next.classList.remove('hidden');
                  }}
                />
                <p className="hidden text-xs text-red-400 mt-1">Failed to load image. Check the URL.</p>
              </div>
            )}
          </div>

          {/* Category (with datalist) & Author */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="e.g. Food, Cafe, Review"
                list="category-options"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
              <datalist id="category-options">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              <p className="text-xs text-slate-500 mt-1">Type or select existing</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Author</label>
              <input
                type="text"
                value={form.author}
                onChange={(e) => updateField('author', e.target.value)}
                placeholder="BiteSite Team"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              placeholder="cafe, coffee, brunch (comma separated)"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Merchant Link */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Linked Merchant</label>
            <select
              value={form.merchant_slug}
              onChange={(e) => updateField('merchant_slug', e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 focus:border-amber-500 focus:outline-none transition-colors"
            >
              <option value="">None</option>
              {merchants.map((m) => (
                <option key={m.slug} value={m.slug}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Background Theme */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Background Style</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {bgThemes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => updateField('background_style', t.value)}
                  className={`relative rounded-lg border-2 p-2 text-xs transition-all ${
                    form.background_style === t.value
                      ? 'border-amber-500 ring-1 ring-amber-500/30'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: t.bg }}
                >
                  <span style={{ color: t.text }} className="font-medium block text-center">{t.label}</span>
                  {form.background_style === t.value && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-slate-900" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Editorial status and rights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Editorial Status</label>
              <select
                value={form.editorial_status}
                onChange={(e) => updateField('editorial_status', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200 focus:border-amber-500 focus:outline-none"
              >
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="approved">Approved</option>
                <option value="published">Published</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.rights_declared}
                onChange={(e) => updateField('rights_declared', e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-amber-500 focus:ring-amber-500"
              />
              I confirm BiteSite has permission to publish this Story
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Review Notes</label>
            <textarea
              value={form.review_notes}
              onChange={(e) => updateField('review_notes', e.target.value)}
              placeholder="Internal editorial notes (optional)"
              rows={2}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Published Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <button
              onClick={() => updateField('published', !form.published)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.published ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                form.published ? 'translate-x-5' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm text-slate-300">
              {form.published ? (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Eye className="w-3.5 h-3.5" /> Published (visible on site)
                </span>
              ) : (
                <span className="flex items-center gap-1 text-amber-400">
                  <EyeOff className="w-3.5 h-3.5" /> Draft (admin only)
                </span>
              )}
            </span>
          </div>

          {/* Content with Toolbar */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Content (Markdown) *</label>

            {/* Markdown Cheat Sheet */}
            <div className="mb-2 rounded-lg border border-slate-800 bg-slate-900/30 px-3 py-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                <span className="text-amber-500/80 font-medium">💡 语法提示：</span>
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">**文字**</code> 粗体
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">*文字*</code> 斜体
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300"># 标题</code>
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">## 小标题</code>
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">- 项目</code> 列表
                <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">---</code> 分割线
                <br className="hidden sm:block" />
                <span className="sm:ml-0 ml-1">
                  <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">[文字](链接)</code> 链接
                  <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">![描述](图片URL)</code> 图片
                  <code className="mx-1 rounded bg-slate-800 px-1 py-0.5 text-slate-300">`代码`</code>
                  <span className="text-slate-600 ml-1">按 Enter 换行，空行分段</span>
                </span>
              </p>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border border-slate-700 border-b-0 rounded-t-lg bg-slate-900/50">
              <button onClick={() => insertMarkdown('**', '**')} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Bold">
                <Bold className="w-4 h-4" />
              </button>
              <button onClick={() => insertMarkdown('*', '*')} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Italic">
                <Italic className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <button onClick={() => insertMarkdown('# ', '')} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Heading 1">
                <Heading1 className="w-4 h-4" />
              </button>
              <button onClick={() => insertMarkdown('## ', '')} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Heading 2">
                <Heading2 className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <button onClick={insertLink} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Link">
                <LinkIcon className="w-4 h-4" />
              </button>
              <button onClick={insertImage} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Image">
                <ImageIcon className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-slate-700 mx-1" />
              <div className="relative">
                <button onClick={() => setShowEmoji(!showEmoji)} className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Emoji">
                  <Smile className="w-4 h-4" />
                </button>
                {showEmoji && (
                  <div className="absolute left-0 top-8 z-50 w-64 p-2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="grid grid-cols-8 gap-1">
                      {emojis.slice(0, 64).map((emoji) => (
                        <button key={emoji} onClick={() => insertEmoji(emoji)} className="p-1 text-lg hover:bg-slate-800 rounded transition-colors">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={form.content}
              onChange={(e) => updateField('content', e.target.value)}
              placeholder="Write your story in Markdown..."
              rows={16}
              className="w-full rounded-b-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-y font-mono leading-relaxed"
            />

            {/* Word Count */}
            <div className="flex justify-end mt-1">
              <span className="text-xs text-slate-600">
                {wordCount} words · {form.content.length} characters
              </span>
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden lg:block lg:sticky lg:top-0 h-fit max-h-full overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-slate-300">Live Preview</h3>
            <span className="text-xs text-slate-500">100% same as real page</span>
          </div>
          <div 
            className="rounded-xl border border-slate-800 overflow-hidden max-h-[calc(100vh-10rem)] overflow-y-auto"
            style={{ backgroundColor: theme.bg }}
          >
            <StoryHero article={previewArticle} theme={form.background_style} />
            <StoryContent 
              content={form.content} 
              articleSlug={form.slug || 'preview'} 
              theme={form.background_style} 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
