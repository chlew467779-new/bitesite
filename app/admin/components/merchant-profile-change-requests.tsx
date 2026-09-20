'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth } from './auth-context';

type RequestItem = {
  id: string;
  merchant_id: string;
  changes: Record<string, string>;
  status: 'pending' | 'resolved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  merchant: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export default function MerchantProfileChangeRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/merchant-profile-change-requests', { headers: { 'x-admin-token': token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load profile change requests');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load profile change requests');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function review(item: RequestItem, status: 'resolved' | 'rejected') {
    if (!token) return;
    setWorking(item.id);
    setError('');
    try {
      const response = await fetch('/api/admin/merchant-profile-change-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ id: item.id, status, admin_notes: notes[item.id] || '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not update request');
      setRequests(current => current.map(request => request.id === item.id ? { ...request, ...data.request } : request));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update request');
    } finally {
      setWorking(null);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-amber-400" /></div>;

  const pending = requests.filter(request => request.status === 'pending');
  if (pending.length === 0 && !error) return null;

  return <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5"><div className="flex items-baseline justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Profile change requests</h2><p className="mt-1 text-sm text-slate-400">Apply approved changes in the merchant editor, then mark the request resolved.</p></div><button onClick={() => void load()} className="text-xs text-amber-300 hover:text-amber-200">Refresh</button></div>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<div className="mt-4 space-y-3">{pending.map(item => { const merchant = Array.isArray(item.merchant) ? item.merchant[0] : item.merchant; return <article key={item.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{merchant?.name || 'Unknown merchant'}</p><p className="text-xs text-slate-500">/store/{merchant?.slug || 'unknown'} · {new Date(item.created_at).toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p></div><div className="flex gap-2"><button onClick={() => void review(item, 'resolved')} disabled={working === item.id} className="inline-flex items-center gap-1 rounded-lg border border-emerald-700/60 px-3 py-1.5 text-xs text-emerald-300 disabled:opacity-50"><Check className="h-3.5 w-3.5" />Resolved</button><button onClick={() => void review(item, 'rejected')} disabled={working === item.id} className="inline-flex items-center gap-1 rounded-lg border border-red-700/60 px-3 py-1.5 text-xs text-red-300 disabled:opacity-50"><X className="h-3.5 w-3.5" />Reject</button></div></div><dl className="mt-3 space-y-1 text-sm text-slate-300">{Object.entries(item.changes).map(([field, value]) => <div key={field} className="flex gap-2"><dt className="min-w-28 capitalize text-slate-500">{field.replaceAll('_', ' ')}</dt><dd>{value}</dd></div>)}</dl><label className="mt-3 block text-xs text-slate-400">Note to merchant<textarea value={notes[item.id] || ''} onChange={event => setNotes(current => ({ ...current, [item.id]: event.target.value }))} rows={2} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white" /></label></article>; })}</div></section>;
}
