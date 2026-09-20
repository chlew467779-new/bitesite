'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type Submission = { id: string; title: string; status: string; review_notes?: string | null; created_at: string };

const labels: Record<string, string> = { pending_review: 'Pending review', draft: 'Draft', approved: 'Approved', rejected: 'Changes requested', converted: 'Published draft', archived: 'Archived' };

export default function MerchantStoriesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' });
  const [rights, setRights] = useState(false);
  const [message, setMessage] = useState('Loading…');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) { setMessage('Please sign in with your merchant email first.'); return; }
    setToken(accessToken);
    const response = await fetch('/api/merchant/story-submissions', { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || 'Unable to load submissions.'); return; }
    setSubmissions(result.submissions || []); setMessage('');
  }

  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !rights) return;
    setSaving(true); setMessage('');
    const response = await fetch('/api/merchant/story-submissions', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, image_urls: form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean), rights_declared: rights }) });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || 'Unable to submit Story.');
    else { setForm({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' }); setRights(false); setMessage('Submitted for editorial review.'); await load(); }
    setSaving(false);
  }

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-16"><div className="mx-auto max-w-3xl"><Link href="/merchant" className="text-sm text-emerald-700 underline">← Merchant dashboard</Link><h1 className="mt-5 font-serif text-3xl text-[#2C3E2D]">Submit a Story</h1><p className="mt-2 text-sm text-[#6B6560]">Share the facts and photos. BiteSite will review and publish approved Stories.</p>{message && <p className="mt-4 rounded-lg bg-white p-3 text-sm text-[#6B6560]">{message}</p>}<form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-[#DDE5DC] bg-white p-6"><input required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Story title" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input value={form.story_angle} onChange={e => setForm({ ...form, story_angle: e.target.value })} placeholder="Story angle (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder="Short excerpt (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><textarea required maxLength={20000} rows={9} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Facts, offer details, location, dates, and anything readers should know" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input type="url" value={form.cover_image} onChange={e => setForm({ ...form, cover_image: e.target.value })} placeholder="Cover image URL (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><textarea rows={3} value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} placeholder="Up to 3 gallery image URLs, one per line (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input value={form.rights_note} onChange={e => setForm({ ...form, rights_note: e.target.value })} placeholder="Where permission was recorded (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><label className="flex items-start gap-2 text-sm text-[#6B6560]"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1 h-4 w-4" />I confirm BiteSite may use this text and these images for editorial publication.</label><button disabled={saving || !rights} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button></form><section className="mt-8"><h2 className="font-semibold text-[#2C3E2D]">Your submissions</h2><div className="mt-3 space-y-2">{submissions.map(item => <div key={item.id} className="rounded-lg border border-[#DDE5DC] bg-white p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-[#2C3E2D]">{item.title}</span><span className="text-[#6B6560]">{labels[item.status] || item.status}</span></div>{item.review_notes && <p className="mt-2 text-[#6B6560]">Review note: {item.review_notes}</p>}</div>)}{submissions.length === 0 && <p className="text-sm text-[#6B6560]">No submissions yet.</p>}</div></section></div></main>;
}
