'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const businessStatuses = ['OPEN', 'TEMPORARILY_CLOSED', 'MOVED', 'PERMANENTLY_CLOSED'] as const;

type Merchant = { name: string; slug: string; address?: string | null; business_status?: string | null; platform_status?: string | null; tagline?: string | null; description?: string | null; phone?: string | null; whatsapp?: string | null; email?: string | null; website?: string | null; instagram?: string | null; facebook?: string | null; logo_image?: string | null; cover_image?: string | null; menu_pdf_url?: string | null; operating_hours?: Record<string, string> | null };
type ChangeRequest = { id: string; changes: Record<string, string>; status: 'pending' | 'resolved' | 'rejected'; admin_notes: string | null; created_at: string };

function textValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

export default function MerchantDashboardPage() {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [saving, setSaving] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('Loading your merchant account…');
  const [requestMessage, setRequestMessage] = useState('');

  const load = useCallback(async (accessToken?: string) => {
    const currentToken = accessToken || token;
    if (!currentToken) return;
    const [profileResponse, requestsResponse] = await Promise.all([
      fetch('/api/merchant/me', { headers: { Authorization: `Bearer ${currentToken}` } }),
      fetch('/api/merchant/profile-change-requests', { headers: { Authorization: `Bearer ${currentToken}` } }),
    ]);
    const profileData = await profileResponse.json();
    const requestsData = await requestsResponse.json();
    if (!profileResponse.ok) { setMessage(profileData.error || 'Merchant account not found.'); return; }
    setMerchant(profileData.merchant);
    setRequests(requestsResponse.ok ? requestsData.requests || [] : []);
    setMessage('');
  }, [token]);

  useEffect(() => {
    let active = true;
    async function initialise() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) { if (active) setMessage('Please sign in with your merchant email first.'); return; }
      if (!active) return;
      setToken(accessToken);
      await load(accessToken);
    }
    void initialise();
    return () => { active = false; };
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !merchant) return;
    setSaving(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const operating_hours: Record<string, string> = {};
    for (const day of days) { const value = textValue(form, `hours-${day}`); if (value) operating_hours[day] = value; }
    const payload: Record<string, unknown> = Object.fromEntries(form.entries());
    for (const day of days) delete payload[`hours-${day}`];
    payload.operating_hours = operating_hours;
    const response = await fetch('/api/merchant/me', { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error || 'Could not save changes.');
    else { setMerchant(data.merchant); setMessage('Your listing changes have been saved.'); }
    setSaving(false);
  }

  async function requestControlledChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const changes = Object.fromEntries(['name', 'address', 'slug', 'business_status'].map((field) => [field, textValue(form, field)] as const).filter(([, value]) => Boolean(value)));
    if (Object.keys(changes).length === 0) { setRequestMessage('Enter at least one requested change.'); return; }
    setRequesting(true); setRequestMessage('');
    const response = await fetch('/api/merchant/profile-change-requests', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ changes }) });
    const data = await response.json();
    if (!response.ok) setRequestMessage(data.error || 'Could not send your request.');
    else { event.currentTarget.reset(); setRequestMessage('Your request has been sent to BiteSite for review.'); await load(); }
    setRequesting(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setToken(null);
    setMerchant(null);
    setRequests([]);
    setMessage('You have been signed out.');
  }

  const profileChecklist = merchant ? [
    { label: 'Add a short description', complete: Boolean(merchant.description?.trim()), anchor: 'description' },
    { label: 'Add a contact method', complete: Boolean(merchant.phone || merchant.whatsapp || merchant.email), anchor: 'contact' },
    { label: 'Add opening hours', complete: Boolean(merchant.operating_hours && Object.keys(merchant.operating_hours).length > 0), anchor: 'hours' },
    { label: 'Add a cover or logo image', complete: Boolean(merchant.cover_image || merchant.logo_image), anchor: 'images' },
    { label: 'Add your menu link', complete: Boolean(merchant.menu_pdf_url), anchor: 'menu' },
  ] : [];
  const completedChecklist = profileChecklist.filter((item) => item.complete).length;
  const completionPercent = profileChecklist.length > 0
    ? Math.round((completedChecklist / profileChecklist.length) * 100)
    : 0;

  if (!merchant) return <main className="min-h-screen bg-[#FAFBF7] px-4 py-20"><div className="mx-auto max-w-2xl rounded-2xl border border-[#DDE5DC] bg-white p-8 shadow-sm"><h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant dashboard</h1><p className="mt-6 text-sm text-[#6B6560]">{message}</p>{message.includes('sign in') && <Link href="/merchant/login" className="mt-4 inline-block text-sm text-emerald-700 underline">Merchant login</Link>}</div></main>;

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-12 sm:py-20"><div className="mx-auto max-w-3xl space-y-6">
    <header className="rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#6B6560]">Merchant dashboard</p><h1 className="mt-1 font-serif text-3xl text-[#2C3E2D]">{merchant.name}</h1></div><button type="button" onClick={() => void signOut()} className="shrink-0 rounded-full border border-[#DDE5DC] px-3 py-1.5 text-xs font-medium text-[#6B6560] transition hover:border-emerald-700 hover:text-emerald-700">Sign out</button></div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#6B6560]"><a className="text-emerald-700 underline" href={`/store/${merchant.slug}`}>View public listing</a><Link href="/merchant/stories" className="text-emerald-700 underline">Submit or manage Stories</Link><span>Listing: {merchant.platform_status || 'PUBLISHED'}</span><span>Business: {merchant.business_status || 'OPEN'}</span></div></header>
    <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-6 shadow-sm" aria-labelledby="profile-progress-heading"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="profile-progress-heading" className="font-semibold text-[#2C3E2D]">Make your listing useful to customers</h2><p className="mt-1 text-sm text-[#6B6560]">Complete the essentials so visitors can find, trust, and contact you.</p></div><span className="text-sm font-semibold text-emerald-800">{completedChecklist}/{profileChecklist.length} complete</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent} aria-label={`Profile ${completionPercent}% complete`}><div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${completionPercent}%` }} /></div><ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{profileChecklist.map(item => <li key={item.anchor}>{item.complete ? <span className="text-emerald-800">✓ {item.label}</span> : <a href={`#${item.anchor}`} className="text-emerald-800 underline underline-offset-2">○ {item.label}</a>}</li>)}</ul></section>
    <form id="listing-form" onSubmit={save} className="rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8"><div><h2 className="font-serif text-2xl text-[#2C3E2D]">Update your listing</h2><p className="mt-1 text-sm text-[#6B6560]">These details update your public BiteSite page directly.</p></div><div className="mt-6 space-y-5">
      <label id="tagline" className="block text-sm font-medium text-[#2C3E2D]">Tagline<input name="tagline" defaultValue={merchant.tagline || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label>
      <label id="description" className="block text-sm font-medium text-[#2C3E2D]">About your restaurant<textarea name="description" defaultValue={merchant.description || ''} rows={5} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label>
      <div id="contact" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-[#2C3E2D]">Phone<input name="phone" defaultValue={merchant.phone || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">WhatsApp<input name="whatsapp" defaultValue={merchant.whatsapp || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">Email<input name="email" type="email" defaultValue={merchant.email || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">Website<input name="website" type="url" defaultValue={merchant.website || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">Instagram URL<input name="instagram" type="url" defaultValue={merchant.instagram || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">Facebook URL<input name="facebook" type="url" defaultValue={merchant.facebook || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label id="images" className="text-sm font-medium text-[#2C3E2D]">Logo image URL<input name="logo_image" type="url" defaultValue={merchant.logo_image || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">Cover image URL<input name="cover_image" type="url" defaultValue={merchant.cover_image || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label>
      </div>
      <label id="menu" className="block text-sm font-medium text-[#2C3E2D]">Menu PDF URL<input name="menu_pdf_url" type="url" defaultValue={merchant.menu_pdf_url || ''} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label>
      <fieldset id="hours"><legend className="text-sm font-medium text-[#2C3E2D]">Opening hours</legend><p className="mt-1 text-xs text-[#6B6560]">For example: 10:00 AM – 10:00 PM. Leave a day blank if closed.</p><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">{days.map(day => <label key={day} className="text-sm capitalize text-[#2C3E2D]">{day}<input name={`hours-${day}`} defaultValue={merchant.operating_hours?.[day] || ''} className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label>)}</div></fieldset>
      <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save listing'}</button>{message && <p className="text-sm text-[#6B6560]" aria-live="polite">{message}</p>}
    </div></form>
    <section className="rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8"><h2 className="font-serif text-2xl text-[#2C3E2D]">Request a controlled change</h2><p className="mt-1 text-sm text-[#6B6560]">Name, address, public URL, and business status are reviewed by BiteSite before they change.</p><form onSubmit={requestControlledChange} className="mt-5 space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-[#2C3E2D]">New restaurant name<input name="name" placeholder={merchant.name} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-[#2C3E2D]">New public URL slug<input name="slug" placeholder={merchant.slug} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label></div><label className="block text-sm font-medium text-[#2C3E2D]">New address<textarea name="address" placeholder={merchant.address || 'Full address'} rows={3} className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="block text-sm font-medium text-[#2C3E2D]">Requested business status<select name="business_status" defaultValue="" className="mt-1.5 w-full rounded-lg border border-[#DDE5DC] bg-white px-3 py-2 text-sm"><option value="">Keep current status</option>{businessStatuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label><button type="submit" disabled={requesting} className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-700 disabled:opacity-50">{requesting ? 'Sending…' : 'Send request for review'}</button>{requestMessage && <p className="text-sm text-[#6B6560]" aria-live="polite">{requestMessage}</p>}</form>{requests.length > 0 && <div className="mt-6 border-t border-[#DDE5DC] pt-5"><h3 className="text-sm font-semibold text-[#2C3E2D]">Your requests</h3><div className="mt-3 space-y-3">{requests.map(request => <article key={request.id} className="rounded-lg bg-[#F0F4EC] p-3 text-sm"><p className="font-medium capitalize text-[#2C3E2D]">{request.status}</p><p className="mt-1 text-[#6B6560]">{Object.entries(request.changes).map(([field, value]) => `${field}: ${value}`).join(' · ')}</p>{request.admin_notes && <p className="mt-2 text-[#6B6560]">BiteSite note: {request.admin_notes}</p>}</article>)}</div></div>}</section>
  </div></main>;
}
