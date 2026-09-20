'use client';

import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MerchantLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/merchant` },
    });
    if (authError) setError(authError.message);
    else setSent(true);
    setLoading(false);
  }

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-20"><div className="mx-auto max-w-md rounded-2xl border border-[#DDE5DC] bg-white p-8 shadow-sm"><h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant sign in</h1><p className="mt-2 text-sm text-[#6B6560]">Use your email to receive a secure BiteSite magic link.</p>{sent ? <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">Check your inbox for the sign-in link. You can close this page after opening it.</div> : <form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-medium text-[#2C3E2D]">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 w-full rounded-lg border border-[#C9D6C7] px-3 py-2.5" autoComplete="email" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={loading} className="w-full rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{loading ? 'Sending…' : 'Email me a magic link'}</button></form>}</div></main>;
}
