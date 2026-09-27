"use client";
import { FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
export default function NewRestaurantPage() {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = '/merchant/login'; return; }
      requestId.current ??= crypto.randomUUID();
      const response = await fetch('/api/merchant/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body: JSON.stringify({ name: name.trim(), requestId: requestId.current }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not create your restaurant.');
      window.location.href = `/merchant?merchantId=${encodeURIComponent(result.merchant.id)}`;
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-12"><div className="mx-auto max-w-md rounded-2xl border bg-white p-6 sm:p-8">
    <h1 className="font-serif text-3xl text-[#2C3E2D]">Create your restaurant</h1>
    <p className="mt-3 text-sm text-[#6B6560]">Start with a private draft. You can add your profile and menu before submitting it for review.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">Restaurant name<input required maxLength={120} value={name} disabled={busy} onChange={event => { setName(event.target.value); requestId.current = null; }} className="mt-1 block w-full rounded-lg border px-3 py-2.5" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button disabled={busy || !name.trim()} className="w-full rounded-lg bg-[#2C3E2D] p-3 text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create private draft'}</button>
    </form><Link href="/merchant" className="mt-5 inline-block text-emerald-800 underline">Back to my restaurants</Link>
  </div></main>;
}
