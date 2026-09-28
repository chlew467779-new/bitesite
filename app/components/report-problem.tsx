/* bitesite/app/components/report-problem.tsx */
'use client';

/**
 * "Report a problem" on public restaurant and Story pages. Collapsed by default; visitors choose
 * what is wrong and may add details and an email for follow-up. Reports go to the BiteSite team
 * (Admin Reports inbox) and never change the page by themselves. Mobile first.
 */

import { useState } from 'react';
import { REPORT_REASONS, type ReportTargetType } from '@/lib/public-report-core.mjs';

const field = 'mt-1.5 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2.5 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

export function ReportProblem({ targetType, slug }: { targetType: ReportTargetType; slug: string }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const idBase = `report-${targetType}`;

  const submit = async () => {
    if (!reason) { setError('Choose what is wrong.'); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, slug, reason, note: note.trim() || null, contactEmail: email.trim() || null, website }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error?.message || 'Could not send the report. Please try again.'); return; }
      setSent(true);
    } catch {
      setError('Could not reach BiteSite. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mx-auto max-w-xl px-4 pb-10 text-sm text-[#6B6560]">
      <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-2">Report a problem with this page</summary>
      <div className="mt-3 rounded-xl border border-[#DDE5DC] bg-white p-4 text-left text-[#2C3E2D]">
        {sent ? (
          <p role="status" className="text-emerald-800">Thank you. The BiteSite team will check it.</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <fieldset>
              <legend className="font-medium">What is wrong?</legend>
              <div className="mt-2 space-y-2">
                {REPORT_REASONS[targetType].map((option) => (
                  <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-[#EEF2EC] px-3">
                    <input type="radio" name={`${idBase}-reason`} value={option.value} checked={reason === option.value} onChange={() => { setReason(option.value); setError(''); }} className="h-4 w-4" />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${idBase}-note`} className="block font-medium">Details (optional)
              <textarea id={`${idBase}-note`} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={field} />
            </label>
            <label htmlFor={`${idBase}-email`} className="block font-medium">Your email (optional, only if we may contact you)
              <input id={`${idBase}-email`} type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={field} />
            </label>
            {/* Honeypot: hidden from people and assistive technology; bots that fill it are ignored. */}
            <div aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            </div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#2C3E2D] px-4 font-medium text-white disabled:opacity-50 sm:w-auto">{busy ? 'Sending…' : 'Send report'}</button>
          </form>
        )}
      </div>
    </details>
  );
}
