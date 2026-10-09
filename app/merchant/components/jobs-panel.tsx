'use client';
/* bitesite/app/merchant/components/jobs-panel.tsx */
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

const btn = cn(buttonClasses({ variant: 'secondary', size: 'md' }), 'min-w-11 whitespace-normal');
const input = 'mt-1 block w-full rounded-lg border border-line-strong bg-white px-3 py-3 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function stateText(job: JobItem, t: ReturnType<typeof useT>) {
  if (job.hidden) return { text: t('owner.jobs.hiddenByBitesite'), tone: 'text-red-700' };
  if (job.status === 'closed') return { text: t('owner.jobs.closed'), tone: 'text-muted' };
  if (job.expired) return { text: t('owner.jobs.expired'), tone: 'text-amber-800' };
  const days = jobDaysLeft(job.expiresAt);
  return { text: t(days === 1 ? 'owner.jobs.onYourPageDaysLeftOne' : 'owner.jobs.onYourPageDaysLeft', { days }), tone: 'text-brand' };
}

const emptyDraft = (): Draft => ({ jobId: crypto.randomUUID(), isNew: true, title: '', jobType: '', salary: '', hours: '', description: '' });

export function JobsPanel({ merchantId, getHeaders, readOnly, register, onAvailable, renderSection, endpoint }: {
  merchantId: string;
  /** Admin: read/write addresses and extra body fields; the Owner routes when left out. */
  endpoint?: { read: string; write: string; body?: Record<string, unknown> };
  getHeaders: () => Promise<Record<string, string> | null>;
  readOnly: boolean;
  register?: (id: string, handle: SectionHandle | null) => void;
  /** Called with false when job posts are not switched on, so the page can drop the section link. */
  onAvailable?: (available: boolean) => void;
  renderSection: (body: ReactNode) => ReactNode;
}) {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const jobTypeKeys = { full_time: 'jobs.fullTime', part_time: 'jobs.partTime', temporary: 'jobs.temporary' } as const;
  const problemKeys = { title: 'owner.jobs.validation.title', jobType: 'owner.jobs.validation.jobType', salary: 'owner.jobs.validation.salary', hours: 'owner.jobs.validation.hours', description: 'owner.jobs.validation.description' } as const;
  const ownerApi = `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/jobs`;
  const readApi = endpoint?.read ?? ownerApi;
  const writeApi = endpoint?.write ?? ownerApi;
  const extraBody = endpoint?.body;
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
      if (!headers) { setLoadError(tRef.current('owner.common.yourSessionHasEndedSignIn')); return; }
      const response = await fetch(readApi, { headers, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (response.status === 503 && body?.error?.code === 'FEATURE_OFF') { setOff(true); onAvailable?.(false); return; }
      if (!response.ok || !body?.data) { setLoadError(body?.error?.message || tRef.current('owner.jobs.couldNotLoadYourJobPosts')); return; }
      setOff(false);
      onAvailable?.(true);
      setData(body.data as JobsRead);
    } catch {
      setLoadError(tRef.current('owner.common.couldNotReachBitesiteCheckYour'));
    }
  }, [readApi, getHeaders, onAvailable]);
  useEffect(() => { void load(); }, [load]);

  const send = async (payload: Record<string, unknown>, success: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setMessage({ kind: 'error', text: t('owner.common.yourSessionHasEndedSignIn2') }); return false; }
      const response = await fetch(writeApi, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...extraBody, ...payload }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setMessage({ kind: 'error', text: body?.error?.message || t('owner.common.notSavedTryAgain') }); return false; }
      setMessage({ kind: 'ok', text: success });
      await load();
      return true;
    } catch {
      // Saving again is safe: the post id stays the same, so it is never posted twice.
      setMessage({ kind: 'error', text: t('owner.jobs.couldNotReachBitesiteTryAgain') });
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (off) return null;
  if (loadError) return renderSection(<p className="text-sm text-red-700" role="alert">{loadError} <button type="button" className={cn(buttonClasses({ variant: 'ghost', size: 'md' }), 'min-w-11 whitespace-normal', "ml-1 min-h-11 underline")} onClick={() => void load()}>{t('owner.common.tryAgain')}</button></p>);
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
      draft.isNew ? t('owner.jobs.postedItIsOnYourRestaurant') : t('owner.common.saved'));
    if (ok) { setDraft(null); setProblems({}); }
  };
  const edit = (job: JobItem) => { setDraft({ jobId: job.id, isNew: false, title: job.title, jobType: job.jobType, salary: job.salary ?? '', hours: job.hours, description: job.description }); setProblems({}); setMessage(null); };
  const act = (job: JobItem, action: 'close' | 'renew' | 'delete') => {
    if (action === 'delete' && !window.confirm(t('owner.jobs.deleteThisCannotBeUndone', { title: job.title }))) return;
    void send({ action, jobId: job.id }, action === 'close' ? t('owner.jobs.closedItIsNoLongerOn') : action === 'renew' ? t('owner.jobs.onYourPageForMoreDays', { days: JOB_LIMITS.days }) : t('owner.jobs.deleted'));
  };
  const field = (key: keyof Problems) => problems[key] ? <p className="mt-1 text-sm text-red-700">{t(problemKeys[key], { max: JOB_LIMITS[key === 'jobType' ? 'title' : key] })}</p> : null;

  const form = draft && (
    <div className="space-y-3 rounded-xl border border-line-strong bg-page p-4">
      <p className="font-medium text-ink">{draft.isNew ? t('owner.jobs.newJobPost') : t('owner.jobs.editJobPost')}</p>
      <label className="block text-sm font-medium text-ink">{t('owner.jobs.jobTitle')}
        <input className={input} value={draft.title} maxLength={JOB_LIMITS.title} placeholder={t('owner.jobs.eGKitchenHelper')} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      {field('title')}
      <fieldset>
        <legend className="text-sm font-medium text-ink">{t('owner.jobs.type')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {JOB_TYPES.map((item) => (
            <label key={item.value} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm ${draft.jobType === item.value ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong bg-white text-ink'}`}>
              <input type="radio" name={`job-type-${draft.jobId}`} value={item.value} checked={draft.jobType === item.value} onChange={() => setDraft({ ...draft, jobType: item.value })} className="h-4 w-4" />
              {t(jobTypeKeys[item.value])}
            </label>
          ))}
        </div>
      </fieldset>
      {field('jobType')}
      <label className="block text-sm font-medium text-ink">{t('owner.jobs.workingHours')}
        <input className={input} value={draft.hours} maxLength={JOB_LIMITS.hours} placeholder={t('owner.jobs.eGMonFri9am6pm')} onChange={(e) => setDraft({ ...draft, hours: e.target.value })} />
      </label>
      {field('hours')}
      <label className="block text-sm font-medium text-ink">{t('jobs.detail.pay')} <span className="font-normal text-muted">{t('feedback.optional')}</span>
        <input className={input} value={draft.salary} maxLength={JOB_LIMITS.salary} placeholder={t('owner.jobs.eGRm1800MonthOr')} onChange={(e) => setDraft({ ...draft, salary: e.target.value })} />
      </label>
      {field('salary')}
      <label className="block text-sm font-medium text-ink">{t('owner.jobs.aboutTheJob')}
        <textarea className={input} rows={5} value={draft.description} maxLength={JOB_LIMITS.description} placeholder={t('owner.jobs.whatTheWorkIsWhoYou')} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <span className="mt-1 block text-right text-xs font-normal text-muted">{draft.description.length}/{JOB_LIMITS.description}</span>
      </label>
      {field('description')}
      <p className="text-xs text-muted">{t('owner.jobs.peopleApplyByWhatsappOrPhone')}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={locked} onClick={() => void save()} className={cn(`${btn} bg-brand text-white`)}>{busy ? t('owner.common.saving') : draft.isNew ? t('owner.jobs.postJob') : t('owner.jobs.saveChanges')}</button>
        <button type="button" disabled={busy} onClick={() => { setDraft(null); setProblems({}); }} className={cn(`${btn} border border-line-strong text-ink`)}>{t('owner.common.cancel')}</button>
      </div>
    </div>
  );

  return renderSection(
    <div className="space-y-4">
      {!data.canPost && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{t('owner.jobs.youCanPostJobsOnceYour')}</p>}
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-brand' : 'text-red-700'}`} role={message.kind === 'ok' ? 'status' : 'alert'}>{message.text}</p>}
      {form}
      {!draft && data.canPost && (
        atLimit
          ? <p className="text-sm text-muted">{t('owner.jobs.youHaveOpenPostsTheMost', { count: data.openLimit })}</p>
          : <button type="button" disabled={locked} onClick={() => { setDraft(emptyDraft()); setMessage(null); }} className={cn(`${btn} w-full gap-2 border border-brand text-brand sm:w-auto`)}><Plus className="h-4 w-4" /> {t('owner.jobs.postAJob')}</button>
      )}
      {data.jobs.length === 0 && !draft && <p className="text-sm text-muted">{t('owner.jobs.noJobPostsYet')}</p>}
      {data.jobs.map((job) => {
        const state = stateText(job, t);
        const canRenew = data.canPost && !job.hidden && (job.status === 'closed' || job.expired || jobDaysLeft(job.expiresAt) <= 7);
        return (
          <div key={job.id} className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium text-ink">{job.title} <span className="font-normal text-muted">· {jobTypeKeys[job.jobType] ? t(jobTypeKeys[job.jobType]) : jobTypeLabel(job.jobType)}</span></p>
              <p className={`text-xs ${state.tone}`}>{state.text}</p>
            </div>
            <p className="mt-1 text-sm text-ink-2">{job.hours}{job.salary ? ` · ${job.salary}` : ''}</p>
            {job.hidden && job.hiddenNote && <p className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{t('owner.jobs.bitesiteNote')} {job.hiddenNote}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" disabled={locked || !!draft} onClick={() => edit(job)} className={cn(`${btn} border border-line-strong text-ink`)}>{t('owner.jobs.edit')}</button>
              {canRenew && <button type="button" disabled={locked || !!draft || (atLimit && (job.status === 'closed' || job.expired))} onClick={() => act(job, 'renew')} className={cn(`${btn} border border-brand text-brand`)}>{job.status === 'closed' || job.expired ? t('owner.jobs.reopenFor30Days') : t('owner.jobs.renew30Days')}</button>}
              {job.status === 'open' && !job.expired && <button type="button" disabled={locked || !!draft} onClick={() => act(job, 'close')} className={cn(`${btn} border border-line-strong text-ink`)}>{t('common.close')}</button>}
              <button type="button" disabled={locked || !!draft} onClick={() => act(job, 'delete')} className={cn(`${btn} text-red-700 underline`)}>{t('owner.jobs.delete')}</button>
            </div>
          </div>
        );
      })}
    </div>,
  );
}
