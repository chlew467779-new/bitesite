'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
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
  const [uploading, setUploading] = useState(false);
  const [coverFileName, setCoverFileName] = useState('');
  const [galleryFileNames, setGalleryFileNames] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState('');
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);

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
    else { setForm({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' }); setRights(false); setCoverFileName(''); setGalleryFileNames([]); setCoverPreview(''); setGalleryPreviews([]); setMessage('Submitted for editorial review.'); await load(); }
    setSaving(false);
  }

  async function uploadImage(file: File, gallery: boolean) {
    if (!token) return;
    const currentGalleryCount = form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length;
    if (gallery && currentGalleryCount >= 3) { setMessage('You can upload up to 3 gallery images.'); return; }
    const preview = URL.createObjectURL(file);
    if (gallery) { setGalleryFileNames(current => [...current, file.name]); setGalleryPreviews(current => [...current, preview]); }
    else { setCoverFileName(file.name); setCoverPreview(preview); }
    setUploading(true); setMessage(`Uploading ${file.name}…`);
    try {
      const compressed = await imageCompression(file, { maxWidthOrHeight: 1200, initialQuality: 0.75, useWebWorker: true, fileType: 'image/webp' });
      const response = await fetch('/api/merchant/media/upload-url', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'story', contentType: compressed.type || 'image/webp', size: compressed.size }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not prepare upload');
      const { error } = await supabase.storage.from(result.bucket).uploadToSignedUrl(result.path, result.token, compressed);
      if (error) throw error;
      const url = supabase.storage.from(result.bucket).getPublicUrl(result.path).data.publicUrl;
      setForm(current => ({ ...current, ...(gallery ? { image_urls: current.image_urls ? `${current.image_urls}\n${url}` : url } : { cover_image: url }) }));
      setMessage(`${file.name} uploaded.`);
    } catch (error) { setMessage(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed.'}`); }
    finally { setUploading(false); }
  }

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-16"><div className="mx-auto max-w-3xl"><Link href="/merchant" className="text-sm text-emerald-700 underline">← Merchant dashboard</Link><h1 className="mt-5 font-serif text-3xl text-[#2C3E2D]">Submit a Story</h1><p className="mt-2 text-sm text-[#6B6560]">Share the facts and photos. BiteSite will review and publish approved Stories.</p>{message && <p aria-live="polite" className="mt-4 rounded-lg bg-white p-3 text-sm text-[#6B6560]">{message}</p>}<form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl border border-[#DDE5DC] bg-white p-6"><input required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Story title" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input value={form.story_angle} onChange={e => setForm({ ...form, story_angle: e.target.value })} placeholder="Story angle (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><input value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder="Short excerpt (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><textarea required maxLength={20000} rows={9} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Facts, offer details, location, dates, and anything readers should know" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><div className="grid gap-3 sm:grid-cols-2"><div><input type="url" value={form.cover_image} onChange={e => setForm({ ...form, cover_image: e.target.value })} placeholder="Cover image URL (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><label className="mt-2 block text-xs text-[#6B6560]">Or upload cover<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, false); e.currentTarget.value = ''; }} className="mt-1 block w-full text-xs" /></label>{coverFileName && <p className="mt-1 text-xs text-emerald-700">Selected: {coverFileName}</p>}{coverPreview && <img src={coverPreview} alt="Selected cover preview" className="mt-2 h-20 w-32 rounded border border-[#DDE5DC] object-cover" />}</div><div><textarea rows={3} value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} placeholder="Up to 3 gallery image URLs, one per line" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><label className="mt-2 block text-xs text-[#6B6560]">Or upload gallery image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, true); e.currentTarget.value = ''; }} className="mt-1 block w-full text-xs" /></label>{galleryFileNames.length > 0 && <p className="mt-1 text-xs text-emerald-700">Selected: {galleryFileNames.join(', ')}</p>}{galleryPreviews.length > 0 && <div className="mt-2 flex gap-2">{galleryPreviews.map((preview, index) => <img key={`${preview}-${index}`} src={preview} alt={`Selected gallery preview ${index + 1}`} className="h-16 w-20 rounded border border-[#DDE5DC] object-cover" />)}</div>}<p className="mt-1 text-xs text-[#6B6560]">{form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length}/3 gallery images</p></div></div><input value={form.rights_note} onChange={e => setForm({ ...form, rights_note: e.target.value })} placeholder="Where permission was recorded (optional)" className="w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /><label className="flex items-start gap-2 text-sm text-[#6B6560]"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1 h-4 w-4" />I confirm BiteSite may use this text and these images for editorial publication.</label><button disabled={saving || uploading || !rights} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button></form><section className="mt-8"><h2 className="font-semibold text-[#2C3E2D]">Your submissions</h2><div className="mt-3 space-y-2">{submissions.map(item => <div key={item.id} className="rounded-lg border border-[#DDE5DC] bg-white p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-[#2C3E2D]">{item.title}</span><span className="text-[#6B6560]">{labels[item.status] || item.status}</span></div>{item.review_notes && <p className="mt-2 text-[#6B6560]">Review note: {item.review_notes}</p>}</div>)}{submissions.length === 0 && <p className="text-sm text-[#6B6560]">No submissions yet.</p>}</div></section></div></main>;
}
