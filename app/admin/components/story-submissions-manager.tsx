'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Eye, Inbox, Loader2, XCircle } from 'lucide-react';
import { useAuth } from './auth-context';

type Submission = {
  id: string;
  merchant_slug: string | null;
  channel: 'self_service_form' | 'admin_relayed';
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'archived' | 'converted';
  title: string;
  excerpt: string | null;
  content: string;
  rights_declared: boolean;
  review_notes: string | null;
  created_at: string;
  submitted_at: string | null;
};

const labels: Record<Submission['status'], string> = {
  draft: 'Draft', pending_review: 'Pending review', approved: 'Approved', rejected: 'Rejected', archived: 'Archived', converted: 'Converted',
};

export default function StorySubmissionsManager() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ title: '', content: '', excerpt: '', merchant_slug: '', rights_declared: false });

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/story-submissions?status=pending_review', { headers: { 'x-admin-token': token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load submissions');
      setSubmissions(data.submissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (submission: Submission, status: 'approved' | 'rejected') => {
    if (!token) return;
    setWorking(submission.id);
    setError('');
    try {
      const res = await fetch('/api/admin/story-submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: submission.id, status, rights_declared: submission.rights_declared, review_notes: status === 'rejected' ? 'Changes requested by editorial review.' : submission.review_notes || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Status update failed');
      setSubmissions(prev => prev.filter(item => item.id !== submission.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setWorking(null);
    }
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
        body: JSON.stringify({ ...draft, channel: 'admin_relayed', status: 'pending_review', submitted_by: 'admin' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create submission');
      setDraft({ title: '', content: '', excerpt: '', merchant_slug: '', rights_declared: false });
      setShowNew(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create submission');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-white">Story Submissions</h1><p className="text-slate-400 text-sm mt-1">Review merchant submissions before creating a public Story.</p></div>
        <div className="flex items-center gap-2"><button onClick={() => setShowNew(value => !value)} className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium hover:bg-amber-400">{showNew ? 'Cancel' : 'New relayed submission'}</button><button onClick={load} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:border-slate-500">Refresh</button></div>
      </div>
      {showNew && (
        <form onSubmit={createSubmission} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200">Admin-relayed submission</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input required value={draft.title} onChange={e => setDraft(prev => ({ ...prev, title: e.target.value }))} placeholder="Story title" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={draft.merchant_slug} onChange={e => setDraft(prev => ({ ...prev, merchant_slug: e.target.value }))} placeholder="Merchant slug (optional)" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          </div>
          <input value={draft.excerpt} onChange={e => setDraft(prev => ({ ...prev, excerpt: e.target.value }))} placeholder="Short excerpt (optional)" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <textarea required rows={6} value={draft.content} onChange={e => setDraft(prev => ({ ...prev, content: e.target.value }))} placeholder="Facts and source material from the merchant" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={draft.rights_declared} onChange={e => setDraft(prev => ({ ...prev, rights_declared: e.target.checked }))} className="h-4 w-4" />Merchant permission has been recorded</label>
          <button type="submit" disabled={saving || !draft.rights_declared} className="px-4 py-2 rounded-lg bg-sky-500 text-slate-950 text-sm font-medium disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button>
        </form>
      )}
      {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm">{error}</div>}
      {submissions.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center text-slate-500"><Inbox className="w-8 h-8 mx-auto mb-3" />No pending Story submissions.</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <article key={submission.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><h2 className="text-lg font-semibold text-white">{submission.title}</h2><span className="text-xs px-2 py-1 rounded-full bg-sky-500/10 text-sky-300">{labels[submission.status]}</span><span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{submission.channel === 'admin_relayed' ? 'Admin relayed' : 'Self service'}</span></div>
                  <p className="text-xs text-slate-500 mt-1">{submission.merchant_slug ? `Merchant: ${submission.merchant_slug} · ` : ''}{submission.submitted_at ? new Date(submission.submitted_at).toLocaleString('en-MY') : new Date(submission.created_at).toLocaleString('en-MY')}</p>
                  {submission.excerpt && <p className="text-sm text-slate-300 mt-3">{submission.excerpt}</p>}
                  <p className="text-sm text-slate-400 mt-3 whitespace-pre-wrap line-clamp-5">{submission.content}</p>
                  <p className="text-xs mt-3"><span className={submission.rights_declared ? 'text-emerald-400' : 'text-red-400'}>{submission.rights_declared ? 'Rights declared' : 'Rights declaration missing'}</span></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => updateStatus(submission, 'approved')} disabled={working === submission.id} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-700/50 text-sm disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Approve</button>
                  <button onClick={() => updateStatus(submission, 'rejected')} disabled={working === submission.id} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-700/50 text-sm disabled:opacity-50"><XCircle className="w-4 h-4" />Request changes</button>
                  <button onClick={() => window.open(`/stories/${submission.merchant_slug || ''}`, '_blank')} className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200" title="Open related page"><Eye className="w-4 h-4" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
