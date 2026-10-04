/* bitesite/app/admin/components/merchant-links-panel.tsx */
'use client';

/**
 * Admin links for one restaurant: edit each link directly (compare-and-set on the value shown, so
 * a change made meanwhile is reported), and see the restaurant's waiting request for each link.
 * Reviewing Owner requests happens on the Change Requests page.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { availableLinkFields, LINK_PROBLEM_TEXT, linkProblem, type LinkField, type LinkRequestItem } from '@/lib/merchant-links-core.mjs';

type Links = Partial<Record<LinkField, string | null>>;
const input = 'mt-1 block w-full min-w-0 rounded-lg border border-[#C9D6C7] bg-white px-3 py-2 text-sm text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';

export default function MerchantLinksPanel({ merchantId, token }: { merchantId: string; token: string | null }) {
  const api = `/api/admin/merchants/${encodeURIComponent(merchantId)}/links`;
  const [links, setLinks] = useState<Links | null>(null);
  const [drafts, setDrafts] = useState<Partial<Record<LinkField, string>>>({});
  const [requests, setRequests] = useState<LinkRequestItem[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<Partial<Record<LinkField, { kind: 'ok' | 'error'; text: string }>>>({});
  const [saving, setSaving] = useState<LinkField | null>(null);
  const unknown = useRef<Partial<Record<LinkField, { requestId: string; url: string | null; expected: string | null }>>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(api, { headers: { 'x-admin-token': token || '' }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the links.'); return; }
      setLinks(data.data.links as Links);
      setRequests(data.data.requests as LinkRequestItem[]);
      setDrafts({});
    } catch {
      setError('Could not reach the server.');
    }
  }, [api, token]);

  useEffect(() => { void load(); }, [load]);

  const save = async (field: LinkField) => {
    if (!links || saving) return;
    const value = (drafts[field] ?? links[field] ?? '').trim();
    const problem = linkProblem(field, value);
    if (problem) { setStatus((s) => ({ ...s, [field]: { kind: 'error', text: LINK_PROBLEM_TEXT[problem] } })); return; }
    const pending = unknown.current[field] ?? { requestId: crypto.randomUUID(), url: value || null, expected: links[field] ?? null };
    setSaving(field);
    try {
      const response = await fetch(api, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' }, body: JSON.stringify({ field, ...pending }) });
      const data = await response.json().catch(() => null);
      if (response.status >= 500 || !data) {
        unknown.current[field] = pending;
        setStatus((s) => ({ ...s, [field]: { kind: 'error', text: 'Not confirmed. Save again to retry the same request.' } }));
        return;
      }
      delete unknown.current[field];
      if (!response.ok) {
        setStatus((s) => ({ ...s, [field]: { kind: 'error', text: data.error?.message || 'Not saved.' } }));
        if (response.status === 409) await load();
        return;
      }
      setLinks((current) => (current ? { ...current, [field]: pending.url } : current));
      setDrafts((d) => { const next = { ...d }; delete next[field]; return next; });
      setStatus((s) => ({ ...s, [field]: { kind: 'ok', text: 'Saved.' } }));
      void load();
    } catch {
      unknown.current[field] = pending;
      setStatus((s) => ({ ...s, [field]: { kind: 'error', text: 'Could not reach the server. Save again to retry the same request.' } }));
    } finally {
      setSaving(null);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-2 underline" onClick={() => void load()}>Try again</button></p>;
  if (!links) return <Loader2 className="h-5 w-5 animate-spin text-amber-600" />;

  return (
    <div className="space-y-4">
      {availableLinkFields(links).map(({ field, label, placeholder }) => {
        const value = drafts[field] ?? links[field] ?? '';
        const dirty = drafts[field] !== undefined && drafts[field] !== (links[field] ?? '');
        const pending = requests.find((r) => r.field === field && r.status === 'pending');
        return (
          <div key={field}>
            <label htmlFor={`admin-link-${field}`} className="block text-sm font-medium text-[#2C3E2D]">{label}</label>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input id={`admin-link-${field}`} className={input} type="url" placeholder={placeholder} value={value}
                onChange={(event) => { setDrafts((d) => ({ ...d, [field]: event.target.value })); setStatus((s) => ({ ...s, [field]: undefined })); }} />
              <button type="button" disabled={!dirty || saving !== null} onClick={() => void save(field)} className="min-h-10 rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white disabled:opacity-50">
                {saving === field ? 'Saving…' : 'Save'}
              </button>
            </div>
            {pending && <p className="mt-1 text-xs text-amber-800">Owner request waiting: {pending.proposedUrl ?? 'remove the link'} (review it on the Change Requests page; saving here replaces it)</p>}
            {status[field] && <p className={`mt-1 text-xs ${status[field]?.kind === 'ok' ? 'text-emerald-800' : 'text-red-700'}`}>{status[field]?.text}</p>}
          </div>
        );
      })}
    </div>
  );
}
