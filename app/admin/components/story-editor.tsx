/* bitesite/app/admin/components/story-editor.tsx */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Send
} from 'lucide-react';
import type { Article } from '@/types';

interface MerchantOption {
  slug: string;
  name: string;
}

interface StoryEditorProps {
  slug?: string | null; // null = new story
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

export default function StoryEditor({ slug, onBack, onSaved }: StoryEditorProps) {
  const { token } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [loading, setLoading] = useState(!!slug);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  
  // Form state
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
  });

  // Load existing article or merchants
  useEffect(() => {
    const fetchData = async () => {
      // Fetch merchants for dropdown
      try {
        const res = await fetch('/api/admin/merchants?range=365d', {
          headers: { 'x-admin-token': token || '' },
        });
        if (res.ok) {
          const data = await res.json();
          const merchantList = (data.data || []).map((m: { slug: string; name: string }) => ({
            slug: m.slug,
            name: m.name,
          }));
          setMerchants(merchantList);
        }
      } catch (err) {
        console.error('Failed to load merchants:', err);
      }

      // Fetch existing article
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

  const updateField = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // Auto-generate slug from title
  useEffect(() => {
    if (!slug && form.title && !form.slug) {
      const base = form.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 50)
        .replace(/^-|-$/g, '');
      if (base) setForm(prev => ({ ...prev, slug: base }));
    }
  }, [form.title, slug]);

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
    
    setTimeout(() => {
      textarea.focus();
      const newCursor = start + before.length + selected.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 0);
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

  const insertEmoji = (emoji: string) => {
    insertMarkdown(emoji);
    setShowEmoji(false);
  };

  const handleSave = async (publish: boolean) => {
    if (!token) return;
    setSaving(true);
    setError('');
    setSaved(false);

    try {
      const payload = {
        ...form,
        published: publish,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
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

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Build preview article object
  const previewArticle = {
    id: 'preview',
    slug: form.slug || 'preview',
    title: form.title || 'Untitled Story',
    excerpt: form.excerpt || '',
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to List
        </button>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
          >
            {saving && !form.published ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : null}
            Save Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium transition-colors disabled:opacity-50"
          >
            {saving && form.published ? <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" /> : <Send className="w-3.5 h-3.5 inline mr-1" />}
            {form.published ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor Form */}
        <div className="space-y-4">
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
            <p className="text-xs text-slate-500 mt-1">Auto-generated from title. Edit if needed.</p>
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

          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Cover Image URL</label>
            <input
              type="text"
              value={form.cover_image}
              onChange={(e) => updateField('cover_image', e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Category & Author */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category *</label>
              <input
                type="text"
                value={form.category}
                onChange={(e) => updateField('category', e.target.value)}
                placeholder="e.g. Food, Cafe, Review"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors"
              />
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
                  <span style={{ color: t.text }} className="font-medium block text-center">
                    {t.label}
                  </span>
                  {form.background_style === t.value && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-slate-900" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Published Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 bg-slate-900/50">
            <button
              onClick={() => updateField('published', !form.published)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                form.published ? 'bg-amber-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  form.published ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
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
                <button 
                  onClick={() => setShowEmoji(!showEmoji)} 
                  className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                  title="Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showEmoji && (
                  <div className="absolute left-0 top-8 z-50 w-64 p-2 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
                    <div className="grid grid-cols-8 gap-1">
                      {emojis.slice(0, 64).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="p-1 text-lg hover:bg-slate-800 rounded transition-colors"
                        >
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
              placeholder="Write your story in Markdown...

# Main Heading

**Bold text** for emphasis.

- Bullet point 1
- Bullet point 2

[Link to merchant](/store/merchant-slug)

![Image description](https://...)"
              rows={20}
              className="w-full rounded-b-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-amber-500 focus:outline-none transition-colors resize-y font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-300">Live Preview</h3>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              {showPreview ? 'Hide' : 'Show'}
            </button>
          </div>
          
          {showPreview && (
            <div 
              className="rounded-xl border border-slate-800 overflow-hidden"
              style={{ backgroundColor: theme.bg }}
            >
              <div className="max-h-[80vh] overflow-y-auto">
                {/* Inline preview - simplified hero + content */}
                <div className="px-4 pt-6 pb-6 sm:px-6 lg:px-8">
                  <div className="mx-auto max-w-3xl">
                    {/* Category */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <span 
                        className="rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wider"
                        style={{ 
                          backgroundColor: theme.value === 'dark' ? 'rgba(212,168,83,0.2)' : 'rgba(90,143,110,0.1)',
                          color: theme.value === 'dark' ? '#D4A853' : '#5A8F6E'
                        }}
                      >
                        {previewArticle.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h1 
                      className="mb-4 font-serif text-3xl font-medium leading-tight sm:text-4xl md:text-5xl"
                      style={{ color: theme.text }}
                    >
                      {previewArticle.title}
                    </h1>

                    {/* Meta */}
                    <div className="mb-8 flex flex-wrap items-center gap-3 text-sm" style={{ color: theme.value === 'dark' ? '#888' : '#8A968B' }}>
                      <span style={{ color: theme.value === 'dark' ? '#B0B0B0' : '#6B6560' }}>{previewArticle.author}</span>
                      <span>·</span>
                      <span>{new Date().toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>

                    {/* Cover */}
                    {previewArticle.cover_image && (
                      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl mb-8">
                        <img
                          src={previewArticle.cover_image}
                          alt={previewArticle.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Content Preview - simple markdown render */}
                    <div className="prose prose-sm max-w-none" style={{ color: theme.text }}>
                      {form.content ? (
                        <div dangerouslySetInnerHTML={{ 
                          __html: form.content
                            .replace(/^### (.*$)/gim, '<h3 style="color:' + theme.text + ';font-size:1.25rem;font-weight:600;margin:1.5rem 0 0.75rem;">$1</h3>')
                            .replace(/^## (.*$)/gim, '<h2 style="color:' + theme.text + ';font-size:1.5rem;font-weight:600;margin:2rem 0 1rem;">$1</h2>')
                            .replace(/^# (.*$)/gim, '<h1 style="color:' + theme.text + ';font-size:2rem;font-weight:600;margin:2rem 0 1rem;">$1</h1>')
                            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:' + theme.text + ';">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" style="color:' + (theme.value === 'dark' ? '#D4A853' : '#5A8F6E') + ';text-decoration:underline;">$1</a>')
                            .replace(/!\[(.*?)\]\((.*?)\)/g, '<div class="my-4"><img src="$2" alt="$1" class="w-full rounded-xl" /></div>')
                            .replace(/^- (.*$)/gim, '<li style="margin:0.25rem 0;color:' + (theme.value === 'dark' ? '#B0B0B0' : '#6B6560') + ';">$1</li>')
                            .replace(/^> (.*$)/gim, '<blockquote style="border-left:3px solid ' + (theme.value === 'dark' ? '#D4A853' : '#5A8F6E') + ';padding-left:1rem;margin:1rem 0;font-style:italic;color:' + (theme.value === 'dark' ? '#B0B0B0' : '#6B6560') + ';">$1</blockquote>')
                            .replace(/\n/g, '<br />')
                        }} />
                      ) : (
                        <p style={{ color: theme.value === 'dark' ? '#888' : '#8A968B' }} className="italic">
                          Start typing to see preview...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
