'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Merchant = { name: string; slug: string; business_status?: string; platform_status?: string; tagline?: string | null; description?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null };

export default function MerchantDashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('Loading your merchant account…');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { if (active) setMessage('Please sign in with your merchant email first.'); return; }
      if (active) setToken(token);
      const response = await fetch('/api/merchant/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) { if (active) setMessage(data.error || 'Merchant account not found.'); return; }
      if (active) { setMerchant(data.merchant); setMessage(''); }
    }
    load();
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !merchant) return;
    setSaving(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/merchant/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Could not save changes.');
    else { setMerchant(data.merchant); setMessage('Changes saved.'); }
    setSaving(false);
  }

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-20"><div className="mx-auto max-w-2xl rounded-2xl border border-[#DDE5DC] bg-white p-8 shadow-sm"><h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant dashboard</h1>{merchant ? <><div className="mt-6 space-y-3 text-sm text-[#6B6560]"><p className="text-xl font-semibold text-[#2C3E2D]">{merchant.name}</p><p>Store: <a className="text-emerald-700 underline" href={`/store/${merchant.slug}`}>/store/{merchant.slug}</a></p><p>Listing status: {merchant.platform_status || 'PUBLISHED'}</p><p>Business status: {merchant.business_status || 'OPEN'}</p><p><a href="/merchant/stories" className="text-emerald-700 underline">Submit or manage Stories →</a></p></div><form onSubmit={save} className="mt-8 space-y-3"><h2 className="font-semibold text-[#2C3E2D]">Update your listing</h2><input name="tagline" defaultValue={merchant.tagline || ''} placeholder="Tagline" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><textarea name="description" defaultValue={merchant.description || ''} placeholder="Description" rows={4} className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><input name="phone" defaultValue={merchant.phone || ''} placeholder="Phone" className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input name="whatsapp" defaultValue={merchant.whatsapp || ''} placeholder="WhatsApp" className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input name="email" type="email" defaultValue={merchant.email || ''} placeholder="Email" className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input name="website" type="url" defaultValue={merchant.website || ''} placeholder="Website URL" className="rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></div><button disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save listing'}</button>{message && <p className="text-sm text-[#6B6560]">{message}</p>}</form></> : <p className="mt-6 text-sm text-[#6B6560]">{message}</p>}</div></main>;
}
