/* bitesite/app/admin/components/jobs-admin.tsx */
'use client';

/**
 * Job Posts (#23): every restaurant job post, newest first. Posts go public without review; hide
 * one that breaks the rules (the restaurant sees the note) or show it again. Visitor reports about
 * a post are counted here and listed in Visitor Reports.
 */

import { useCallback, useEffect, useState } from 'react';
import { EyeOff, Eye, ExternalLink, Flag, Loader2 } from 'lucide-react';
import { useAuth } from './auth-context';
import { jobDaysLeft, jobTypeLabel, type AdminJobItem } from '@/lib/merchant-jobs-core.mjs';

type Filter = 'visible' | 'hidden' | 'all';
type Data = { items: AdminJobItem[]; counts: { visible: number; hidden: number; live: number } };
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'visible', label: 'Not hidden' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'all', label: 'All' },
];

function stateText(job: AdminJobItem) {
  if (job.hidden) return 'Hidden by Admin';
  if (job.status === 'closed') return 'Closed by the restaurant';
  if (job.expired) return 'Expired';
  if (!job.merchantPublic) return 'Restaurant not public';
  return `Live · ${jobDaysLeft(job.expiresAt)} days left`;
}

export default function JobsAdmin() {
  const { token } = useAuth();
  const [filter, setFilter] = useState<Filter>('visible');
  const [data, setData] = useState<Data | null>(null);
  const [off, setOff] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    setData(null);
    try {
      const response = await fetch(`/api/admin/jobs?filter=${filter}`, { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (response.status === 503 && body?.error?.code === 'FEATURE_OFF') { setOff(true); return; }
      if (!response.ok || !body?.data) { setError(body?.error?.message || 'Could not load the job posts.'); return; }
      setOff(false);
      setData(body.data as Data);
    } catch {
      setError('Could not reach the server.');
    }
  }, [token, filter]);
  useEffect(() => { void load(); }, [load]);

  const setHidden = async (job: AdminJobItem, hide: boolean) => {
    if (!token || working) return;
    const note = (notes[job.id] ?? '').trim();
    if (hide && !note) { setNotice('Write a short reason first. The restaurant sees it.'); return; }
    setWorking(job.id);
    setNotice('');
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ jobId: job.id, hide, note: hide ? note : null }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setNotice(body?.error?.message || 'Not saved.'); return; }
      setNotice(hide ? 'Hidden. It is no longer on the website.' : 'Shown again (if it is still open and not expired).');
      setNotes((n) => ({ ...n, [job.id]: '' }));
      await load();
    } catch {
      setNotice('Could not reach the server. Try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Job Posts</h2>
        <p className="mt-1 text-sm text-slate-400">Public restaurants post jobs themselves and they go live at once for 30 days. Hide a post that breaks the rules; the restaurant sees your note. BiteSite never collects applicants&apos; details: people contact the restaurant by WhatsApp or phone.</p>
      </div>
      {off && <p className="rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-200">Not switched on yet: it starts after the database update for job posts is run.</p>}
      {!off && (
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Which posts">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}
              className={`min-h-11 rounded-lg px-4 text-sm ${filter === f.value ? 'bg-amber-500 font-medium text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
              {f.label}{data && f.value !== 'all' ? ` (${data.counts[f.value]})` : ''}
            </button>
          ))}
          {data && <span className="text-sm text-slate-400 sm:ml-auto">{data.counts.live} live on the website</span>}
        </div>
      )}
      {notice && <p className="text-sm text-slate-300" role="status">{notice}</p>}
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>}
      {!data && !error && !off && <Loader2 className="h-6 w-6 animate-spin text-amber-500" />}
      {data && data.items.length === 0 && <p className="text-sm text-slate-400">No job posts here.</p>}
      {data?.items.map((job) => (
        <div key={job.id} className="rounded-xl bg-white p-4 text-[#2C3E2D]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">{job.title} <span className="font-normal text-[#6B6560]">· {jobTypeLabel(job.jobType)}</span></p>
            <p className="text-xs text-[#6B6560]">{stateText(job)}</p>
          </div>
          <a href={`/store/${encodeURIComponent(job.slug)}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm underline">{job.merchantName} <ExternalLink className="h-3 w-3" /></a>
          <p className="text-sm">{job.hours}{job.salary ? ` · ${job.salary}` : ''}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{job.description}</p>
          {job.openReports > 0 && <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700"><Flag className="h-4 w-4" /> {job.openReports} open visitor report{job.openReports > 1 ? 's' : ''}</p>}
          {job.hidden && job.hiddenNote && <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-[#6B6560]">Hidden because: {job.hiddenNote}</p>}
          {job.hidden ? (
            <button type="button" disabled={working !== null} onClick={() => void setHidden(job, false)}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#C9D6C7] px-4 text-sm font-medium disabled:opacity-50 sm:w-auto"><Eye className="h-4 w-4" /> Show again</button>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block flex-1 text-sm">Reason to hide (the restaurant sees this)
                <input type="text" maxLength={500} value={notes[job.id] ?? ''} onChange={(event) => setNotes((n) => ({ ...n, [job.id]: event.target.value }))}
                  className="mt-1 block min-h-11 w-full rounded-lg border border-[#C9D6C7] px-3 text-sm" />
              </label>
              <button type="button" disabled={working !== null} onClick={() => void setHidden(job, true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50"><EyeOff className="h-4 w-4" /> Hide</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
