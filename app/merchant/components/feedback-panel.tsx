'use client';
import { useT, useLang } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FEEDBACK_MESSAGE_LIMIT, FEEDBACK_TOPICS, type FeedbackItem, type FeedbackTopic } from '@/lib/merchant-feedback-core.mjs';

/**
 * Merchant Feedback to the BiteSite team.
 *
 * Destination approved by CH (2026-09-27, SYNC-052): private merchant_feedback table + Admin
 * Feedback page, replies shown here; no email yet. FEEDBACK_SENDING_ENABLED = false switches the
 * form back to sending, loading and storing nothing.
 */
export const FEEDBACK_SENDING_ENABLED = true;

const input = 'mt-1.5 block w-full rounded-lg border border-line-strong bg-white px-3 py-2.5 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function FeedbackPanel({ merchantId, getHeaders }: {
  merchantId?: string;
  getHeaders?: () => Promise<Record<string, string> | null>;
}) {
  const t = useT();
  const lang = useLang();
  const locale = lang === 'zh' ? 'zh-Hans-MY' : lang === 'ms' ? 'ms-MY' : 'en-MY';
  const topicKeys = { problem: 'owner.feedback.somethingIsWrongOrNotWorking', listing: 'owner.feedback.questionAboutMyListing', suggestion: 'owner.feedback.ideaANewFeatureOrDesign' } as const;
  const STATUS_TEXT: Record<FeedbackItem['status'], string> = { new: t('owner.feedback.sent'), read: t('owner.feedback.readByBitesite'), resolved: t('owner.feedback.resolved') };
  const api = merchantId ? `/api/merchant/restaurants/${encodeURIComponent(merchantId)}/feedback` : null;
  const [topic, setTopic] = useState<FeedbackTopic>(FEEDBACK_TOPICS[0].value);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const pending = useRef<{ requestId: string; topic: FeedbackTopic; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!FEEDBACK_SENDING_ENABLED || !api || !getHeaders) return;
    const headers = await getHeaders();
    if (!headers) return;
    const response = await fetch(api, { headers, cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && Array.isArray(body?.data)) setItems(body.data as FeedbackItem[]);
  }, [api, getHeaders]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!FEEDBACK_SENDING_ENABLED || !api || !getHeaders || busy) return;
    const text = message.trim();
    if (!text) { setStatus({ kind: 'error', text: t('feedback.write') }); return; }
    // An unconfirmed send is retried with the same request id, so it is never stored twice.
    const same = pending.current && pending.current.topic === topic && pending.current.message === text;
    const attempt = same && pending.current ? pending.current : { requestId: crypto.randomUUID(), topic, message: text };
    setBusy(true);
    setStatus(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setStatus({ kind: 'error', text: t('owner.feedback.yourSessionHasEndedSignIn') }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(attempt) });
      const body = await response.json().catch(() => null);
      if (response.status >= 500 || !body) {
        pending.current = attempt;
        setStatus({ kind: 'error', text: t('owner.feedback.notConfirmedSendAgainToRetry') });
        return;
      }
      pending.current = null;
      if (!response.ok) { setStatus({ kind: 'error', text: body.error?.message || t('owner.feedback.yourFeedbackWasNotSent') }); return; }
      setMessage('');
      setStatus({ kind: 'ok', text: t('owner.feedback.thankYouTheBitesiteTeamWill') });
      await load();
    } catch {
      pending.current = attempt;
      setStatus({ kind: 'error', text: t('owner.feedback.couldNotReachBitesiteSendAgain') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="feedback-status">
        <div>
          <label htmlFor="feedback-topic" className="text-sm font-medium text-ink">{t('owner.feedback.topic')}</label>
          <select id="feedback-topic" value={topic} onChange={(event) => setTopic(event.target.value as FeedbackTopic)} className={input}>
            {FEEDBACK_TOPICS.map((item) => <option key={item.value} value={item.value}>{t(topicKeys[item.value])}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="feedback-message" className="text-sm font-medium text-ink">{t('feedback.message')}</label>
            <span className="text-xs tabular-nums text-muted">{message.length.toLocaleString('en-US')}/{FEEDBACK_MESSAGE_LIMIT.toLocaleString('en-US')}</span>
          </div>
          <textarea id="feedback-message" value={message} maxLength={FEEDBACK_MESSAGE_LIMIT} rows={4}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('owner.feedback.tellUsWhatWouldMakeBitesite')}
            className={`${input} placeholder:text-muted`} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={!FEEDBACK_SENDING_ENABLED || busy}
            className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'min-w-11 whitespace-normal', "inline-flex min-h-11 w-full items-center justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto")}>
            {busy ? t('owner.common.sending') : t('feedback.send')}
          </button>
          <p id="feedback-status" className={`text-sm ${status?.kind === 'error' ? 'text-red-700' : status ? 'text-brand' : 'text-xs text-muted'}`} role={status?.kind === 'error' ? 'alert' : 'status'}>
            {FEEDBACK_SENDING_ENABLED
              ? status?.text ?? ''
              : t('owner.feedback.sendingFeedbackFromTheDashboardIs')}
          </p>
        </div>
      </form>

      {items.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink">{t('owner.feedback.yourRecentFeedback')}</h3>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-line p-3 text-sm">
                <p className="flex flex-wrap justify-between gap-2 text-xs text-muted">
                  <span>{t(topicKeys[item.topic])} · {new Date(item.createdAt).toLocaleDateString(locale)}</span>
                  <span>{STATUS_TEXT[item.status]}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-ink">{item.message}</p>
                {item.reply && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-brand-soft p-2 text-brand"><span className="font-medium">{t('owner.feedback.bitesite')}</span> {item.reply}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
