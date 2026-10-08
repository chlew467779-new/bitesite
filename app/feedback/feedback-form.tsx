"use client";

import { useEffect, useState } from "react";
import { useT, type MessageKey } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SITE_FEEDBACK_MESSAGE_LIMIT, SITE_FEEDBACK_TOPICS, type SiteFeedbackTopic } from "@/lib/site-feedback-core.mjs";

const TOPIC_KEYS: Record<SiteFeedbackTopic, MessageKey> = { feature: 'feedback.topic.feature', design: 'feedback.topic.design', problem: 'feedback.topic.problem', other: 'feedback.topic.other' };

/** Visitor feedback about BiteSite itself. Posts to /api/feedback; nothing is shown publicly. */

export function FeedbackForm() {
  const t = useT();
  const [topic, setTopic] = useState<SiteFeedbackTopic | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot, hidden from people
  const [page, setPage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  // Which BiteSite page the visitor came from helps us find the problem; other sites are ignored.
  useEffect(() => {
    try {
      const from = document.referrer ? new URL(document.referrer) : null;
      if (from && from.origin === window.location.origin && from.pathname !== "/feedback") setPage(from.pathname);
    } catch { /* no usable referrer */ }
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!topic) { setError(t('feedback.choose')); return; }
    if (!message.trim()) { setError(t('feedback.write')); return; }
    setSending(true); setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message, contactEmail: email || undefined, page: page ?? undefined, website: website || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error?.message || t('feedback.failed')); return; }
      setSent(true);
    } catch {
      setError(t('feedback.offline'));
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="rounded-[20px] border border-line bg-page p-6 text-center sm:p-8" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-brand" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">{t('feedback.thanks')}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{t('feedback.received')}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className={buttonClasses({ variant: 'primary', size: 'md' })}>{t('public.back')}</Link>
          <button type="button" onClick={() => { setSent(false); setTopic(null); setMessage(""); }} className={buttonClasses({ variant: 'ghost', size: 'md' })}>{t('feedback.another')}</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-[20px] border border-line bg-page p-5 text-left sm:p-8">
      <fieldset>
        <legend className="text-sm font-semibold">{t('feedback.topic')}</legend>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SITE_FEEDBACK_TOPICS.map((choice) => (
            <label key={choice.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm transition-colors ${topic === choice.value ? "border-brand bg-brand-soft font-medium" : "border-line hover:bg-page"}`}>
              <input type="radio" name="topic" value={choice.value} checked={topic === choice.value} onChange={() => { setTopic(choice.value); setError(""); }} className="h-4 w-4 accent-brand" />
              {t(TOPIC_KEYS[choice.value])}
            </label>
          ))}
        </div>
        {topic === "problem" && (
          <p className="mt-3 rounded-lg bg-[#FFF8E6] px-3 py-2 text-xs leading-5 text-[#7A5A12]">
            {t('feedback.restaurantHint')}
          </p>
        )}
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="feedback-message" className="text-sm font-semibold">{t('feedback.message')}</label>
          <span className={`text-xs tabular-nums ${message.length > SITE_FEEDBACK_MESSAGE_LIMIT ? "text-red-700" : "text-muted"}`}>{message.length}/{SITE_FEEDBACK_MESSAGE_LIMIT}</span>
        </div>
        <textarea id="feedback-message" rows={5} maxLength={SITE_FEEDBACK_MESSAGE_LIMIT} value={message} onChange={(e) => { setMessage(e.target.value); setError(""); }}
          placeholder={t('feedback.example')}
          className="mt-1.5 block w-full rounded-lg border border-line-strong px-3 py-2.5 text-base placeholder:text-muted focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
      </div>

      <div>
        <label htmlFor="feedback-email" className="text-sm font-semibold">{t('feedback.email')}{' '}<span className="font-normal text-muted">{t('feedback.optional')}</span></label>
        <input id="feedback-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block min-h-11 w-full rounded-lg border border-line-strong px-3 py-2.5 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        <p className="mt-1 text-xs text-muted">{t('feedback.emailHint')}</p>
      </div>

      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={sending} className={buttonClasses({ variant: 'primary', size: 'lg', block: true })}>
        {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {sending ? t('feedback.sending') : t('feedback.send')}
      </button>
    </form>
  );
}

export function FeedbackHeading() {
  const t = useT();
  return <div className="text-center">
    <Link href="/" className={buttonClasses({ variant: 'ghost', size: 'md' })}>{t('public.back')}</Link>
    <h1 className="mt-6 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] md:text-[40px]">{t('feedback.title')}</h1>
    <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted">{t('feedback.intro')}</p>
  </div>;
}
