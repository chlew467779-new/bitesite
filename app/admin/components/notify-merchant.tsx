'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, X } from 'lucide-react';
import { useAuth } from './auth-context';
import { mailLink, noticeMessage, waLink, type NoticeKind } from '@/lib/whatsapp-notify-core.mjs';

/**
 * After an Admin decision (CH 2026-09-30): the message to the restaurant, already written, with
 * one tap to open WhatsApp (or email) and send it. Nothing is sent automatically; CH can edit
 * the text first. Several can stack at the top of a queue; each closes with Done.
 */

export type Notice = { key: string; merchantId: string; kind: NoticeKind; note?: string | null; storySlug?: string | null; label: string };
type Contact = { name: string; slug: string | null; whatsapp: string | null; phone: string | null; ownerEmail: string | null };

function NoticeCard({ notice, onDone }: { notice: Notice; onDone: () => void }) {
  const { token } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    let live = true;
    fetch(`/api/admin/merchant-contact?merchantId=${encodeURIComponent(notice.merchantId)}`, { headers: { 'x-admin-token': token }, cache: 'no-store' })
      .then((r) => r.json().then((b) => (r.ok && b.data ? b.data as Contact : Promise.reject(new Error(b.error?.message || 'Could not load the contact.')))))
      .then((c) => {
        if (!live) return;
        const message = noticeMessage(notice.kind, { name: c.name, note: notice.note, slug: c.slug, storySlug: notice.storySlug, site: window.location.origin });
        setContact(c); setText(message.text); setSubject(message.subject);
      })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load the contact.'); });
    return () => { live = false; };
  }, [token, notice]);

  const whatsapp = contact ? waLink(contact.whatsapp, text) ?? waLink(contact.phone, text) : null;
  const email = contact ? mailLink(contact.ownerEmail, subject, text) : null;
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 2000); } catch { /* the text stays selectable */ } };

  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-slate-200">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-emerald-300">{notice.label}. Message for the restaurant:</p>
        <button type="button" onClick={onDone} aria-label="Done" className="-m-2 inline-flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
      {contact && (
        <>
          <label className="sr-only" htmlFor={`notice-${notice.key}`}>Message</label>
          <textarea id={`notice-${notice.key}`} rows={5} value={text} onChange={(e) => setText(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white focus:border-emerald-500 focus:outline-none" />
          <div className="mt-2 flex flex-wrap gap-2">
            {whatsapp
              ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-500"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              : <span className="inline-flex min-h-11 items-center text-sm text-amber-300">No WhatsApp or phone number on this restaurant.</span>}
            {email && <a href={email} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:border-slate-400"><Mail className="h-4 w-4" /> Email the owner</a>}
            <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-600 px-4 text-sm text-slate-200 hover:border-slate-400">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={onDone} className="inline-flex min-h-11 items-center rounded-lg px-4 text-sm text-slate-400 hover:text-white">Done</button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {whatsapp ? `WhatsApp opens with the restaurant's ${waLink(contact.whatsapp, 'x') ? 'WhatsApp' : 'phone'} number and this message; press send there.` : 'Copy the message and send it another way.'}
          </p>
        </>
      )}
    </div>
  );
}

/** The stack of notices at the top of a queue. */
export default function NotifyMerchant({ notices, onDone }: { notices: Notice[]; onDone: (key: string) => void }) {
  if (notices.length === 0) return null;
  return <div className="space-y-3">{notices.map((n) => <NoticeCard key={n.key} notice={n} onDone={() => onDone(n.key)} />)}</div>;
}
