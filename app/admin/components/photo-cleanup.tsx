/* bitesite/app/admin/components/photo-cleanup.tsx */
'use client';

/**
 * Photo Cleanup (C6): find uploaded photos that no page, menu, Story or pending request uses any
 * more, look at them, then delete them in one click to free storage. Only photos older than 30
 * days are offered; the server checks again at the moment of deleting.
 */

import { useState } from 'react';
import { CheckCircle2, Loader2, Search, Trash2 } from 'lucide-react';
import { useAuth } from './auth-context';
import { MIN_AGE_DAYS, formatBytes } from '@/lib/photo-cleanup-core.mjs';

type Item = { bucket: string; path: string; size: number; createdAt: string; url: string };
type Scan = { totalFiles: number; totalBytes: number; unusedFiles: number; unusedBytes: number; maxPerRun: number; items: Item[] };

export default function PhotoCleanup() {
  const { token } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [busy, setBusy] = useState<'scan' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const check = async () => {
    if (!token || busy) return;
    setBusy('scan');
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/photo-cleanup', { headers: { 'x-admin-token': token }, cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.data) { setError(body?.error?.message || 'Could not check the photos.'); return; }
      setScan(body.data as Scan);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!token || busy || !scan || scan.items.length === 0) return;
    if (!window.confirm(`Delete ${scan.items.length} unused photo${scan.items.length > 1 ? 's' : ''} (${formatBytes(scan.items.reduce((n, i) => n + i.size, 0))})? This cannot be undone.`)) return;
    setBusy('delete');
    setError('');
    try {
      const response = await fetch('/api/admin/photo-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ items: scan.items.map(({ bucket, path }) => ({ bucket, path })) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) { setError(body?.error?.message || 'Not deleted.'); return; }
      const { deleted, skipped } = body.data as { deleted: number; skipped: number };
      setNotice(`Deleted ${deleted} photo${deleted === 1 ? '' : 's'}.${skipped ? ` ${skipped} were in use again and were kept.` : ''}`);
      setScan(null);
    } catch {
      setError('Could not reach the server. Check again before retrying.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">Photo Cleanup</h2>
        <p className="mt-1 text-sm text-slate-400">When a restaurant replaces a photo or an upload is abandoned, the old file stays in storage. Check to find photos that nothing on BiteSite uses any more (only ones older than {MIN_AGE_DAYS} days), look at them, then delete them to free space. Menu photos sent for typing are not included; they are deleted after use already.</p>
      </div>
      <button type="button" disabled={busy !== null} onClick={() => void check()}
        className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-medium text-slate-950 disabled:opacity-50">
        {busy === 'scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} {scan ? 'Check again' : 'Check for unused photos'}
      </button>
      {notice && <p className="flex items-center gap-2 text-sm text-emerald-300" role="status"><CheckCircle2 className="h-5 w-5" /> {notice}</p>}
      {error && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
      {scan && (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-sm text-slate-200">{scan.totalFiles.toLocaleString()} photo{scan.totalFiles === 1 ? '' : 's'} in storage ({formatBytes(scan.totalBytes)}). <strong>{scan.unusedFiles.toLocaleString()} unused</strong> ({formatBytes(scan.unusedBytes)}).</p>
          {scan.unusedFiles === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Nothing to clean up.</p>
          ) : (
            <>
              {scan.unusedFiles > scan.items.length && <p className="text-xs text-slate-400">Showing the oldest {scan.items.length}. Delete these, then check again for the rest.</p>}
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {scan.items.map((item) => (
                  <li key={`${item.bucket}/${item.path}`} className="overflow-hidden rounded-lg bg-slate-800">
                    {/* eslint-disable-next-line @next/next/no-img-element -- storage thumbnails for Admin only */}
                    <img src={item.url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                    <p className="truncate px-1 py-0.5 text-[10px] text-slate-400" title={item.path}>{new Date(item.createdAt).toLocaleDateString('en-MY')} · {formatBytes(item.size)}</p>
                  </li>
                ))}
              </ul>
              <button type="button" disabled={busy !== null} onClick={() => void remove()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50 sm:w-auto">
                {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete {scan.items.length} unused photo{scan.items.length > 1 ? 's' : ''}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
