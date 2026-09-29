'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

interface Area { id: string; country: string; state: string; name: string; aliases: string[]; is_active: boolean }

const inputClass = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none';
const buttonClass = 'rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50';

export default function AreasManager() {
  const { token } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState('');
  const [name, setName] = useState('');
  const [aliases, setAliases] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editAliases, setEditAliases] = useState('');
  const [confirmDisable, setConfirmDisable] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/admin/areas', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load areas');
      setAreas(body.areas || []);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load areas');
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const save = async (method: 'POST' | 'PATCH', payload: object) => {
    if (!token) return false;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/areas', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save area');
      await load();
      setMessage('Area saved.');
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save area');
      return false;
    } finally { setBusy(false); }
  };

  const splitAliases = (value: string) => value.split(',').map((part) => part.trim()).filter(Boolean);
  const grouped = Object.groupBy(areas, (area) => area.state);

  return (
    <div className="max-w-4xl space-y-6 text-slate-200">
      <div>
        <h1 className="text-2xl font-bold text-white">Areas</h1>
        <p className="mt-1 text-sm text-slate-400">Maintain Malaysian areas used by restaurants. Names cannot be renamed or deleted.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-700 bg-red-950/40 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-400">{message}</p>}
      <form className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4" onSubmit={async (event) => {
        event.preventDefault();
        if (await save('POST', { state, name, aliases: splitAliases(aliases) })) {
          setName(''); setAliases('');
        }
      }}>
        <h2 className="font-semibold text-white">Add area</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">State<input className={inputClass} value={state} onChange={(event) => setState(event.target.value)} maxLength={60} required placeholder="Kuala Lumpur" /></label>
          <label className="space-y-1 text-sm">Area name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Taman Tun Dr Ismail" /></label>
        </div>
        <label className="block space-y-1 text-sm">Aliases, separated by commas<input className={inputClass} value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="TTDI" /></label>
        <button className={buttonClass} disabled={busy} type="submit">Add area</button>
      </form>
      {loading ? <p className="text-sm text-slate-400">Loading areas…</p> : Object.entries(grouped).map(([stateName, rows]) => (
        <section key={stateName} className="space-y-2">
          <h2 className="text-lg font-semibold text-white">{stateName} <span className="text-sm font-normal text-slate-400">({rows?.length || 0})</span></h2>
          {rows?.map((area) => (
            <div key={area.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{area.name} {!area.is_active && <span className="ml-2 text-xs text-amber-400">Inactive</span>}</p>
                  <p className="mt-1 text-sm text-slate-400">Aliases: {area.aliases.length ? area.aliases.join(', ') : 'None'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" onClick={() => { setEditing(area.id); setEditAliases(area.aliases.join(', ')); setConfirmDisable(null); }}>Edit aliases</button>
                  <button type="button" disabled={busy} className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-50" onClick={() => {
                    if (area.is_active) setConfirmDisable(area.id);
                    else void save('PATCH', { id: area.id, is_active: true });
                  }}>{area.is_active ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
              {editing === area.id && <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={async (event) => {
                event.preventDefault();
                if (await save('PATCH', { id: area.id, aliases: splitAliases(editAliases) })) setEditing(null);
              }}>
                <label className="min-w-52 flex-1 space-y-1 text-sm">Aliases, separated by commas<input className={inputClass} value={editAliases} onChange={(event) => setEditAliases(event.target.value)} /></label>
                <button className={buttonClass} disabled={busy} type="submit">Save</button>
                <button type="button" className="rounded-lg border border-slate-700 px-4 py-2 text-sm" onClick={() => setEditing(null)}>Cancel</button>
              </form>}
              {confirmDisable === area.id && <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm">
                <p>Existing merchants keep this area, but new saves using it will be rejected. Disable {area.name}?</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy} className={buttonClass} onClick={async () => { if (await save('PATCH', { id: area.id, is_active: false })) setConfirmDisable(null); }}>Confirm disable</button>
                  <button type="button" className="rounded-lg border border-slate-700 px-4 py-2" onClick={() => setConfirmDisable(null)}>Cancel</button>
                </div>
              </div>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
