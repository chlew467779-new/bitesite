'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import imageCompression from 'browser-image-compression';
import {
  PROFILE_TEXT_FIELDS,
  URL_FIELDS,
  normalizeUrlInput,
  validateProfile,
  validateProfileField,
  type ProfileFieldErrors,
  type ProfileTextField,
} from '@/lib/merchant-profile-validation.mjs';
import {
  WEEK_DAYS,
  buildOperatingHours,
  hasWeekChanges,
  parseWeekForEditor,
  validateWeek,
  type DayEditorState,
  type WeekDay,
  type WeekEditorState,
} from '@/lib/merchant-hours.mjs';
import { HoursEditor } from './components/hours-editor';
import { TextField } from './components/text-field';

/**
 * Merchant self-service dashboard.
 *
 * Signed-in merchants edit the public details of the one listing their active membership points
 * to; PUT /api/merchant/me enforces the same boundary and the same field rules
 * (lib/merchant-profile-validation.mjs, lib/merchant-hours.mjs). Name, address, web address and
 * business status are managed by the BiteSite team and are shown read-only here.
 */

type Merchant = {
  name: string;
  slug: string;
  address?: string | null;
  business_status?: string | null;
  platform_status?: string | null;
  operating_hours?: Record<string, string> | null;
} & Partial<Record<ProfileTextField, string | null>>;

type Values = Record<ProfileTextField, string>;
type SaveStatus = { kind: 'idle' | 'saving' | 'saved' | 'error'; message: string };
type LoadState = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error'; message: string } | { kind: 'ready' };

const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact & links' },
  { id: 'photos', label: 'Photos' },
  { id: 'menu', label: 'Menu' },
  { id: 'hours', label: 'Opening hours' },
] as const;

const cardClass = 'scroll-mt-24 rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-sm sm:p-7';

function valuesFrom(merchant: Merchant): Values {
  return Object.fromEntries(PROFILE_TEXT_FIELDS.map((field) => [field, merchant[field] ?? ''])) as Values;
}

function statusLabel(value: string | null | undefined, fallback: string) {
  return (value || fallback).replaceAll('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const data = await response.json();
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function SectionCard({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cardClass}>
      <h2 id={`${id}-heading`} className="font-serif text-xl text-[#2C3E2D] sm:text-2xl">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-[#6B6560]">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function MerchantDashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [week, setWeek] = useState<WeekEditorState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [hoursErrors, setHoursErrors] = useState<Partial<Record<WeekDay, string>>>({});
  const [save, setSave] = useState<SaveStatus>({ kind: 'idle', message: '' });
  const [uploading, setUploading] = useState<'logo_image' | 'cover_image' | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');

  const applyMerchant = useCallback((next: Merchant) => {
    setMerchant(next);
    setValues(valuesFrom(next));
    setWeek(parseWeekForEditor(next.operating_hours));
    setFieldErrors({});
    setHoursErrors({});
  }, []);

  const loadMerchant = useCallback(async (accessToken: string) => {
    setLoad({ kind: 'loading' });
    try {
      const response = await fetch('/api/merchant/me', { headers: { Authorization: `Bearer ${accessToken}` } });
      const data = await readJson(response);
      if (response.status === 401) { setLoad({ kind: 'signed-out' }); return; }
      if (!response.ok || !data.merchant) {
        setLoad({ kind: 'error', message: typeof data.error === 'string' ? data.error : 'We could not load your merchant account.' });
        return;
      }
      applyMerchant(data.merchant as Merchant);
      setLoad({ kind: 'ready' });
    } catch {
      setLoad({ kind: 'error', message: 'We could not reach BiteSite. Check your connection and try again.' });
    }
  }, [applyMerchant]);

  useEffect(() => {
    let active = true;
    async function initialise() {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!active) return;
      if (!accessToken) { setLoad({ kind: 'signed-out' }); return; }
      setToken(accessToken);
      await loadMerchant(accessToken);
    }
    void initialise();
    return () => { active = false; };
  }, [loadMerchant]);

  const isDirty = useMemo(() => {
    if (!merchant || !values || !week) return false;
    return PROFILE_TEXT_FIELDS.some((field) => values[field] !== (merchant[field] ?? '')) || hasWeekChanges(week);
  }, [merchant, values, week]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // Stored values that would fail today's format rules: shown as a hint, never block saving.
  const legacyWarnings = useMemo(() => {
    const warnings: ProfileFieldErrors = {};
    if (!merchant || !values) return warnings;
    for (const field of PROFILE_TEXT_FIELDS) {
      const stored = merchant[field] ?? '';
      if (stored && values[field] === stored) {
        const message = validateProfileField(field, stored);
        if (message) warnings[field] = `Your saved value needs updating: ${message}`;
      }
    }
    return warnings;
  }, [merchant, values]);

  function setField(field: ProfileTextField, value: string) {
    setValues((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (save.kind === 'saved') setSave({ kind: 'idle', message: '' });
  }

  function checkField(field: ProfileTextField) {
    if (!values || !merchant) return;
    const value = URL_FIELDS.includes(field) ? normalizeUrlInput(values[field]) : values[field].trim();
    if (value !== values[field]) setValues({ ...values, [field]: value });
    const errors = validateProfile({ [field]: value }, merchant);
    setFieldErrors((current) => {
      const next = { ...current };
      if (errors[field]) next[field] = errors[field]; else delete next[field];
      return next;
    });
  }

  function setDay(day: WeekDay, next: DayEditorState) {
    setWeek((current) => (current ? { ...current, [day]: next } : current));
    setHoursErrors((current) => {
      if (!current[day]) return current;
      const copy = { ...current };
      delete copy[day];
      return copy;
    });
  }

  function copyMondayToAll() {
    setWeek((current) => {
      if (!current) return current;
      const monday = current.monday;
      return Object.fromEntries(
        WEEK_DAYS.map((day) => [day, { ...current[day], mode: monday.mode, slots: monday.slots.map((slot) => ({ ...slot })), dirty: true }]),
      ) as WeekEditorState;
    });
    setHoursErrors({});
  }

  function focusFirstError(fields: string[], days: string[]) {
    requestAnimationFrame(() => {
      const target = fields.length > 0 ? document.getElementById(`field-${fields[0]}`) : days.length > 0 ? document.getElementById(`hours-${days[0]}`) : null;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) target.focus({ preventScroll: true });
    });
  }

  async function uploadImage(field: 'logo_image' | 'cover_image', file: File) {
    if (!token) return;
    const label = field === 'logo_image' ? 'Logo' : 'Cover photo';
    setUploading(field);
    setUploadMessage(`Uploading ${label.toLowerCase()}…`);
    try {
      const compressed = await imageCompression(file, { maxWidthOrHeight: 1600, initialQuality: 0.8, useWebWorker: true, fileType: 'image/webp' });
      const response = await fetch('/api/merchant/media/upload-url', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'merchant', contentType: compressed.type || 'image/webp', size: compressed.size }),
      });
      const result = await readJson(response);
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Could not prepare the upload.');
      const { error } = await supabase.storage.from(String(result.bucket)).uploadToSignedUrl(String(result.path), String(result.token), compressed);
      if (error) throw error;
      const url = supabase.storage.from(String(result.bucket)).getPublicUrl(String(result.path)).data.publicUrl;
      setField(field, url);
      setUploadMessage(`${label} uploaded. Save your changes to publish it.`);
    } catch (error) {
      setUploadMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.');
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !merchant || !values || !week || save.kind === 'saving') return;

    const cleaned = Object.fromEntries(
      PROFILE_TEXT_FIELDS.map((field) => [field, URL_FIELDS.includes(field) ? normalizeUrlInput(values[field]) : values[field].trim()]),
    ) as Values;
    setValues(cleaned);

    const clientErrors = validateProfile(cleaned, merchant);
    const clientHoursErrors = validateWeek(week);
    if (Object.keys(clientErrors).length > 0 || Object.keys(clientHoursErrors).length > 0) {
      setFieldErrors(clientErrors);
      setHoursErrors(clientHoursErrors);
      const count = Object.keys(clientErrors).length + Object.keys(clientHoursErrors).length;
      setSave({ kind: 'error', message: `Please fix ${count === 1 ? 'the highlighted field' : `${count} highlighted fields`} before saving.` });
      focusFirstError(Object.keys(clientErrors), Object.keys(clientHoursErrors));
      return;
    }

    const payload: Record<string, unknown> = Object.fromEntries(PROFILE_TEXT_FIELDS.map((field) => [field, cleaned[field] || null]));
    if (hasWeekChanges(week)) payload.operating_hours = buildOperatingHours(week);

    setSave({ kind: 'saving', message: 'Saving…' });
    try {
      const response = await fetch('/api/merchant/me', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (response.ok && data.merchant) {
        applyMerchant(data.merchant as Merchant);
        setSave({ kind: 'saved', message: 'Saved. Your public page is updated.' });
        return;
      }
      // Keep everything the merchant typed; only report what went wrong.
      const serverErrors = (data.fieldErrors && typeof data.fieldErrors === 'object' ? data.fieldErrors : {}) as Record<string, string>;
      const nextFieldErrors: ProfileFieldErrors = {};
      const nextHoursErrors: Partial<Record<WeekDay, string>> = {};
      for (const [key, message] of Object.entries(serverErrors)) {
        if (key.startsWith('operating_hours.')) nextHoursErrors[key.slice('operating_hours.'.length) as WeekDay] = message;
        else if ((PROFILE_TEXT_FIELDS as readonly string[]).includes(key)) nextFieldErrors[key as ProfileTextField] = message;
      }
      setFieldErrors(nextFieldErrors);
      setHoursErrors(nextHoursErrors);
      if (response.status === 401) setSave({ kind: 'error', message: 'Your session has ended. Sign in again in a new tab, then save. Your changes are still here.' });
      else if (Object.keys(serverErrors).length > 0) {
        setSave({ kind: 'error', message: 'Please fix the highlighted fields before saving.' });
        focusFirstError(Object.keys(nextFieldErrors), Object.keys(nextHoursErrors));
      } else setSave({ kind: 'error', message: `${typeof data.error === 'string' ? data.error : 'Your changes could not be saved.'} Your changes are still here. Please try again.` });
    } catch {
      setSave({ kind: 'error', message: 'We could not reach BiteSite. Your changes are still here. Check your connection and try again.' });
    }
  }

  async function signOut() {
    if (isDirty && !window.confirm('You have unsaved changes. Sign out anyway?')) return;
    await supabase.auth.signOut();
    setToken(null);
    setMerchant(null);
    setValues(null);
    setWeek(null);
    setLoad({ kind: 'signed-out' });
  }

  if (load.kind !== 'ready' || !merchant || !values || !week) {
    return (
      <main className="min-h-screen bg-[#FAFBF7] px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant dashboard</h1>
          {load.kind === 'loading' && <p className="mt-4 text-sm text-[#6B6560]" aria-live="polite">Loading your merchant account…</p>}
          {load.kind === 'signed-out' && (
            <>
              <p className="mt-4 text-sm text-[#6B6560]">Please sign in with your merchant email to manage your listing.</p>
              <Link href="/merchant/login" className="mt-5 inline-block rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white">Merchant login</Link>
            </>
          )}
          {load.kind === 'error' && (
            <>
              <p className="mt-4 text-sm text-red-700" role="alert">{load.message}</p>
              {token && (
                <button type="button" onClick={() => void loadMerchant(token)} className="mt-5 rounded-lg border border-[#2C3E2D] px-4 py-2 text-sm font-medium text-[#2C3E2D]">
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      </main>
    );
  }

  const checklist = [
    { label: 'Short description', complete: Boolean(merchant.description?.trim()), anchor: 'about' },
    { label: 'A way to contact you', complete: Boolean(merchant.phone || merchant.whatsapp || merchant.email), anchor: 'contact' },
    { label: 'Cover photo or logo', complete: Boolean(merchant.cover_image || merchant.logo_image), anchor: 'photos' },
    { label: 'Menu link', complete: Boolean(merchant.menu_pdf_url), anchor: 'menu' },
    { label: 'Opening hours', complete: Boolean(merchant.operating_hours && Object.keys(merchant.operating_hours).length > 0), anchor: 'hours' },
  ];
  const completed = checklist.filter((item) => item.complete).length;
  const percent = Math.round((completed / checklist.length) * 100);

  const field = (name: ProfileTextField) => ({
    name,
    value: values[name],
    onChange: (value: string) => setField(name, value),
    onBlur: () => checkField(name),
    error: fieldErrors[name],
    warning: legacyWarnings[name],
  });

  return (
    <main className="min-h-screen bg-[#FAFBF7] pb-32">
      <header className="border-b border-[#DDE5DC] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Merchant dashboard</p>
            <h1 className="mt-1 font-serif text-2xl text-[#2C3E2D] break-words sm:text-3xl">{merchant.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#F0F4EC] px-2.5 py-1 text-[#2C3E2D]">Listing: {statusLabel(merchant.platform_status, 'Published')}</span>
              <span className="rounded-full bg-[#F0F4EC] px-2.5 py-1 text-[#2C3E2D]">Business: {statusLabel(merchant.business_status, 'Open')}</span>
            </div>
          </div>
          <nav aria-label="Merchant links" className="flex flex-wrap items-center gap-2 text-sm">
            <a href={`/store/${merchant.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">
              View public page
            </a>
            <Link href="/merchant/stories" className="rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">
              Stories
            </Link>
            <button type="button" onClick={() => void signOut()} className="rounded-lg px-3 py-2 font-medium text-[#6B6560] hover:text-[#2C3E2D]">
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-8">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#2C3E2D]">Listing checklist</h2>
              <span className="text-xs font-semibold text-emerald-800">{completed}/{checklist.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`Listing ${percent}% complete`}>
              <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {checklist.map((item) => (
                <li key={item.anchor}>
                  {item.complete
                    ? <span className="text-emerald-800">✓ {item.label}</span>
                    : <a href={`#${item.anchor}`} className="text-[#2C3E2D] underline underline-offset-2">○ {item.label}</a>}
                </li>
              ))}
            </ul>
          </div>
          <nav aria-label="Dashboard sections" className="mt-4">
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {SECTIONS.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a href={`#${section.id}`} className="block rounded-lg border border-[#DDE5DC] bg-white px-3 py-2 text-sm text-[#2C3E2D] hover:border-emerald-700 lg:border-transparent lg:bg-transparent lg:hover:bg-white">
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 hidden text-xs leading-relaxed text-[#6B6560] lg:block">
            Your restaurant name, address, web address and business status are managed by the BiteSite team.
          </p>
        </aside>

        <div className="min-w-0 space-y-6">
          <form id="listing-form" onSubmit={submit} noValidate className="space-y-6">
            <SectionCard id="about" title="About" description="A short line and description help visitors decide to come in.">
              <div className="space-y-5">
                <TextField {...field('tagline')} label="Tagline" placeholder="e.g. Kopi and kaya toast since 1968" maxLength={300} showCount />
                <TextField {...field('description')} label="About your restaurant" multiline rows={6} maxLength={10000} showCount />
              </div>
            </SectionCard>

            <SectionCard id="contact" title="Contact & links" description="All optional. Leave a field empty to hide it from your page.">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField {...field('phone')} label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+60 3-1234 5678" />
                <TextField {...field('whatsapp')} label="WhatsApp" type="tel" inputMode="tel" placeholder="+60 12-345 6789" hint="Include the country code so customers can message you." />
                <TextField {...field('email')} label="Email" type="email" inputMode="email" autoComplete="email" placeholder="hello@yourshop.my" />
                <TextField {...field('website')} label="Website" type="url" inputMode="url" placeholder="https://yourshop.my" />
                <TextField {...field('instagram')} label="Instagram page" type="url" inputMode="url" placeholder="https://instagram.com/yourshop" />
                <TextField {...field('facebook')} label="Facebook page" type="url" inputMode="url" placeholder="https://facebook.com/yourshop" />
              </div>
            </SectionCard>

            <SectionCard id="photos" title="Photos" description="JPG, PNG or WebP. Photos are resized before upload.">
              <div className="grid gap-6 sm:grid-cols-2">
                {(['cover_image', 'logo_image'] as const).map((name) => {
                  const label = name === 'cover_image' ? 'Cover photo' : 'Logo';
                  return (
                    <div key={name} className="space-y-3">
                      <div className={`overflow-hidden rounded-xl border border-[#DDE5DC] bg-[#F4F6F1] ${name === 'cover_image' ? 'aspect-[16/9]' : 'aspect-square w-28'}`}>
                        {values[name]
                          ? <img src={values[name]} alt={`${label} preview`} className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-xs text-[#6B6560]">No {label.toLowerCase()}</div>}
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-lg border border-[#2C3E2D] px-3 py-2 text-sm font-medium text-[#2C3E2D] focus-within:ring-2 focus-within:ring-emerald-700">
                        {uploading === name ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploading !== null}
                          className="sr-only"
                          onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadImage(name, file); event.currentTarget.value = ''; }}
                        />
                      </label>
                      <TextField {...field(name)} label={`${label} web address`} type="url" inputMode="url" hint="Filled in automatically when you upload." />
                    </div>
                  );
                })}
              </div>
              {uploadMessage && <p className="mt-4 text-sm text-[#6B6560]" aria-live="polite">{uploadMessage}</p>}
            </SectionCard>

            <SectionCard id="menu" title="Menu" description="Link to a menu PDF or page. Menu items and prices are managed by BiteSite for now.">
              <TextField {...field('menu_pdf_url')} label="Menu link" type="url" inputMode="url" placeholder="https://yourshop.my/menu.pdf" />
            </SectionCard>

            <SectionCard id="hours" title="Opening hours" description="Customers see these on your page. Changes to one day leave the other days as they are.">
              <HoursEditor week={week} errors={hoursErrors} onChange={setDay} onCopyMondayToAll={copyMondayToAll} />
            </SectionCard>
          </form>

          <p className="text-xs leading-relaxed text-[#6B6560] lg:hidden">
            Your restaurant name, address, web address and business status are managed by the BiteSite team.
          </p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DDE5DC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p
            aria-live="polite"
            className={`min-w-0 flex-1 text-sm ${save.kind === 'error' ? 'text-red-700' : save.kind === 'saved' ? 'text-emerald-800' : 'text-[#6B6560]'}`}
          >
            {save.message || (isDirty ? 'You have unsaved changes.' : 'All changes saved.')}
          </p>
          <button
            type="submit"
            form="listing-form"
            disabled={save.kind === 'saving' || uploading !== null || !isDirty}
            className="w-full rounded-lg bg-[#2C3E2D] px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {uploading ? 'Finish uploading first…' : save.kind === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </main>
  );
}
