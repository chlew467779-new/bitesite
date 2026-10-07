/* bitesite/app/components/report-problem.tsx */
'use client';

/**
 * "Report a problem" on public restaurant and Story pages. Collapsed by default; visitors choose
 * what is wrong and may add details and an email for follow-up. Reports go to the BiteSite team
 * (Admin Reports inbox) and never change the page by themselves. Mobile first.
 */

import { useState } from 'react';
import { useLang, useT, type MessageKey } from '@/lib/i18n';
import { REPORT_REASONS, type ReportTargetType } from '@/lib/public-report-core.mjs';

const field = 'mt-1.5 block w-full rounded-lg border border-line-strong bg-page px-3 py-2.5 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const MERCHANT_REASON_KEYS: Record<string, MessageKey> = {
  closed: 'report.closed', hours: 'report.hours', phone: 'report.contact', address: 'report.address',
  menu: 'report.menu', duplicate: 'report.duplicate', fake: 'report.fake', other: 'report.other',
};

export function ReportProblem({ targetType, slug, className = "mx-auto max-w-xl px-4 pb-10" }: { targetType: ReportTargetType; slug: string; className?: string }) {
  const t = useT();
  const lang = useLang();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const idBase = `report-${targetType}`;

  const submit = async () => {
    if (!reason) { setError(t('report.requiredReason')); return; }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, slug, reason, note: note.trim() || null, contactEmail: email.trim() || null, website }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(lang === 'en' && data?.error?.message ? data.error.message : t('report.failed')); return; }
      setSent(true);
    } catch {
      setError(t('report.connection'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className={`${className} text-sm text-ink-2`}>
      <summary className="inline-flex min-h-11 cursor-pointer items-center underline underline-offset-2">{t('report.open')}</summary>
      <div className="mt-3 rounded-xl border border-line bg-page p-4 text-left text-ink">
        {sent ? (
          <p role="status" className="text-open">{t('report.thanks')}</p>
        ) : (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <fieldset>
              <legend className="font-medium">{t('report.question')}</legend>
              <div className="mt-2 space-y-2">
                {REPORT_REASONS[targetType].map((option) => (
                  <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-lg border border-line px-3">
                    <input type="radio" name={`${idBase}-reason`} value={option.value} checked={reason === option.value} onChange={() => { setReason(option.value); setError(''); }} className="h-4 w-4" />
                    {targetType === 'merchant' && MERCHANT_REASON_KEYS[option.value] ? t(MERCHANT_REASON_KEYS[option.value]) : option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor={`${idBase}-note`} className="block font-medium">{t('report.details')}
              <textarea id={`${idBase}-note`} rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} className={field} />
            </label>
            <label htmlFor={`${idBase}-email`} className="block font-medium">{t('report.email')}
              <input id={`${idBase}-email`} type="email" inputMode="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className={field} />
            </label>
            {/* Honeypot: hidden from people and assistive technology; bots that fill it are ignored. */}
            <div aria-hidden="true" className="absolute left-[-10000px] h-px w-px overflow-hidden">
              <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></label>
            </div>
            {error && <p role="alert" className="text-soldout">{error}</p>}
            <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-brand px-4 font-semibold text-on-brand disabled:opacity-50 sm:w-auto">{busy ? t('report.sending') : t('report.send')}</button>
          </form>
        )}
      </div>
    </details>
  );
}
