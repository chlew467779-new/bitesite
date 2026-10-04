'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, FilePlus2, Inbox, Loader2, Pencil, Sparkles, X, XCircle } from 'lucide-react';
import { useAuth } from './auth-context';
import NotifyMerchant, { type Notice } from './notify-merchant';
import { publicStoryPath, submissionActions, type LinkedStory, type SubmissionAction } from '@/lib/story-submission-core.mjs';

type Submission = {
  id: string;
  merchant_id: string | null;
  merchant_slug: string | null;
  merchant: { name: string; slug: string } | null;
  channel: 'self_service_form' | 'admin_relayed';
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived' | 'converted';
  title: string;
  excerpt: string | null;
  content: string;
  story_angle: string | null;
  cover_image: string | null;
  image_urls: string[];
  rights_declared: boolean;
  rights_note: string | null;
  review_notes: string | null;
  created_at: string;
  submitted_at: string | null;
  article_id: string | null;
  article: LinkedStory | null;
  ai_assistance_requested: boolean;
  generated_copy: { title?: string; excerpt?: string; content?: string } | null;
};

type SubmissionStatus = Submission['status'];
type Preview = { url: string; label: string };

const labels: Record<Submission['status'], string> = {
  draft: 'Draft', pending_review: 'Pending review', approved: 'Approved', rejected: 'Rejected', archived: 'Archived', converted: 'Converted',
};

export default function StorySubmissionsManager({ onDraftCreated }: { onDraftCreated?: (slug: string) => void }) {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [aiWorking, setAiWorking] = useState<string | null>(null);
  // One-tap WhatsApp/email notice for each decision made here (CH 2026-09-30).
  const [notices, setNotices] = useState<Notice[]>([]);
  const addNotice = (notice: Notice) => setNotices((list) => [notice, ...list.filter((n) => n.key !== notice.key)]);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'all'>('pending_review');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [draft, setDraft] = useState({ title: '', content: '', excerpt: '', merchant_slug: '', cover_image: '', image_urls: '', rights_declared: false, rights_note: '', ai_assistance_requested: false });

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const query = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/story-submissions${query}`, { headers: { 'x-admin-token': token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load submissions');
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const updateStatus = async (submission: Submission, status: 'converted' | 'draft' | 'approved' | 'rejected', publish = false, publishVersion: 'original' | 'ai' = 'original') => {
    if (!token) return;
    setWorking(submission.id);
    setError('');
    try {
      const res = await fetch('/api/admin/story-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: submission.id, status, publish, publish_version: publishVersion, rights_declared: submission.rights_declared, reviewed_by: 'admin', review_notes: status === 'draft' ? 'Changes requested by editorial review.' : status === 'approved' ? 'Approved by editorial review.' : status === 'rejected' ? 'Rejected by editorial review.' : publish ? `Published ${publishVersion} version by editorial review.` : submission.review_notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');
      // Relayed Stories have no restaurant account to tell; a draft Story is internal until published.
      const published = status === 'converted' && publish && data.article?.slug;
      const kind = published ? 'story_published' : status === 'approved' ? 'story_approved' : status === 'rejected' ? 'story_rejected' : status === 'draft' ? 'story_changes' : null;
      if (kind && submission.merchant_id) {
        addNotice({ key: submission.id, merchantId: submission.merchant_id, kind, storySlug: published ? data.article.slug : null, label: `"${submission.title}": ${published ? 'published' : status === 'draft' ? 'changes requested' : status}` });
      }
      if (status === 'converted' && !publish && data.article?.slug && onDraftCreated) {
        onDraftCreated(data.article.slug);
        return;
      }
      // Still in this list (All, or the same status, e.g. publishing a converted draft): reload it
      // so the card shows its new state; otherwise it leaves the list.
      if (statusFilter === 'all' || statusFilter === status) await load({ silent: true });
      else setSubmissions(prev => prev.filter(item => item.id !== submission.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setWorking(null);
    }
  };

  const confirmIrreversibleAction = (submission: Submission, action: string) =>
    window.confirm(`${action} “${submission.title}”? This cannot be undone from the Story queue.`);

  const generateAiDraft = async (submission: Submission) => {
    if (!token) return;
    setAiWorking(submission.id); setError('');
    try {
      const res = await fetch('/api/admin/ai-draft', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token }, body: JSON.stringify({ submission_id: submission.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI draft generation failed');
      setSubmissions(prev => prev.map(item => item.id === submission.id ? { ...item, generated_copy: data.draft } : item));
    } catch (err) { setError(err instanceof Error ? err.message : 'AI draft generation failed'); }
    finally { setAiWorking(null); }
  };

  const createSubmission = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !draft.title.trim() || !draft.content.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/story-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({
          ...draft,
          image_urls: draft.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean),
          channel: 'admin_relayed',
          status: 'pending_review',
          submitted_by: 'admin',
          ai_assistance_requested: draft.ai_assistance_requested,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create submission');
      setDraft({ title: '', content: '', excerpt: '', merchant_slug: '', cover_image: '', image_urls: '', rights_declared: false, rights_note: '', ai_assistance_requested: false });
      setShowNew(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission');
    } finally {
      setSaving(false);
    }
  };

  const button = 'inline-flex min-h-11 items-center gap-1 px-3 py-2 rounded-lg border text-sm disabled:opacity-50';
  const renderAction = (action: SubmissionAction, submission: Submission) => {
    const busy = working === submission.id;
    switch (action) {
      case 'view_story': {
        const href = publicStoryPath(submission.article);
        return href ? <a key={action} href={href} target="_blank" rel="noopener noreferrer" className={`${button} bg-emerald-500/10 text-emerald-300 border-emerald-700/50`}><ExternalLink className="w-4 h-4" />View Story</a> : null;
      }
      case 'edit_story': {
        const slug = submission.article?.slug;
        return slug && onDraftCreated ? <button key={action} type="button" onClick={() => onDraftCreated(slug)} className={`${button} bg-slate-800 text-slate-200 border-slate-700`}><Pencil className="w-4 h-4" />Edit Story</button> : null;
      }
      case 'approve':
        return <button key={action} type="button" onClick={() => updateStatus(submission, 'approved')} disabled={busy} className={`${button} bg-sky-500/10 text-sky-300 border-sky-700/50`}>Approve</button>;
      case 'create_draft':
        return <button key={action} type="button" onClick={() => updateStatus(submission, 'converted')} disabled={busy} className={`${button} bg-emerald-500/10 text-emerald-300 border-emerald-700/50`}><FilePlus2 className="w-4 h-4" />Create draft Story</button>;
      case 'ai_draft':
        return <button key={action} type="button" onClick={() => generateAiDraft(submission)} disabled={busy || aiWorking === submission.id} className={`${button} bg-violet-500/10 text-violet-300 border-violet-700/50`}><Sparkles className="w-4 h-4" />{aiWorking === submission.id ? 'Generating…' : submission.generated_copy ? 'Generate AI draft again' : 'Generate AI draft'}</button>;
      case 'publish_original':
        return <button key={action} type="button" onClick={() => { if (confirmIrreversibleAction(submission, 'Publish the original version of')) void updateStatus(submission, 'converted', true, 'original'); }} disabled={busy} className={`${button} bg-amber-500/10 text-amber-300 border-amber-700/50`}><FilePlus2 className="w-4 h-4" />Publish original</button>;
      case 'publish_ai':
        return <button key={action} type="button" onClick={() => { if (confirmIrreversibleAction(submission, 'Publish the AI draft of')) void updateStatus(submission, 'converted', true, 'ai'); }} disabled={busy} className={`${button} bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-700/50`}><FilePlus2 className="w-4 h-4" />Publish AI draft</button>;
      case 'request_changes':
        return <button key={action} type="button" onClick={() => updateStatus(submission, 'draft')} disabled={busy} className={`${button} bg-red-500/10 text-red-300 border-red-700/50`}><XCircle className="w-4 h-4" />Request changes</button>;
      case 'reject':
        return <button key={action} type="button" onClick={() => { if (confirmIrreversibleAction(submission, 'Reject')) void updateStatus(submission, 'rejected'); }} disabled={busy} className={`${button} bg-red-500/10 text-red-300 border-red-700/50`}>Reject</button>;
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Story Submissions</h1><p className="text-slate-400 text-sm mt-1">Review merchant submissions before creating a public Story.</p></div>
        <div className="flex flex-wrap items-center gap-2"><button onClick={() => setShowNew(value => !value)} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400">{showNew ? 'Cancel' : 'New relayed submission'}</button><button onClick={() => load()} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500">Refresh</button></div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['pending_review', 'draft', 'approved', 'converted', 'rejected', 'archived', 'all'] as const).map(status => (
          <button key={status} onClick={() => setStatusFilter(status)} className={`min-h-11 px-3 py-1.5 rounded-lg border text-xs ${statusFilter === status ? 'border-amber-500 bg-amber-500/10 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {status === 'all' ? 'All' : labels[status]}
          </button>
        ))}
      </div>
      {showNew && (
        <form onSubmit={createSubmission} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Admin-relayed submission</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required value={draft.title} onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))} placeholder="Story title" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={draft.merchant_slug} onChange={e => setDraft(prev => ({ ...prev, merchant_slug: e.target.value }))} placeholder="Merchant slug (optional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <input value={draft.excerpt} onChange={e => setDraft(prev => ({ ...prev, excerpt: e.target.value }))} placeholder="Short excerpt (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <input type="url" value={draft.cover_image} onChange={e => setDraft(prev => ({ ...prev, cover_image: e.target.value }))} placeholder="Cover image URL (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <textarea rows={3} value={draft.image_urls} onChange={e => setDraft(prev => ({ ...prev, image_urls: e.target.value }))} placeholder="Up to 3 image URLs, one per line (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <textarea required rows={6} value={draft.content} onChange={e => setDraft(prev => ({ ...prev, content: e.target.value }))} placeholder="Facts and source material from the merchant" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={draft.rights_declared} onChange={e => setDraft(prev => ({ ...prev, rights_declared: e.target.checked }))} className="h-4 w-4" />Merchant permission has been recorded</label>
          <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" checked={draft.ai_assistance_requested} onChange={e => setDraft(prev => ({ ...prev, ai_assistance_requested: e.target.checked }))} className="mt-1 h-4 w-4" />Merchant requested optional AI drafting help. The original material will remain unchanged.</label>
          <input value={draft.rights_note} onChange={e => setDraft(prev => ({ ...prev, rights_note: e.target.value }))} placeholder="Where/how permission was recorded (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <button type="submit" disabled={saving || !draft.rights_declared} className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-sm font-medium disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button>
        </form>
      )}
      <NotifyMerchant notices={notices} onDone={(key) => setNotices((list) => list.filter((n) => n.key !== key))} />
      {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm">{error}</div>}
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-500"><Inbox className="w-8 h-8 mx-auto mb-3" />{statusFilter === 'all' ? 'No Story submissions yet.' : `No submissions with status “${labels[statusFilter]}”.`}</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap"><h2 className="min-w-0 break-words text-lg font-semibold text-white">{submission.title}</h2><span className="text-xs px-2 py-1 rounded-full bg-sky-500/10 text-sky-300">{labels[submission.status]}</span><span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{submission.channel === 'admin_relayed' ? 'Admin relayed' : 'Self service'}</span>{submission.ai_assistance_requested && <span className="text-xs px-2 py-1 rounded-full bg-violet-500/10 text-violet-300">AI draft requested</span>}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  {submission.merchant_id ? (
                    <span>Restaurant: <strong className="text-slate-200">{submission.merchant?.name ?? 'Unknown restaurant'}</strong>{submission.merchant?.slug && ` /${submission.merchant.slug}`}</span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-300">Unlinked{submission.merchant_slug && ` · /${submission.merchant_slug}`}</span>
                  )}
                  <span>{new Date(submission.submitted_at ?? submission.created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</span>
                  {submission.merchant_slug && <a href={`/store/${encodeURIComponent(submission.merchant_slug)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-slate-300 underline hover:text-white"><Eye className="h-3.5 w-3.5" />Restaurant page</a>}
                </div>
                {submission.story_angle && <p className="mt-3 text-sm text-slate-200"><span className="mr-2 text-xs font-medium uppercase tracking-wide text-slate-500">Angle</span>{submission.story_angle}</p>}
                {submission.excerpt && <p className="text-sm text-slate-300 mt-3">{submission.excerpt}</p>}
                <p className="text-sm text-slate-400 mt-3 whitespace-pre-wrap line-clamp-5">{submission.content}</p>
                <SubmissionMedia submission={submission} onOpen={setPreview} />
                <p className="text-xs mt-3"><span className={submission.rights_declared ? 'text-emerald-400' : 'text-red-400'}>{submission.rights_declared ? 'Rights declared' : 'Rights declaration missing'}</span>{submission.rights_note ? ` · ${submission.rights_note}` : ''}</p>
                {submission.review_notes && <p className="text-xs text-amber-300 mt-2 whitespace-pre-wrap">Review: {submission.review_notes}</p>}
                {submission.status === 'converted' && <LinkedStoryStatus article={submission.article} />}
                {submission.generated_copy && <details className="mt-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-sm text-slate-300"><summary className="cursor-pointer font-medium text-violet-300">Preview AI draft before publishing</summary><div className="mt-3 space-y-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Title</p><p className="mt-1 text-white">{submission.generated_copy.title || 'Untitled draft'}</p></div>{submission.generated_copy.excerpt && <div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Excerpt</p><p className="mt-1 whitespace-pre-wrap">{submission.generated_copy.excerpt}</p></div>}<div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Full draft</p><p className="mt-1 whitespace-pre-wrap leading-6">{submission.generated_copy.content || 'No draft content was returned.'}</p></div></div></details>}
              </div>
              <SubmissionActions submission={submission} render={renderAction} />
            </article>
          ))}
        </div>
      )}
      {preview && (
        <div role="dialog" aria-modal="true" aria-label={preview.label} onClick={() => setPreview(null)} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-full max-w-4xl" onClick={(event) => event.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size review of a submitted photo */}
            <img src={preview.url} alt={preview.label} className="max-h-[80vh] max-w-full rounded-lg object-contain" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
              <span>{preview.label}</span>
              <span className="flex gap-2">
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-600 px-3 hover:text-white"><ExternalLink className="h-4 w-4" />Open file</a>
                <button type="button" autoFocus onClick={() => setPreview(null)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-slate-600 px-3 hover:text-white"><X className="h-4 w-4" />Close</button>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Only the actions that fit the submission's status; the row wraps on a phone (A-11). */
function SubmissionActions({ submission, render }: { submission: Submission; render: (action: SubmissionAction, submission: Submission) => React.ReactNode }) {
  const actions = submissionActions(submission);
  if (actions.length === 0) return <p className="mt-4 border-t border-slate-800 pt-4 text-xs text-slate-500">No review actions for this status.</p>;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-4">
      {submission.status === 'draft' && <p className="w-full text-xs text-slate-400">Waiting for the restaurant to change and resubmit.</p>}
      {actions.map((action) => render(action, submission))}
    </div>
  );
}

/** Cover and gallery photos as thumbnails; a tap opens the full photo (A-02). */
function SubmissionMedia({ submission, onOpen }: { submission: Submission; onOpen: (preview: Preview) => void }) {
  const gallery = Array.isArray(submission.image_urls) ? submission.image_urls.filter((url) => typeof url === 'string' && url) : [];
  const media = [
    ...(submission.cover_image ? [{ url: submission.cover_image, label: 'Cover' }] : []),
    ...gallery.map((url, index) => ({ url, label: `Gallery ${index + 1}` })),
  ];
  if (media.length === 0) return <p className="mt-3 text-xs text-slate-500">No photos submitted.</p>;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {media.map((item) => (
        <button key={`${item.label}:${item.url}`} type="button" onClick={() => onOpen(item)} aria-label={`Open ${item.label.toLowerCase()} photo`} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-700 bg-slate-950 hover:border-amber-500 sm:h-24 sm:w-24">
          {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of submitted photos (any host) */}
          <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5 text-[10px] text-white">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Whether the Story made from this submission is public yet (A-03). */
function LinkedStoryStatus({ article }: { article: LinkedStory | null }) {
  if (!article) return <p className="mt-2 text-xs text-amber-300">The Story made from this submission was deleted.</p>;
  if (publicStoryPath(article)) return <p className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Story is live. The restaurant sees “Published” with a link.</p>;
  return <p className="mt-2 text-xs text-slate-400">The Story is a draft and not public yet. The restaurant sees “With editorial team”.</p>;
}
