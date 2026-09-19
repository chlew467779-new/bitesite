'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, CircleDollarSign, Loader2, Plus, RefreshCw } from 'lucide-react';
import { useAuth } from './auth-context';

type Cycle = { id: string; merchant_slug: string; due_at: string; effective_status: string; status: string };
type ServiceRequest = { id: string; merchant_slug: string; market: 'MY' | 'SG'; currency: string; price_amount: number; status: string; notes: string | null };

const cycleStatuses = ['active', 'due', 'overdue', 'completed', 'inactive'];
const requestStatuses = ['requested', 'paid', 'in_progress', 'completed', 'cancelled'];

export default function ContentServiceManager() {
  const { token } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [merchantSlug, setMerchantSlug] = useState('');
  const [serviceMerchant, setServiceMerchant] = useState('');
  const [market, setMarket] = useState<'MY' | 'SG'>('MY');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/content-service', { headers: { 'x-admin-token': token } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load content service data');
      setCycles(data.cycles || []);
      setRequests(data.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content service data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const create = async (type: 'cycle' | 'assisted_request') => {
    if (!token) return;
    const slug = type === 'cycle' ? merchantSlug : serviceMerchant;
    if (!slug.trim()) return;
    setWorking(true); setError('');
    try {
      const res = await fetch('/api/admin/content-service', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ type, merchant_slug: slug.trim(), market }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (type === 'cycle') setMerchantSlug(''); else setServiceMerchant('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setWorking(false);
    }
  };

  const update = async (type: 'cycle' | 'assisted_request', id: string, status: string) => {
    if (!token) return;
    setWorking(true); setError('');
    try {
      const res = await fetch('/api/admin/content-service', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ type, id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  const dueCount = cycles.filter(cycle => cycle.effective_status === 'due').length;
  const overdueCount = cycles.filter(cycle => cycle.effective_status === 'overdue').length;
  const openRequestCount = requests.filter(item => ['requested', 'paid', 'in_progress'].includes(item.status)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-white">Content Service</h1><p className="text-slate-400 text-sm mt-1">Simple 60-day Story cadence and manual Assisted Content tracking.</p></div><button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm"><RefreshCw className="w-4 h-4" />Refresh</button></div>
      {error && <div className="rounded-xl border border-red-800 bg-red-950/50 p-3 text-red-400 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4"><p className="text-xs text-amber-300">Due soon</p><p className="text-2xl font-semibold text-white mt-1">{dueCount}</p><p className="text-xs text-slate-500 mt-1">Next 14 days</p></div>
        <div className="rounded-xl border border-red-800/60 bg-red-950/20 p-4"><p className="text-xs text-red-300">Overdue</p><p className="text-2xl font-semibold text-white mt-1">{overdueCount}</p><p className="text-xs text-slate-500 mt-1">Needs follow-up</p></div>
        <div className="rounded-xl border border-sky-800/60 bg-sky-950/20 p-4"><p className="text-xs text-sky-300">Open service requests</p><p className="text-2xl font-semibold text-white mt-1">{openRequestCount}</p><p className="text-xs text-slate-500 mt-1">Requested, paid or in progress</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3"><h2 className="flex items-center gap-2 text-white font-semibold"><CalendarClock className="w-4 h-4 text-amber-400" />Start a 60-day cycle</h2><div className="flex gap-2"><input value={merchantSlug} onChange={e => setMerchantSlug(e.target.value)} placeholder="Merchant slug" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><button onClick={() => create('cycle')} disabled={working || !merchantSlug.trim()} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-sm font-medium disabled:opacity-50"><Plus className="w-4 h-4" />Start</button></div><p className="text-xs text-slate-500">The due date defaults to 60 days from today.</p></section>
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 space-y-3"><h2 className="flex items-center gap-2 text-white font-semibold"><CircleDollarSign className="w-4 h-4 text-emerald-400" />Request Assisted Content</h2><div className="flex gap-2"><input value={serviceMerchant} onChange={e => setServiceMerchant(e.target.value)} placeholder="Merchant slug" className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /><select value={market} onChange={e => setMarket(e.target.value as 'MY' | 'SG')} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-white"><option value="MY">Malaysia · RM20</option><option value="SG">Singapore · S$10</option></select><button onClick={() => create('assisted_request')} disabled={working || !serviceMerchant.trim()} className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-sm font-medium disabled:opacity-50">Add</button></div><p className="text-xs text-slate-500">Manual tracking only; no payment gateway is connected.</p></section>
      </div>
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="text-white font-semibold">Merchant content cycles</h2></div>{cycles.length === 0 ? <p className="p-5 text-sm text-slate-500">No cycles yet.</p> : <div className="divide-y divide-slate-800">{cycles.map(cycle => <div key={cycle.id} className="p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-white font-medium">{cycle.merchant_slug}</p><p className="text-xs text-slate-500">Due {new Date(cycle.due_at).toLocaleDateString('en-MY')}</p></div><div className="flex items-center gap-2"><span className="text-xs rounded-full bg-slate-800 px-2 py-1 text-slate-300">{cycle.effective_status}</span><select value={cycle.status} onChange={e => update('cycle', cycle.id, e.target.value)} disabled={working} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white">{cycleStatuses.map(status => <option key={status}>{status}</option>)}</select></div></div>)}</div>}</section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden"><div className="p-5 border-b border-slate-800"><h2 className="text-white font-semibold">Assisted Content requests</h2></div>{requests.length === 0 ? <p className="p-5 text-sm text-slate-500">No Assisted Content requests yet.</p> : <div className="divide-y divide-slate-800">{requests.map(item => <div key={item.id} className="p-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-white font-medium">{item.merchant_slug} · {item.market}</p><p className="text-xs text-slate-500">{item.currency} {item.price_amount.toFixed(2)}</p></div><div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-slate-500" /><select value={item.status} onChange={e => update('assisted_request', item.id, e.target.value)} disabled={working} className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white">{requestStatuses.map(status => <option key={status}>{status}</option>)}</select></div></div>)}</div>}</section>
    </div>
  );
}
