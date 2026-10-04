/* bitesite/app/merchant/components/jobs-panel.tsx */
'use client';

/**
 * Hiring (#23): the Owner posts job openings. A post goes on BiteSite at once (while the restaurant
 * is public) and stays for 30 days; renew, close or delete it any time. Applicants contact the
 * restaurant by WhatsApp or phone; BiteSite collects nothing about them. Renders nothing until the
 * job post database update has run (the API answers FEATURE_OFF).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import type { SectionHandle } from '@/app/components/section-save/use-section-save';
import { JOB_LIMITS, JOB_TYPES, jobDaysLeft, jobFormProblems, jobTypeLabel, type JobItem, type JobsRead, type JobType } from '@/lib/merchant-jobs-core.mjs';

type Draft = { jobId: string; isNew: boolean; title: string; jobType: JobType | ''; salary: string; hours: string; description: string };
type Problems = ReturnType<typeof jobFormProblems>;

const btn = 'inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium disabled:opacity-50';
const input = 'mt-1 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-3 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

function stateText(job: JobItem) {
  if (job.hidden) return { text: 'Hidden by BiteSite', tone: 'text-red-700' };
  if (job.status === 'closed') return { text: 'Closed', tone: 'text-[#6B6560]' };
  if (job.expired) return { text: 'Expired', tone: 'text-amber-800' };
  const days = jobDaysLeft(job.expiresAt);
  return { text: `On your page · ${days} day${days === 1 ? '' : 's'} left`, tone: 'text-emerald-800' };
}

const emptyDraft = (): Draft => ({ jobId: crypto.randomUUID(), isNew: true, title: '', jobType: '', salary: '', hours: '', description: '' });

export function JobsPanel({ merchantId, getHeaders, readOnly, register, onAvailable, renderSection }: {
  merchantId: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
  /** Called with false when job posts are not switched on, so the page can drop the section link. */
  onAvailable?: (available: boolean) => void;
  renderSection: (body: ReactNode) => ReactNode;
}) {
  const api = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/jobs`;
  const [data, setData] = useState<JobsRead | null>(null);
  const [off, setOff] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [problems, setProblems] = useState<Problems>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    register?.('jobs', { status: () => ({ dirty: draft !== null, pending: busy, unknown: false, conflicts: false }), save: async () => 'skipped', discard: () => { setDraft(null); setProblems({}); } });
    return () => register?.('jobs', null);
  }, [register, busy, draft]);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setLoadError('Your session has ended. Sign in again.'); return; }
      const response = await fetch(api, { headers, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (response.status === 503 && body?.error?.code === 'FEATURE_OFF') { setOff(true); onAvailable?.(false); return; }
      if (!response.ok || !body?.data) { setLoadError(body?.error?.message || 'Could not load your job posts.'); return; }
      setOff(false);
      onAvailable?.(true);
      setData(body.data as JobsRead);
    } catch {
      setLoadError('Could not reach BiteSite. Check your connection.');
    }
  }, [api, getHeaders, onAvailable]);
  useEffect(() => { void load(); }, [load]);

  const send = async (payload: Record<string, unknown>, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: 'Your session has ended. Sign in again, then retry.' }); return false; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setMessage({ kind: 'error', text: body?.error?.message || 'Not saved. Try again.' }); return false; }
      setMessage({ kind: 'ok', text: success });
      await load();
      return true;
    } catch {
      // Saving again is safe: the post id stays the same, so it is never posted twice.
      setMessage({ kind: 'error', text: 'Could not reach BiteSite. Try again; it will not post twice.' });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (off) return null;
  if (loadError) return renderSection(<p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>);
  // Nothing until the first answer, so restaurants without job posts switched on never see a flash.
  if (!data) return null;

  const locked = readOnly || busy;
  const openCount = data.jobs.filter((j) => j.status === 'open' && !j.expired).length;
  const atLimit = openCount >= data.openLimit;

  const save = async () => {
    if (!draft) return;
    const found = jobFormProblems(draft);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    const ok = await send({ action: 'save', jobId: draft.jobId, title: draft.title, jobType: draft.jobType, salary: draft.salary || null, hours: draft.hours, description: draft.description },
      draft.isNew ? 'Posted. It is on your restaurant page now.' : 'Saved.');
    if (ok) { setDraft(null); setProblems({}); }
  };
  const edit = (job: JobItem) => { setDraft({ jobId: job.id, isNew: false, title: job.title, jobType: job.jobType, salary: job.salary ?? '', hours: job.hours, description: job.description }); setProblems({}); setMessage(null); };
  const act = (job: JobItem, action: 'close' | 'renew' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    void send({ action, jobId: job.id }, action === 'close' ? 'Closed. It is no longer on your page.' : action === 'renew' ? `On your page for ${JOB_LIMITS.days} more days.` : 'Deleted.');
  };
  const field = (key: keyof Problems) => problems[key] ? <p className="mt-1 text-sm text-red-700">{problems[key]}</p> : null;

  const form = draft && (
    <div className="space-y-3 rounded-xl border border-[#C9D6C7] bg-[#FAFBF7] p-4">
      <p className="font-medium text-[#2C3E2D]">{draft.isNew ? 'New job post' : 'Edit job post'}</p>
      <label className="block text-sm font-medium text-[#2C3E2D]">Job title
        <input className={input} value={draft.title} maxLength={JOB_LIMITS.title} placeholder="e.g. Kitchen helper" onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      {field('title')}
      <fieldset>
        <legend className="text-sm font-medium text-[#2C3E2D]">Type</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {JOB_TYPES.map((t) => (
            <label key={t.value} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${draft.jobType === t.value ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-[#C9D6C7] bg-white text-[#2C3E2D]'}`}>
              <input type="radio" name={`job-type-${draft.jobId}`} value={t.value} checked={draft.jobType === t.value} onChange={() => setDraft({ ...draft, jobType: t.value })} className="h-4 w-4" />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      {field('jobType')}
      <label className="block text-sm font-medium text-[#2C3E2D]">Working hours
        <input className={input} value={draft.hours} maxLength={JOB_LIMITS.hours} placeholder="e.g. Mon–Fri 9am–6pm, or weekends only" onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
      </label>
      {field('hours')}
      <label className="block text-sm font-medium text-[#2C3E2D]">Pay <span className="font-normal text-[#6B6560]">(optional)</span>
        <input className={input} value={draft.salary} maxLength={JOB_LIMITS.salary} placeholder="e.g. RM1,800/month or RM10/hour" onChange={(e) => setDraft({ ...draft, salary: e.target.value })} />
      </label>
      {field('salary')}
      <label className="block text-sm font-medium text-[#2C3E2D]">About the job
        <textarea className={input} rows={5} value={draft.description} maxLength={JOB_LIMITS.description} placeholder="What the work is, who you are looking for, any benefits." onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <span className="mt-1 block text-right text-xs font-normal text-[#6B6560]">{draft.description.length}/{JOB_LIMITS.description}</span>
      </label>
      {field('description')}
      <p className="text-xs text-[#6B6560]">People apply by WhatsApp or phone using the numbers on your page. Do not ask applicants for money or ID numbers in the post.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={locked} onClick={() => void save()} className={`${btn} bg-[#2C3E2D] text-white`}>{busy ? 'Saving…' : draft.isNew ? 'Post job' : 'Save changes'}</button>
        <button type="button" disabled={busy} onClick={() => { setDraft(null); setProblems({}); }} className={`${btn} border border-[#C9D6C7] text-[#2C3E2D]`}>Cancel</button>
      </div>
    </div>
  );

  return renderSection(
    <div className="space-y-4">
      {!data.canPost && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">You can post jobs once your restaurant page is public.</p>}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
      {form}
      {!draft && data.canPost && (
        atLimit
          ? <p className="text-sm text-[#6B6560]">You have {data.openLimit} open posts, the most at one time. Close one to post another.</p>
          : <button type="button" disabled={locked} onClick={() => { setDraft(emptyDraft()); setMessage(null); }} className={`${btn} w-full gap-2 border border-emerald-800 text-emerald-900 sm:w-auto`}><Plus className="h-4 w-4" /> Post a job</button>
      )}
      {data.jobs.length === 0 && !draft && <p className="text-sm text-[#6B6560]">No job posts yet.</p>}
      {data.jobs.map((job) => {
        const state = stateText(job);
        const canRenew = data.canPost && !job.hidden && (job.status === 'closed' || job.expired || jobDaysLeft(job.expiresAt) <= 7);
        return (
          <div key={job.id} className="rounded-xl border border-[#DDE5DC] p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium text-[#2C3E2D]">{job.title} <span className="font-normal text-[#6B6560]">· {jobTypeLabel(job.jobType)}</span></p>
              <p className={`text-xs ${state.tone}`}>{state.text}</p>
            </div>
            <p className="mt-1 text-sm text-[#4B4540]">{job.hours}{job.salary ? ` · ${job.salary}` : ''}</p>
            {job.hidden && job.hiddenNote && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">BiteSite note: {job.hiddenNote}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={locked || !!draft} onClick={() => edit(job)} className={`${btn} border border-[#C9D6C7] text-[#2C3E2D]`}>Edit</button>
              {canRenew && <button type="button" disabled={locked || !!draft || (atLimit && (job.status === 'closed' || job.expired))} onClick={() => act(job, 'renew')} className={`${btn} border border-emerald-800 text-emerald-900`}>{job.status === 'closed' || job.expired ? 'Reopen for 30 days' : 'Renew 30 days'}</button>}
              {job.status === 'open' && !job.expired && <button type="button" disabled={locked || !!draft} onClick={() => act(job, 'close')} className={`${btn} border border-[#C9D6C7] text-[#2C3E2D]`}>Close</button>}
              <button type="button" disabled={locked || !!draft} onClick={() => act(job, 'delete')} className={`${btn} text-red-700 underline`}>Delete</button>
            </div>
          </div>
        );
      })}
    </div>,
  );
}
