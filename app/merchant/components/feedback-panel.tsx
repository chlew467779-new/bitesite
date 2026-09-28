'use client';

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

const STATUS_TEXT: Record<FeedbackItem['status'], string> = { new: 'Sent', read: 'Read by BiteSite', resolved: 'Resolved' };
const input = 'mt-1.5 block w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2.5 text-base text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

export function FeedbackPanel({ merchantId, getHeaders }: {
  merchantId?: string;
  getHeaders?: () => Promise<Record<string, string> | null>;
}) {
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
    if (!text) { setStatus({ kind: 'error', text: 'Write your feedback first.' }); return; }
    // An unconfirmed send is retried with the same request id, so it is never stored twice.
    const same = pending.current && pending.current.topic === topic && pending.current.message === text;
    const attempt = same && pending.current ? pending.current : { requestId: crypto.randomUUID(), topic, message: text };
    setBusy(true);
    setStatus(null);
    try {
      const headers = await getHeaders();
      if (!headers) { setStatus({ kind: 'error', text: 'Your session has ended. Sign in again, then send.' }); return; }
      const response = await fetch(api, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(attempt) });
      const body = await response.json().catch(() => null);
      if (response.status >= 500 || !body) {
        pending.current = attempt;
        setStatus({ kind: 'error', text: 'Not confirmed. Send again to retry — it will not be sent twice.' });
        return;
      }
      pending.current = null;
      if (!response.ok) { setStatus({ kind: 'error', text: body.error?.message || 'Your feedback was not sent.' }); return; }
      setMessage('');
      setStatus({ kind: 'ok', text: 'Thank you. The BiteSite team will read it; replies appear below.' });
      await load();
    } catch {
      pending.current = attempt;
      setStatus({ kind: 'error', text: 'Could not reach BiteSite. Send again to retry — it will not be sent twice.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4" aria-describedby="feedback-status">
        <div>
          <label htmlFor="feedback-topic" className="text-sm font-medium text-[#2C3E2D]">Topic</label>
          <select id="feedback-topic" value={topic} onChange={(event) => setTopic(event.target.value as FeedbackTopic)} className={input}>
            {FEEDBACK_TOPICS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="feedback-message" className="text-sm font-medium text-[#2C3E2D]">Your feedback</label>
            <span className="text-xs tabular-nums text-[#6B6560]">{message.length.toLocaleString('en-US')}/{FEEDBACK_MESSAGE_LIMIT.toLocaleString('en-US')}</span>
          </div>
          <textarea id="feedback-message" value={message} maxLength={FEEDBACK_MESSAGE_LIMIT} rows={4}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Tell us what would make BiteSite more useful for your business."
            className={`${input} placeholder:text-[#9A948E]`} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button type="submit" disabled={!FEEDBACK_SENDING_ENABLED || busy}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
            {busy ? 'Sending…' : 'Send feedback'}
          </button>
          <p id="feedback-status" className={`text-sm ${status?.kind === 'error' ? 'text-red-700' : status ? 'text-emerald-800' : 'text-xs text-[#6B6560]'}`} role={status?.kind === 'error' ? 'alert' : 'status'}>
            {FEEDBACK_SENDING_ENABLED
              ? status?.text ?? ''
              : 'Sending feedback from the dashboard is not switched on yet. Nothing you type here is sent or saved.'}
          </p>
        </div>
      </form>

      {items.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#2C3E2D]">Your recent feedback</h3>
          <ul className="mt-2 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#EEF2EC] p-3 text-sm">
                <p className="flex flex-wrap justify-between gap-2 text-xs text-[#6B6560]">
                  <span>{FEEDBACK_TOPICS.find((t) => t.value === item.topic)?.label} · {new Date(item.createdAt).toLocaleDateString()}</span>
                  <span>{STATUS_TEXT[item.status]}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[#2C3E2D]">{item.message}</p>
                {item.reply && <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-2 text-emerald-900"><span className="font-medium">BiteSite:</span> {item.reply}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
