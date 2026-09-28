/* bitesite/app/admin/components/merchant-slug-panel.tsx */
'use client';

/**
 * Admin web address (slug) of one restaurant. Renaming keeps every old address working as a
 * permanent redirect; an address another restaurant used before cannot be taken. Compare-and-set
 * on the address shown; an unconfirmed result is retried with the same request id.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { SLUG_RULE_TEXT, isValidSlug, normalizeSlug, type SlugState } from '@/lib/merchant-slug-core.mjs';

const input = 'mt-1 block w-full min-w-0 rounded-lg border border-[#C9D6C7] bg-white px-3 py-2 text-sm text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

export default function MerchantSlugPanel({ merchantId, token, onChanged }: {
  merchantId: string;
  token: string | null;
  onChanged?: (slug: string) => void;
}) {
  const api = `/api/admin/merchants/${encodeURIComponent(merchantId)}/slug`;
  const [state, setState] = useState<SlugState | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const unknown = useRef<{ requestId: string; slug: string; expected: string } | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(api, { headers: { 'x-admin-token': token || '' }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the web address.'); return; }
      setState(data.data as SlugState);
      setDraft((data.data as SlugState).slug);
    } catch {
      setError('Could not reach the server.');
    }
  }, [api, token]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!state || saving) return;
    const slug = normalizeSlug(draft);
    if (!isValidSlug(slug)) { setMessage({ kind: 'error', text: SLUG_RULE_TEXT }); return; }
    if (slug === state.slug && !unknown.current) { setMessage({ kind: 'ok', text: 'That is already the web address.' }); return; }
    if (!unknown.current && !window.confirm(`Change the web address to /store/${slug}? The old address /store/${state.slug} will keep working and send visitors to the new one.`)) return;
    const pending = unknown.current ?? { requestId: crypto.randomUUID(), slug, expected: state.slug };
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: JSON.stringify(pending) });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        unknown.current = pending;
        setMessage({ kind: 'error', text: 'Not confirmed. Save again to retry the same change.' });
        return;
      }
      unknown.current = null;
      if (!response.ok) {
        setMessage({ kind: 'error', text: data.error?.message || 'Not saved.' });
        if (data.error?.code === 'FIELD_CONFLICT') await load();
        return;
      }
      setMessage({ kind: 'ok', text: data.data?.status === 'noop' ? 'That is already the web address.' : 'Saved. Old links now redirect to the new address.' });
      if (data.data?.slug) onChanged?.(data.data.slug);
      await load();
    } catch {
      unknown.current = pending;
      setMessage({ kind: 'error', text: 'Could not reach the server. Save again to retry the same change.' });
    } finally {
      setSaving(false);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-1 underline" onClick={() => void load()}>Try again</button></p>;
  if (!state) return <Loader2 className="h-5 w-5 animate-spin text-amber-500" />;

  return (
    <div className="space-y-3 text-[#2C3E2D]">
      <label className="block text-sm font-medium">Web address
        <div className="mt-1 flex items-center gap-1 text-sm">
          <span className="shrink-0 text-slate-500">/store/</span>
          <input className={input} aria-label="Web address" value={draft} maxLength={64} autoCapitalize="off" autoCorrect="off" spellCheck={false}
            onChange={(event) => { setDraft(event.target.value); setMessage(null); unknown.current = null; }} disabled={saving} />
        </div>
      </label>
      <p className="text-xs text-slate-500">{SLUG_RULE_TEXT}</p>
      {state.redirects.length > 0 && (
        <p className="text-xs text-slate-500">Old addresses that redirect here: {state.redirects.map((r) => `/store/${r.slug}`).join(', ')}</p>
      )}
      <button type="button" onClick={() => void save()} disabled={saving}
        className="inline-flex min-h-10 items-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">
        {saving ? 'Saving…' : unknown.current ? 'Retry' : 'Change web address'}
      </button>
      {message && <p className={`text-sm ${message.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    </div>
  );
}
