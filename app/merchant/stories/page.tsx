'use client';
import { useT, type MessageKey } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';
import { IMMUTABLE_CACHE_SECONDS } from '@/lib/media-cache.mjs';
import { merchantApiUrl, merchantPageUrl, selectedMerchantIdFromSearch } from '@/lib/merchant-context-url.mjs';

import { merchantSubmissionLabel } from '@/lib/story-submission-core.mjs';

type Submission = { id: string; title: string; status: string; review_notes?: string | null; created_at: string; story_path?: string | null };

export default function MerchantStoriesPage() {
  const t = useT();
  const tRef = useRef(t);
  tRef.current = t;
  const submissionKeys: Record<string, MessageKey> = { "Pending review": 'owner.common.pendingReview', "Approved": 'owner.common.approved', "Changes requested": 'owner.common.changesRequested', "Not accepted": 'owner.stories.notAccepted', "With editorial team": 'owner.stories.withEditorialTeam', "Archived": 'owner.common.archived', "Published": 'owner.common.published' };
  const [token, setToken] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [form, setForm] = useState({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' });
  const [rights, setRights] = useState(false);
  const [requestAi, setRequestAi] = useState(false);
  const [message, setMessage] = useState(t('owner.stories.loading'));
  const [showSubmissionLink, setShowSubmissionLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [coverFileName, setCoverFileName] = useState('');
  const [galleryFileNames, setGalleryFileNames] = useState<string[]>([]);
  const [coverPreview, setCoverPreview] = useState('');
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  // The restaurant these Stories are for: the one selected in the URL, or the account's only one.
  const [merchantId, setMerchantId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) { setAuthChecked(true); setMessage(tRef.current('owner.stories.pleaseSignInWithYourMerchant')); return; }
    setToken(accessToken);
    const contextResponse = await fetch(merchantApiUrl('/api/merchant/me', selectedMerchantIdFromSearch(window.location.search)), { headers: { Authorization: `Bearer ${accessToken}` } });
    const context = await contextResponse.json().catch(() => ({}));
    setAuthChecked(true);
    if (!contextResponse.ok) { setMessage(context.error || tRef.current('owner.stories.unableToLoadYourRestaurant')); return; }
    const owned = Array.isArray(context.merchants) ? context.merchants : [];
    if (!context.merchant) {
      setMessage(owned.length === 0 ? tRef.current('owner.stories.noRestaurantIsLinkedToThis') : tRef.current('owner.stories.chooseARestaurantOnTheMerchant'));
      return;
    }
    const currentMerchantId = String(context.merchant.id);
    setMerchantId(currentMerchantId);
    // Drafts are kept per account and restaurant, so one restaurant's draft never appears in another's form.
    const userId = data.session?.user?.id;
    const nextDraftKey = userId ? `bitesite:merchant-story-draft:${userId}:${currentMerchantId}` : null;
    setDraftKey(nextDraftKey);
    if (nextDraftKey && userId) {
      try {
        const legacyKey = `bitesite:merchant-story-draft:${userId}`;
        // A draft saved before drafts were per restaurant moves over only when the account has
        // exactly one restaurant; with several it is left unread rather than guessed.
        if (owned.length === 1) {
          const legacyDraft = window.localStorage.getItem(legacyKey);
          if (legacyDraft && !window.localStorage.getItem(nextDraftKey)) window.localStorage.setItem(nextDraftKey, legacyDraft);
          window.localStorage.removeItem(legacyKey);
        }
        const savedDraft = window.localStorage.getItem(nextDraftKey);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft) as { form?: typeof form; rights?: boolean; requestAi?: boolean };
          if (parsed.form && typeof parsed.form === 'object') setForm(current => ({ ...current, ...parsed.form }));
          if (typeof parsed.rights === 'boolean') setRights(parsed.rights);
          if (typeof parsed.requestAi === 'boolean') setRequestAi(parsed.requestAi);
          setDraftRestored(true);
        }
      } catch {
        window.localStorage.removeItem(nextDraftKey);
      }
    }
    const response = await fetch(merchantApiUrl('/api/merchant/story-submissions', currentMerchantId), { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json();
    if (!response.ok) { setMessage(result.error || tRef.current('owner.stories.unableToLoadSubmissions')); return; }
    setSubmissions(result.submissions || []); setMessage('');
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!draftKey || (!form.title && !form.content && !form.excerpt && !form.story_angle && !form.cover_image && !form.image_urls && !form.rights_note && !rights && !requestAi)) return;
    try { window.localStorage.setItem(draftKey, JSON.stringify({ form, rights, requestAi })); }
    catch { setMessage(tRef.current('owner.stories.thisBrowserCannotSaveYourDraft')); }
  }, [draftKey, form, rights, requestAi]);

  async function checkSubmissions() {
    if (!token || !merchantId || submitting.current) return;
    submitting.current = true; setSaving(true);
    try {
      const response = await fetch(merchantApiUrl('/api/merchant/story-submissions', merchantId), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(t('owner.stories.couldNotCheckSubmissionsPleaseTry'));
      const items = (result.submissions || []) as Submission[];
      setSubmissions(items);
      const pending = items.some(item => item.status === 'pending_review');
      setShowSubmissionLink(pending); setUnconfirmed(pending);
      setMessage(pending ? t('owner.stories.aStoryIsWaitingForReview') : t('owner.stories.noStoryIsWaitingForReview'));
    } catch { setMessage(t('owner.stories.couldNotCheckSubmissionsYourDraft')); }
    finally { submitting.current = false; setSaving(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !rights || !merchantId || submitting.current || uploading || unconfirmed) return;
    submitting.current = true; setSaving(true); setMessage('');
    try {
      const response = await fetch(merchantApiUrl('/api/merchant/story-submissions', merchantId), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, image_urls: form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean), rights_declared: rights, ai_assistance_requested: requestAi }) });
      const result = await response.json();
      if (response.status >= 500) throw new Error('unconfirmed');
      if (!response.ok) {
        const alreadyPending = response.status === 409;
        setUnconfirmed(alreadyPending);
        setMessage(alreadyPending ? t('owner.stories.youAlreadyHaveAStoryAwaiting') : result.error || t('owner.stories.unableToSubmitStory'));
        setShowSubmissionLink(alreadyPending);
      } else {
        if (draftKey) window.localStorage.removeItem(draftKey);
        setForm({ title: '', excerpt: '', story_angle: '', content: '', cover_image: '', image_urls: '', rights_note: '' });
        setRights(false); setRequestAi(false); setCoverFileName(''); setGalleryFileNames([]); setCoverPreview(''); setGalleryPreviews([]); setDraftRestored(false);
        setSubmissions(items => [result.submission, ...items]);
        setShowSubmissionLink(true); setMessage(t('owner.stories.submittedForEditorialReviewYouCan'));
      }
    } catch {
      setUnconfirmed(true);
      setMessage(t('owner.stories.weCouldNotConfirmWhetherYour'));
    } finally { submitting.current = false; setSaving(false); }
  }

  async function uploadImage(file: File, gallery: boolean) {
    if (!token || !merchantId || uploading || saving) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setMessage(t('owner.stories.chooseAJpgPngOrWebp')); return; }
    const currentGalleryCount = form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length;
    if (gallery && currentGalleryCount >= 3) { setMessage(t('owner.stories.youCanUploadUpTo3')); return; }
    const preview = URL.createObjectURL(file);
    if (gallery) { setGalleryFileNames(current => [...current, file.name]); setGalleryPreviews(current => [...current, preview]); } else { setCoverFileName(file.name); setCoverPreview(preview); }
    setUploading(true); setMessage(t('owner.stories.uploading', { filename: file.name }));
    try {
      const compressed = await imageCompression(file, { maxWidthOrHeight: 1200, initialQuality: 0.75, useWebWorker: true, fileType: 'image/webp' });
      const response = await fetch(merchantApiUrl('/api/merchant/media/upload-url', merchantId), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'story', contentType: compressed.type || 'image/webp', size: compressed.size }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('owner.stories.couldNotPrepareUpload'));
      const { error } = await supabase.storage.from(result.bucket).uploadToSignedUrl(result.path, result.token, compressed, { cacheControl: IMMUTABLE_CACHE_SECONDS });
      if (error) throw error;
      const url = supabase.storage.from(result.bucket).getPublicUrl(result.path).data.publicUrl;
      setForm(current => ({ ...current, ...(gallery ? { image_urls: current.image_urls ? `${current.image_urls}\n${url}` : url } : { cover_image: url }) }));
      setMessage(t('owner.stories.uploaded', { filename: file.name }));
    } catch (error) { setMessage(t('owner.stories.text', { filename: file.name, error: error instanceof Error ? error.message : t('owner.stories.uploadFailed') })); }
    finally { setUploading(false); }
  }

  const formContent = <form onSubmit={submit} className="mt-6 rounded-[20px] border border-line bg-white p-4 sm:p-6">
    <fieldset disabled={saving || unconfirmed} className="min-w-0 space-y-5">
    <legend className="mb-3 text-lg font-semibold text-ink">{t('owner.stories.text1TellYourStory')}</legend>
    <div><label className="block text-sm font-medium text-ink">{t('owner.stories.storyTitle')}<input required maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={t('owner.stories.exampleANewWeekendBrunchAt')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-muted"><span>{t('owner.stories.aClearTitleHelpsReadersUnderstand')}</span><span>{form.title.length}/160</span></div></div>
    <div><label className="block text-sm font-medium text-ink">{t('owner.stories.storyAngle')} <span className="font-normal">{t('feedback.optional')}</span><input value={form.story_angle} onChange={e => setForm({ ...form, story_angle: e.target.value })} placeholder={t('owner.stories.whatMakesThisWorthSharing')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><p className="mt-1 text-xs text-muted">{t('owner.stories.forExampleANewMenuSeasonal')}</p></div>
    <div><label className="block text-sm font-medium text-ink">{t('owner.stories.shortExcerpt')} <span className="font-normal">{t('feedback.optional')}</span><input maxLength={500} value={form.excerpt} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder={t('owner.stories.oneOrTwoSentencesForThe')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-muted"><span>{t('owner.stories.thisMayAppearInPreviewsAnd')}</span><span>{form.excerpt.length}/500</span></div></div>
    <div><label className="block text-sm font-medium text-ink">{t('owner.stories.factsAndSourceMaterial')}<textarea required maxLength={20000} rows={9} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder={t('owner.stories.includeWhatHappenedWhatIsOffered')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><div className="mt-1 flex justify-between gap-3 text-xs text-muted"><span>{t('owner.stories.specificFactsHelpOurEditorialTeam')}</span><span>{form.content.length}/20,000</span></div></div>
    <div className="rounded-lg border border-line bg-brand-soft p-4 text-sm text-ink"><p className="font-medium">{t('owner.stories.needHelpWriting')}</p><p className="mt-1">{t('owner.stories.youCanRequestOptionalAiDrafting')}</p><label className="mt-3 flex min-h-11 items-start gap-2"><input type="checkbox" checked={requestAi} onChange={e => setRequestAi(e.target.checked)} className="mt-1 h-4 w-4" />{t('owner.stories.requestOptionalAiDraftingHelp')}</label></div>
    <h2 className="text-lg font-semibold text-ink">{t('owner.stories.text2AddPhotosOptional')}</h2>
    <p className="text-sm text-muted">{t('owner.stories.chooseJpgPngOrWebpFiles')}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2"><div><label className="block text-sm font-medium text-ink">{t('owner.stories.coverImage')} <span className="font-normal">{t('feedback.optional')}</span><input type="url" inputMode="url" value={form.cover_image} onChange={e => setForm({ ...form, cover_image: e.target.value })} placeholder={t('owner.stories.pasteAnImageUrlOrUpload')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><label className="mt-2 block text-xs text-muted">{t('owner.stories.uploadCover')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, false); e.currentTarget.value = ''; }} className="mt-1 block min-h-11 w-full min-w-0 text-base" /></label>{coverFileName && <p className="mt-1 text-xs text-brand">{t('owner.stories.selectedFiles', { filename: coverFileName })}</p>}{coverPreview && // eslint-disable-next-line @next/next/no-img-element -- selected image previews use local blob URLs
    <img src={coverPreview} alt={t('owner.stories.selectedCoverPreview')} className="mt-2 h-20 w-32 rounded border border-line object-cover" />}<p className="mt-1 text-xs text-muted">{t('owner.stories.useAPhotoYouOwnOr')}</p></div><div><label className="block text-sm font-medium text-ink">{t('owner.stories.galleryImages')} <span className="font-normal">{t('owner.stories.upTo3Optional')}</span><textarea rows={3} value={form.image_urls} onChange={e => setForm({ ...form, image_urls: e.target.value })} placeholder={t('owner.stories.pasteUrlsOnePerLineOr')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><label className="mt-2 block text-xs text-muted">{t('owner.stories.uploadGalleryImage')}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(file, true); e.currentTarget.value = ''; }} className="mt-1 block min-h-11 w-full min-w-0 text-base" /></label>{galleryFileNames.length > 0 && <p className="mt-1 text-xs text-brand">{t('owner.stories.selectedFiles', { filename: galleryFileNames.join(', ') })}</p>}{galleryPreviews.length > 0 && <div className="mt-2 flex gap-2">{galleryPreviews.map((preview, index) => // eslint-disable-next-line @next/next/no-img-element -- selected image previews use local blob URLs
    <img key={`${preview}-${index}`} src={preview} alt={t('owner.stories.selectedGalleryPreview', { number: index + 1 })} className="h-16 w-20 rounded border border-line object-cover" />)}</div>}<p className="mt-1 text-xs text-muted">{t('owner.stories.text3ImagesOnlyUploadImagesYou', { count: form.image_urls.split(/[\n,]/).map(value => value.trim()).filter(Boolean).length })}</p></div></div>
    <h2 className="text-lg font-semibold text-ink">{t('owner.stories.text3ConfirmAndSubmit')}</h2>
    <div><label className="block text-sm font-medium text-ink">{t('owner.stories.permissionNote')} <span className="font-normal">{t('feedback.optional')}</span><input value={form.rights_note} onChange={e => setForm({ ...form, rights_note: e.target.value })} placeholder={t('owner.stories.whereWasPermissionRecorded')} className="mt-1 w-full rounded-lg border border-line px-3 py-3 text-base" /></label><p className="mt-1 text-xs text-muted">{t('owner.stories.thisHelpsOurTeamVerifyImage')}</p></div>
    <label className="flex min-h-11 items-start gap-2 text-sm text-muted"><input type="checkbox" checked={rights} onChange={e => setRights(e.target.checked)} className="mt-1 h-4 w-4" />{t('owner.stories.iConfirmBitesiteMayUseThis')}</label>
    </fieldset>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:mt-5 sm:border-0 sm:p-0"><button disabled={saving || uploading || !rights || unconfirmed} className={cn(buttonClasses({ variant: 'primary', size: 'md' }), 'min-w-11 whitespace-normal', "min-h-11 w-full text-sm disabled:opacity-50 sm:w-auto")}>{saving ? t('owner.stories.submitting') : t('owner.common.submitForReview')}</button>{unconfirmed && <button type="button" disabled={saving} onClick={() => void checkSubmissions()} className={cn(buttonClasses({ variant: 'secondary', size: 'md' }), 'min-w-11 whitespace-normal', "mt-2 min-h-11 w-full border border-brand text-sm text-ink sm:ml-2 sm:mt-0 sm:w-auto")}>{t('owner.stories.checkSubmissions')}</button>}</div>
  </form>;

  return <main className="min-h-screen bg-page px-4 pb-40 pt-12 sm:pb-16"><div className="mx-auto max-w-3xl"><Link href={merchantPageUrl('/merchant', merchantId)} className="inline-flex min-h-11 items-center text-sm text-brand underline">{t('owner.stories.merchantDashboard')}</Link><h1 className="mt-5 font-extrabold tracking-[-0.02em] text-3xl text-ink">{t('owner.stories.submitAStory')}</h1><p className="mt-2 text-sm text-muted">{t('owner.stories.shareFactsAndPhotosBitesiteWill')}</p>{draftRestored && <p className="mt-3 text-sm text-brand">{t('owner.stories.yourSavedStoryDraftHasBeen')}</p>}{message && <p role="status" aria-live="polite" className="mt-4 rounded-lg bg-white p-3 text-sm text-muted">{message}{showSubmissionLink && <Link href="#your-submissions" className="ml-2 font-medium text-brand underline inline-flex min-h-11 min-w-11 items-center">{t('owner.stories.viewYourPendingSubmission')}</Link>}</p>}{authChecked && token && merchantId ? formContent : authChecked && !token ? <div className="mt-6 rounded-[20px] border border-line bg-white p-6 text-sm text-muted">{t('owner.stories.signinPrefix')} <Link href="/merchant/login" className="text-brand underline inline-flex min-h-11 min-w-11 items-center">{t('owner.stories.signInAsAMerchant')}</Link> {t('owner.stories.signinSuffix')}</div> : null}{authChecked && token && merchantId && <section id="your-submissions" className="mt-8 scroll-mt-6"><h2 className="font-semibold text-ink">{t('owner.stories.yourSubmissions')}</h2><div className="mt-3 space-y-2">{submissions.map(item => <div key={item.id} className="rounded-lg border border-line bg-white p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><span className="min-w-0 break-words font-medium text-ink">{item.title}</span><span className={item.story_path ? 'font-medium text-brand' : 'text-muted'}>{submissionKeys[merchantSubmissionLabel(item.status, item.story_path)] ? t(submissionKeys[merchantSubmissionLabel(item.status, item.story_path)]) : merchantSubmissionLabel(item.status, item.story_path)}</span></div>{item.story_path && <a href={item.story_path} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center font-medium text-brand underline">{t('owner.stories.readYourPublishedStory')}</a>}{item.review_notes && <details open={item.status === 'rejected' || item.status === 'draft'} className="mt-2 text-muted"><summary className="cursor-pointer font-medium text-ink inline-flex min-h-11 min-w-11 items-center">{t('owner.stories.reviewNote')}</summary><p className="mt-2 whitespace-pre-wrap">{item.review_notes}</p></details>}</div>)}{submissions.length === 0 && <p className="text-sm text-muted">{t('owner.stories.noSubmissionsYet')}</p>}</div></section>}</div></main>;
}
