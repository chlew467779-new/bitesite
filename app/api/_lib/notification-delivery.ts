/* bitesite/app/api/_lib/notification-delivery.ts */

/**
 * Deliver outbox rows (public.merchant_notifications) by email. The database hands out rows under
 * a lease (merchant_notification_claim, SKIP LOCKED) and records each result
 * (merchant_notification_finish), so parallel runs never send one row twice and failures retry
 * later (at most 5 attempts). Owner rows go to the active Owner's account email (Auth admin
 * lookup); Admin rows go to ADMIN_NOTIFY_EMAIL. Without a configured provider nothing is claimed.
 *
 * Lives under app/api/ because it uses the service-role client (scripts/check-service-role-usage.mjs).
 */

import 'server-only';
import { after } from 'next/server';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { getSiteUrl } from '@/lib/site-url';
import { notificationEmail, notificationProvider, siteErrorEmail, type ClaimedNotification, type NotificationProvider } from '@/lib/notification-content.mjs';
import { smtpSend } from '@/app/api/_lib/smtp-send';

export type DeliveryReport = { configured: boolean; claimed: number; sent: number; failed: number };

async function recipientFor(n: ClaimedNotification): Promise<string | null> {
  if (n.audience === 'admin') return process.env.ADMIN_NOTIFY_EMAIL?.trim() || null;
  if (!n.ownerUserId) return null;
  const { data, error } = await supabase.auth.admin.getUserById(n.ownerUserId);
  if (error || !data.user?.email) return null;
  return data.user.email;
}

async function send(provider: NotificationProvider, to: string, subject: string, text: string): Promise<string | null> {
  if (provider.kind === 'log') {
    console.info('[notify:log]', JSON.stringify({ to, subject }));
    return null;
  }
  if (provider.kind === 'smtp') return smtpSend(provider, to, subject, text);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: provider.from, to: [to], subject, text }),
  }).catch(() => null);
  if (!response) return 'provider unreachable';
  if (!response.ok) return `provider HTTP ${response.status}`;
  return null;
}

const ERROR_EMAILS_PER_HOUR = 10;
const errorEmails = globalThis as typeof globalThis & { __bitesiteErrorEmails?: number[] };

/** True when a provider and ADMIN_NOTIFY_EMAIL are set, so site errors can be emailed. */
export function siteErrorEmailEnabled() {
  return notificationProvider(process.env) !== null && !!process.env.ADMIN_NOTIFY_EMAIL?.trim();
}

/** Email the site owner about a new (or returning) kind of error; at most 10 per hour per server. */
export async function emailSiteError(input: { source: string; message: string; page: string | null; reopened: boolean }): Promise<string | null> {
  const provider = notificationProvider(process.env);
  const to = process.env.ADMIN_NOTIFY_EMAIL?.trim();
  if (!provider || !to) return 'not configured';
  const now = Date.now();
  const sent = (errorEmails.__bitesiteErrorEmails ??= []).filter((t) => now - t < 3_600_000);
  errorEmails.__bitesiteErrorEmails = sent;
  if (sent.length >= ERROR_EMAILS_PER_HOUR) return 'hourly limit';
  sent.push(now);
  const email = siteErrorEmail(input, getSiteUrl());
  return send(provider, to, email.subject, email.text);
}

/**
 * Send the outbox right after the response (review submitted / decided, details request decided),
 * so emails go out without a scheduler. Does nothing when no provider is configured.
 */
export function deliverSoon() {
  after(async () => {
    try {
      await deliverNotifications();
    } catch (error) {
      console.error('notification delivery after response failed:', error instanceof Error ? error.message : error);
    }
  });
}

export async function deliverNotifications(limit = 20): Promise<DeliveryReport> {
  const provider = notificationProvider(process.env);
  if (!provider) return { configured: false, claimed: 0, sent: 0, failed: 0 };
  const { data, error } = await supabase.rpc('merchant_notification_claim', { p_limit: limit });
  if (error) throw new Error(`merchant_notification_claim failed: ${error.message}`);
  const rows = (data ?? []) as ClaimedNotification[];
  const siteUrl = getSiteUrl();
  let sent = 0;
  let failed = 0;
  for (const n of rows) {
    const email = notificationEmail(n, siteUrl);
    const to = email ? await recipientFor(n) : null;
    const problem = !email ? 'unknown kind' : !to ? 'no recipient' : await send(provider, to, email.subject, email.text);
    const { error: finishError } = await supabase.rpc('merchant_notification_finish', { p_id: n.id, p_ok: problem === null, p_error: problem });
    if (finishError) console.error('merchant_notification_finish failed:', finishError.message);
    if (problem === null) sent += 1; else failed += 1;
  }
  return { configured: true, claimed: rows.length, sent, failed };
}
