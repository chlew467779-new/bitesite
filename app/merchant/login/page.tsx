"use client";

import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function MerchantLoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendLink() {
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/merchant` },
    });
    if (authError) setError(authError.message);
    else setSent(true);
    setLoading(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await sendLink();
  }

  return (
    <main className="min-h-screen bg-[#FAFBF7] px-4 py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-[#DDE5DC] bg-white p-8 shadow-sm">
        <h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant sign in</h1>
        <p className="mt-2 text-sm text-[#6B6560]">
          Use the email connected to your BiteSite merchant account. We&apos;ll send
          a secure magic link; no password is required.
        </p>

        {sent ? (
          <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800" role="status" aria-live="polite">
            <p className="font-medium">Check your inbox</p>
            <p className="mt-1 break-words">We sent a sign-in link to {email.trim()}.</p>
            <p className="mt-2 text-emerald-700">If you don&apos;t see it, check spam or wait a minute before sending again.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={() => void sendLink()} disabled={loading} className="font-medium underline underline-offset-2 disabled:opacity-50">
                {loading ? "Sending…" : "Resend link"}
              </button>
              <button type="button" onClick={() => { setSent(false); setError(""); }} className="font-medium underline underline-offset-2">
                Use a different email
              </button>
            </div>
            <p className="mt-4 border-t border-emerald-200 pt-3 text-xs text-emerald-700">
              Only emails invited by BiteSite can access a merchant dashboard.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[#2C3E2D]">
              Email
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5" autoComplete="email" />
            </label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={loading || !email.trim()} className="w-full rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {loading ? "Sending…" : "Email me a magic link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
