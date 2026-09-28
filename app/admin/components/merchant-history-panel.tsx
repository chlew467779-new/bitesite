/* bitesite/app/admin/components/merchant-history-panel.tsx */
'use client';

/**
 * Change history of one restaurant (audit trail), newest first, loaded when opened and paged by
 * revision. Shows who changed what and, where the trail keeps them, the old and new values.
 */

import { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { actorLabel } from '@/lib/merchant-history-core.mjs';

type Change = { path: string; label: string; before: string | null; after: string | null };
type Item = { id: string; revision: number; at: string; operation: string; actorType: string; actorEmail: string | null; reason: string | null; changes: Change[] };

export default function MerchantHistoryPanel({ merchantId, token }: { merchantId: string; token: string | null }) {
  const api = `/api/admin/merchants/${encodeURIComponent(merchantId)}/history`;
  const [items, setItems] = useState<Item[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (before: number | null) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(before === null ? api : `${api}?before=${before}`, { headers: { 'x-admin-token': token || '' }, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the history.'); return; }
      setItems((list) => [...(before === null ? [] : list ?? []), ...(data.data.items as Item[])]);
      setNextBefore(data.data.nextBefore as number | null);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  return (
    <details className="rounded-xl bg-white p-5 text-[#2C3E2D]" onToggle={(event) => { if ((event.target as HTMLDetailsElement).open && items === null && !loading) void load(null); }}>
      <summary className="min-h-10 cursor-pointer text-base font-semibold">Change history</summary>
      <p className="mt-1 text-xs text-[#6B6560]">Every change to this restaurant&apos;s details and status, newest first. Web address, links and photos are listed by name only.</p>
      <div className="mt-3 space-y-3">
        {items?.length === 0 && <p className="text-sm text-[#6B6560]">No changes recorded yet.</p>}
        {items?.map((item) => (
          <div key={item.id} className="rounded-lg border border-[#EEF2EC] p-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">{item.operation} <span className="font-normal text-[#6B6560]">· {actorLabel(item.actorType, item.actorEmail)}</span></p>
              <p className="text-xs text-[#6B6560]">{new Date(item.at).toLocaleString()} · rev {item.revision}</p>
            </div>
            {item.reason && <p className="mt-1 text-xs italic text-[#6B6560]">Reason: {item.reason}</p>}
            {item.changes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {item.changes.map((change) => (
                  <li key={change.path} className="break-words">
                    <span className="text-[#6B6560]">{change.label}: </span>
                    {change.before === null && change.after === null
                      ? <span>changed</span>
                      : <><span className="line-through decoration-[#9A948E]">{change.before}</span> → <span className="font-medium">{change.after}</span></>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {loading && <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />}
        {error && <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-1 underline" onClick={() => void load(items?.length ? nextBefore : null)}>Try again</button></p>}
        {nextBefore !== null && !loading && (
          <button type="button" onClick={() => void load(nextBefore)} className="inline-flex min-h-10 items-center rounded-lg border border-[#C9D6C7] px-4 text-sm">Show older changes</button>
        )}
      </div>
    </details>
  );
}
