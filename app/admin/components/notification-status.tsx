/* bitesite/app/admin/components/notification-status.tsx */
'use client';

/**
 * Review notification emails: how many wait to be sent or were given up (5 failed attempts), and
 * a "Send now" button (POST /api/admin/notifications/deliver). Sending is safe to repeat: each email
 * is claimed once under a lease.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth-context';

export default function NotificationStatus() {
  const { token } = useAuth();
  const [counts, setCounts] = useState<{ pending: number; failed: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    const response = await fetch('/api/admin/attention', { headers: { 'x-admin-token': token }, cache: 'no-store' }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (response?.ok && body?.data?.notifications) setCounts(body.data.notifications);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  const sendNow = async () => {
    if (!token || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/notifications/deliver', { method: 'POST', headers: { 'x-admin-token': token } });
      const body = await response.json().catch(() => null);
      const r = body?.data as { configured: boolean; claimed: number; sent: number; failed: number } | undefined;
      if (!response.ok || !r) setMessage(body?.error?.message || 'Could not send now. Try again later.');
      else if (!r.configured) setMessage('Email sending is not set up yet (RESEND_API_KEY, NOTIFY_FROM, ADMIN_NOTIFY_EMAIL). Notifications are kept until it is.');
      else setMessage(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed (will retry)` : ''}.`);
      await load();
    } catch {
      setMessage('Could not reach the server.');
    } finally {
      setBusy(false);
    }
  };

  if (!counts) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
      <p>Notification emails: <span className="font-semibold text-slate-100">{counts.pending}</span> waiting{counts.failed ? <>, <span className="font-semibold text-red-300">{counts.failed}</span> gave up after 5 attempts</> : null}.</p>
      <div className="flex items-center gap-3">
        {message && <span role="status" className="text-xs text-slate-400">{message}</span>}
        <button type="button" disabled={busy || counts.pending === 0} onClick={() => void sendNow()}
          className="inline-flex min-h-10 items-center rounded-lg border border-amber-500/40 px-3 font-medium text-amber-300 disabled:opacity-40">
          {busy ? 'Sending…' : 'Send now'}
        </button>
      </div>
    </div>
  );
}
