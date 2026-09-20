'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Merchant = { name: string; slug: string; business_status?: string; platform_status?: string };

export default function MerchantDashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [message, setMessage] = useState('Loading your merchant account…');

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { if (active) setMessage('Please sign in with your merchant email first.'); return; }
      const response = await fetch('/api/merchant/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) { if (active) setMessage(data.error || 'Merchant account not found.'); return; }
      if (active) { setMerchant(data.merchant); setMessage(''); }
    }
    load();
    return () => { active = false; };
  }, []);

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-20"><div className="mx-auto max-w-2xl rounded-2xl border border-[#DDE5DC] bg-white p-8 shadow-sm"><h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant dashboard</h1>{merchant ? <div className="mt-6 space-y-3 text-sm text-[#6B6560]"><p className="text-xl font-semibold text-[#2C3E2D]">{merchant.name}</p><p>Store: <a className="text-emerald-700 underline" href={`/store/${merchant.slug}`}>/store/{merchant.slug}</a></p><p>Listing status: {merchant.platform_status || 'PUBLISHED'}</p><p>Business status: {merchant.business_status || 'OPEN'}</p></div> : <p className="mt-6 text-sm text-[#6B6560]">{message}</p>}</div></main>;
}
