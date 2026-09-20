'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';

type Submission = { id: string; title: string; status: string; review_notes?: string | null; created_at: string };
const labels: Record<string, string> = { pending_review: 'Pending review', draft: 'Draft', approved: 'Approved', rejected: 'Changes requested', converted: 'Published draft', archived: 'Archived' };

export default function MerchantStoriesPage() {
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' });
  const [rights, setRights] = useState(false);
  const [requestAi, setRequestAi] = useState(false);
  const [message, setMessage] = useState('Loading…');
  const [showSubmissionLink, setShowSubmissionLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverFileName, setCoverFileName] = useState('');
  const [galleryFileNames, setGalleryFileNames] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState('');
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [draftKey, setDraftKey] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) { setAuthChecked(true); setMessage('Please sign in with your merchant email first.'); return; }
    setToken(accessToken); setAuthChecked(true);
    const nextDraftKey = data.session?.user?.id ? `bitesite:merchant-story-draft:${data.session.user.id}` : null;
    setDraftKey(nextDraftKey);
    if (nextDraftKey) {
      try {
        const savedDraft = window.localStorage.getItem(nextDraftKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft) as { form?: typeof form; rights?: boolean; requestAi?: boolean };
          if (parsed.form && typeof parsed.form === 'object') setForm(current => ({ ...current, ...parsed.form }));
          if (typeof parsed.rights === 'boolean') setRights(parsed.rights);
          if (typeof parsed.requestAi === 'boolean') setRequestAi(parsed.requestAi);
          setMessage('Your saved Story draft has been restored.');
        }
      } catch {
        window.localStorage.removeItem(nextDraftKey);
      }
    }
    const response = await fetch('/api/merchant/story-submissions', { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || 'Unable to load submissions.'); return; }
    setSubmissions(result.submissions || []); setMessage('');
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    if (!draftKey || (!form.title && !form.content && !form.excerpt && !form.story_angle && !form.cover_image && !form.image_urls && !form.rights_note && !rights && !requestAi)) return;
    window.localStorage.setItem(draftKey, JSON.stringify({ form, rights, requestAi }));
  }, [draftKey, form, rights, requestAi]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !rights) return;
    setSaving(true); setMessage('');
    const response = await fetch('/api/merchant/story-submissions', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, image_urls: form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean), rights_declared: rights, ai_assistance_requested: requestAi }) });
    const result = await response.json();
    if (!response.ok) {
      const alreadyPending = response.status === 409;
      if (alreadyPending) await load();
      setMessage(alreadyPending ? 'You already have a Story awaiting review. You can view it below.' : result.error || 'Unable to submit Story.');
      setShowSubmissionLink(alreadyPending);
    }
    else { if (draftKey) window.localStorage.removeItem(draftKey); setForm({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' }); setRights(false); setRequestAi(false); setCoverFileName(''); setGalleryFileNames([]); setCoverPreview(''); setGalleryPreviews([]); await load(); setShowSubmissionLink(false); setMessage('Submitted for editorial review. You can track its status below.'); }
    setSaving(false);
  }

  async function uploadImage(file: File, gallery: boolean) {
    if (!token) return;
    const currentGalleryCount = form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length;
    if (gallery && currentGalleryCount >= 3) { setMessage('You can upload up to 3 gallery images.'); return; }
    const preview = URL.createObjectURL(file);
    if (gallery) { setGalleryFileNames(current => [...current, file.name]); setGalleryPreviews(current => [...current, preview]); } else { setCoverFileName(file.name); setCoverPreview(preview); }
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

  const formContent = <form onSubmit={submit} className="mt-6 space-y-5 rounded-2xl border border-[#DDE5DC] bg-white p-6">
    <div><label className="block text-sm font-medium text-[#2C3E2D]">Story title<input required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Example: A new weekend brunch at The Hearth Bakery" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-[#6B6560]"><span>A clear title helps readers understand the story quickly.</span><span>{form.title.length}/160</span></div></div>
    <div><label className="block text-sm font-medium text-[#2C3E2D]">Story angle <span className="font-normal">(optional)</span><input value={form.story_angle} onChange={e => setForm({ ...form, story_angle: e.target.value })} placeholder="What makes this worth sharing?" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><p className="mt-1 text-xs text-[#6B6560]">For example: a new menu, seasonal offer, opening, founder story, or community event.</p></div>
    <div><label className="block text-sm font-medium text-[#2C3E2D]">Short excerpt <span className="font-normal">(optional)</span><input maxLength={500} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder="One or two sentences for the Story card" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-[#6B6560]"><span>This may appear in previews and search results.</span><span>{form.excerpt.length}/500</span></div></div>
    <div><label className="block text-sm font-medium text-[#2C3E2D]">Facts and source material<textarea required maxLength={20000} rows={9} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Include what happened, what is offered, price, dates, location, and anything readers should know" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-[#6B6560]"><span>Specific facts help our editorial team write accurately. Do not include customer personal data, unsupported health claims, or information you do not have permission to publish.</span><span>{form.content.length}/20,000</span></div></div>
    <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950"><p className="font-medium">Need help writing?</p><p className="mt-1">You can request optional AI drafting help. Provide the facts above; an Admin may use an internal AI tool to suggest a draft. Your original text is always kept unchanged, and nothing is published automatically.</p><label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={requestAi} onChange={e => setRequestAi(e.target.checked)} className="mt-1 h-4 w-4" />Request optional AI drafting help</label></div>
    <div className="grid gap-4 sm:grid-cols-2"><div><label className="block text-sm font-medium text-[#2C3E2D]">Cover image <span className="font-normal">(optional)</span><input type="url" value={form.cover_image} onChange={e => setForm({ ...form, cover_image: e.target.value })} placeholder="Paste an image URL or upload below" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="mt-2 block text-xs text-[#6B6560]">Upload cover<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, false); e.currentTarget.value = ''; }} className="mt-1 block w-full text-xs" /></label>{coverFileName && <p className="mt-1 text-xs text-emerald-700">Selected: {coverFileName}</p>}{coverPreview && <img src={coverPreview} alt="Selected cover preview" className="mt-2 h-20 w-32 rounded border border-[#DDE5DC] object-cover" />}<p className="mt-1 text-xs text-[#6B6560]">Use a photo you own or have permission to publish.</p></div><div><label className="block text-sm font-medium text-[#2C3E2D]">Gallery images <span className="font-normal">(up to 3, optional)</span><textarea rows={3} value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} placeholder="Paste URLs, one per line, or upload below" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><label className="mt-2 block text-xs text-[#6B6560]">Upload gallery image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, true); e.currentTarget.value = ''; }} className="mt-1 block w-full text-xs" /></label>{galleryFileNames.length > 0 && <p className="mt-1 text-xs text-emerald-700">Selected: {galleryFileNames.join(', ')}</p>}{galleryPreviews.length > 0 && <div className="mt-2 flex gap-2">{galleryPreviews.map((preview, index) => <img key={`${preview}-${index}`} src={preview} alt={`Selected gallery preview ${index + 1}`} className="h-16 w-20 rounded border border-[#DDE5DC] object-cover" />)}</div>}<p className="mt-1 text-xs text-[#6B6560]">{form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length}/3 images. Only upload images you have permission to use.</p></div></div>
    <div><label className="block text-sm font-medium text-[#2C3E2D]">Permission note <span className="font-normal">(optional)</span><input value={form.rights_note} onChange={e => setForm({ ...form, rights_note: e.target.value })} placeholder="Where was permission recorded?" className="mt-1 w-full rounded-lg border border-[#DDE5DC] px-3 py-2 text-sm" /></label><p className="mt-1 text-xs text-[#6B6560]">This helps our team verify image and content rights.</p></div>
    <label className="flex items-start gap-2 text-sm text-[#6B6560]"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1 h-4 w-4" />I confirm BiteSite may use this text and these images for editorial publication.</label>
    <button disabled={saving || uploading || !rights} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Submitting…' : 'Submit for review'}</button>
  </form>;

  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-16"><div className="mx-auto max-w-3xl"><Link href="/merchant" className="text-sm text-emerald-700 underline">← Merchant dashboard</Link><h1 className="mt-5 font-serif text-3xl text-[#2C3E2D]">Submit a Story</h1><p className="mt-2 text-sm text-[#6B6560]">Share facts and photos. BiteSite will review and publish approved Stories.</p>{message && <p aria-live="polite" className="mt-4 rounded-lg bg-white p-3 text-sm text-[#6B6560]">{message}{showSubmissionLink && <Link href="#your-submissions" className="ml-2 font-medium text-emerald-700 underline">View your pending submission</Link>}</p>}{authChecked && token ? formContent : authChecked ? <div className="mt-6 rounded-2xl border border-[#DDE5DC] bg-white p-6 text-sm text-[#6B6560]">Please <Link href="/merchant/login" className="text-emerald-700 underline">sign in as a Merchant</Link> before submitting a Story.</div> : null}{authChecked && token && <section id="your-submissions" className="mt-8 scroll-mt-6"><h2 className="font-semibold text-[#2C3E2D]">Your submissions</h2><div className="mt-3 space-y-2">{submissions.map(item => <div key={item.id} className="rounded-lg border border-[#DDE5DC] bg-white p-4 text-sm"><div className="flex items-center justify-between gap-3"><span className="font-medium text-[#2C3E2D]">{item.title}</span><span className="text-[#6B6560]">{labels[item.status] || item.status}</span></div>{item.review_notes && <details className="mt-2 text-[#6B6560]"><summary className="cursor-pointer font-medium text-[#2C3E2D]">Review note</summary><p className="mt-2 whitespace-pre-wrap">{item.review_notes}</p></details>}</div>)}{submissions.length === 0 && <p className="text-sm text-[#6B6560]">No submissions yet.</p>}</div></section>}</div></main>;
}
