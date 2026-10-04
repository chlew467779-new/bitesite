"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SITE_FEEDBACK_MESSAGE_LIMIT, SITE_FEEDBACK_TOPICS, type SiteFeedbackTopic } from "@/lib/site-feedback-core.mjs";

/** Visitor feedback about BiteSite itself. Posts to /api/feedback; nothing is shown publicly. */

export function FeedbackForm() {
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
    if (!topic) { setError("Choose what your feedback is about."); return; }
    if (!message.trim()) { setError("Write your feedback first."); return; }
    setSending(true); setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, message, contactEmail: email || undefined, page: page ?? undefined, website: website || undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) { setError(data?.error?.message || "Your feedback could not be sent. Please try again."); return; }
      setSent(true);
    } catch {
      setError("Could not reach BiteSite. Check your connection and try again.");
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-[#DDE5DC] bg-white p-6 text-center shadow-sm sm:p-8" role="status">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#5A8F6E]" aria-hidden="true" />
        <h2 className="mt-4 text-xl font-semibold">Thank you!</h2>
        <p className="mt-2 text-sm leading-6 text-[#6B6560]">Your feedback is with the BiteSite team. It helps us make the site better for everyone.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/" className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#5A8F6E] px-6 text-sm font-medium text-white">Back to BiteSite</Link>
          <button type="button" onClick={() => { setSent(false); setTopic(null); setMessage(""); }} className="inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-[#5A8F6E] hover:bg-[#F0F4EC]">Send something else</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-2xl border border-[#DDE5DC] bg-white p-5 text-left shadow-sm sm:p-8">
      <fieldset>
        <legend className="text-sm font-semibold">What is it about?</legend>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SITE_FEEDBACK_TOPICS.map((t) => (
            <label key={t.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-sm transition-colors ${topic === t.value ? "border-[#5A8F6E] bg-[#F0F4EC] font-medium" : "border-[#DDE5DC] hover:bg-[#FAFBF7]"}`}>
              <input type="radio" name="topic" value={t.value} checked={topic === t.value} onChange={() => { setTopic(t.value); setError(""); }} className="h-4 w-4 accent-[#5A8F6E]" />
              {t.label}
            </label>
          ))}
        </div>
        {topic === "problem" && (
          <p className="mt-3 rounded-lg bg-[#FFF8E6] px-3 py-2 text-xs leading-5 text-[#7A5A12]">
            Wrong details on a restaurant page, such as its hours or phone? Use <span className="font-medium">Report a problem</span> on that restaurant&apos;s page; it reaches the right place faster.
          </p>
        )}
      </fieldset>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor="feedback-message" className="text-sm font-semibold">Your feedback</label>
          <span className={`text-xs tabular-nums ${message.length > SITE_FEEDBACK_MESSAGE_LIMIT ? "text-red-700" : "text-[#8A968B]"}`}>{message.length}/{SITE_FEEDBACK_MESSAGE_LIMIT}</span>
        </div>
        <textarea id="feedback-message" rows={5} maxLength={SITE_FEEDBACK_MESSAGE_LIMIT} value={message} onChange={(e) => { setMessage(e.target.value); setError(""); }}
          placeholder="e.g. It would help to filter restaurants that are halal."
          className="mt-1.5 block w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5 text-sm placeholder:text-[#9A948E] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20" />
      </div>

      <div>
        <label htmlFor="feedback-email" className="text-sm font-semibold">Email <span className="font-normal text-[#8A968B]">(optional)</span></label>
        <input id="feedback-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 block min-h-11 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20" />
        <p className="mt-1 text-xs text-[#6B6560]">Only if you would like us to reply. We use it for nothing else.</p>
      </div>

      {/* Honeypot: people never see or fill this. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={sending} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#5A8F6E] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#4A7A5C] disabled:opacity-60">
        {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {sending ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
