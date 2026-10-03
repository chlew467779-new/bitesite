'use client';

import Link from 'next/link';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ProfileImagesPanel } from '@/app/components/media/profile-images-panel';
import { ListingPanel } from './components/listing-panel';
import { ListingBasics } from './components/listing-basics';
import type { ListingState } from '@/lib/merchant-review-core.mjs';
import { MenuManager } from './components/menu-manager';
import { LinkRequests } from './components/link-requests';
import { BasicsRequests } from './components/basics-requests';
import { validateProfileField } from '@/lib/merchant-profile-validation.mjs';
import { WEEK_DAYS, type WeekDay } from '@/lib/merchant-hours.mjs';
import { merchantPageUrl, selectedMerchantIdFromSearch } from '@/lib/merchant-context-url.mjs';
import { snapshotValue, type Snapshot } from '@/lib/section-save.mjs';
import { useSectionSave, type SectionHandle, type SendSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import { DAY_CODES, HoursSection, type SectionProps } from '@/app/components/section-save/hours-section';
import { FeedbackPanel } from './components/feedback-panel';
import { StatsPanel } from './components/stats-panel';
import { MonthlySummaryCard } from './components/monthly-summary-card';
import { ClosurePanel } from './components/closure-panel';
import { TextField } from './components/text-field';
import { PhoneField } from './components/phone-field';
import { PaymentSection } from './components/payment-section';
import { createAreaRequests } from '@/lib/area-requests.mjs';

/**
 * Merchant self-service dashboard (D2-B / M1-B).
 *
 * Each section (About, Contact, Opening hours) saves on its own through the field-level save
 * contract: only changed fields are sent, with the value this page loaded as the expected
 * value, so a change made meanwhile elsewhere is reported as a conflict instead of being
 * overwritten. The cover photo and logo upload through the checked photo flow (M6b); the menu
 * (categories and dishes) is edited in MenuManager (M3a). Link changes (website, social, menu
 * link, GrabFood) are requests that the BiteSite team reviews first (LinkRequests). Managed drafts can edit listing basics until approval; pending review freezes editing. Approved profile and menu edits appear immediately.
 *
 * The restaurant is the one in the URL (`?merchant=<id>`) or the account's only one. Switching
 * restaurants asks first when anything is unsaved, never switches while a save is in flight or
 * unconfirmed, and reloads the page, so nothing from one restaurant can reach another. Section
 * editors are also keyed by account + restaurant + load, and every load checks it is still the
 * latest before using its result.
 */

type Restriction = 'none' | 'suspended' | 'archived';
type Profile = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  business_status?: string | null;
  platform_status?: string | null;
  restriction?: Restriction;
  cover_image?: string | null;
  logo_image?: string | null;
};
type Choice = { id: string; name: string; restriction: Restriction };
type Loaded = { userId: string; profile: Profile; merchants: Choice[]; fields: Record<string, Snapshot>; loadId: number };
type LoadState = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'error'; message: string } | { kind: 'no-merchant' } | { kind: 'choose'; merchants: Choice[] } | { kind: 'ready' };
type SwitchPrompt = { targetId: string; message?: string } | null;
type LeaveKind = 'stories' | 'signout' | 'new';
type LeavePrompt = { kind: LeaveKind; message?: string } | null;

function archivedLast(choices: Choice[]) {
  return [...choices].sort((a, b) => Number(a.restriction === 'archived') - Number(b.restriction === 'archived'));
}

const SECTIONS = [
  { id: 'basics', label: 'Listing basics' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact & links' },
  { id: 'photos', label: 'Photos' },
  { id: 'menu', label: 'Menu' },
  { id: 'hours', label: 'Opening hours' },
  { id: 'stats', label: 'Visitors' },
  { id: 'feedback', label: 'Feedback' },
] as const;

const cardClass = 'scroll-mt-24 rounded-2xl border border-[#DDE5DC] bg-white p-5 shadow-sm sm:p-7';

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

function errorMessage(data: Record<string, unknown>, fallback: string) {
  const error = data.error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
  return fallback;
}

function textOf(value: unknown) {
  return typeof value === 'string' ? value : '';
}

/** Safe outbound link for a stored URL (http/https only), or null. */
function safeHref(value: unknown) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function SectionCard({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className={cardClass}>
      <h2 id={`${id}-heading`} className="font-serif text-xl text-[#2C3E2D] sm:text-2xl">{title}</h2>
      {description && <p className="mt-1 text-sm text-[#6B6560]">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}


/** Text section (About or Contact): one TextField per path. */
function TextSection({ id, config, ...props }: SectionProps & { id: string; config: { path: string; label: string; field: string; placeholder?: string; multiline?: boolean; rows?: number; maxLength?: number; type?: string; inputMode?: 'text' | 'tel' | 'email' | 'url'; hint?: string }[] }) {
  const paths = useMemo(() => config.map((item) => item.path), [config]);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const [formatErrors, setFormatErrors] = useState<Record<string, string>>({});
  const { register } = props;
  useEffect(() => { register(id, section.handle); return () => register(id, null); }, [id, register, section.handle]);

  const check = (path: string, field: string) => {
    const value = textOf(section.state.draft[path]).trim();
    const message = value ? validateProfileField(field, value) : null;
    setFormatErrors((current) => {
      const next = { ...current };
      if (message) next[path] = message; else delete next[path];
      return next;
    });
  };

  const save = () => {
    const errors: Record<string, string> = {};
    for (const item of config) {
      const value = textOf(section.state.draft[item.path]).trim();
      const message = value ? validateProfileField(item.field, value) : null;
      if (message) errors[item.path] = message;
    }
    setFormatErrors(errors);
    if (Object.keys(errors).length === 0) void section.save();
  };

  return (
    <>
      <div className={id === 'about' ? 'space-y-5' : 'grid gap-5 sm:grid-cols-2'}>
        {config.map((item) => item.field === 'phone' || item.field === 'whatsapp' ? (
          <PhoneField
            key={item.path}
            name={item.field}
            label={item.label}
            value={textOf(section.state.draft[item.path])}
            onChange={(value) => {
              section.edit(item.path, value === '' ? null : value);
              setFormatErrors((current) => { const next = { ...current }; delete next[item.path]; return next; });
            }}
            onBlur={() => check(item.path, item.field)}
            error={formatErrors[item.path] ?? section.state.error?.fieldErrors?.[item.path]}
            readOnly={props.readOnly}
          />
        ) : (
          <TextField
            key={item.path}
            name={item.field}
            label={item.label}
            value={textOf(section.state.draft[item.path])}
            onChange={(value) => {
              // Empty text is saved as "no value" (null); the server trims the rest.
              section.edit(item.path, value.trim() === '' ? null : value);
              setFormatErrors((current) => { const next = { ...current }; delete next[item.path]; return next; });
            }}
            onBlur={() => check(item.path, item.field)}
            error={formatErrors[item.path] ?? section.state.error?.fieldErrors?.[item.path]}
            placeholder={item.placeholder}
            multiline={item.multiline}
            rows={item.rows}
            maxLength={item.maxLength}
            showCount={Boolean(item.maxLength)}
            type={item.type}
            inputMode={item.inputMode}
            hint={item.hint}
            readOnly={props.readOnly}
          />
        ))}
      </div>
      <SectionSaveBar
        state={section.state}
        labels={config}
        canSave={section.canSave}
        dirty={section.dirty}
        readOnly={props.readOnly}
        lastOutcome={section.lastOutcome}
        savedMessage="Saved."
        onSave={save}
        onRetry={() => void section.retry()}
        onKeepCurrent={section.chooseCurrent}
        onUseMine={section.chooseMine}
      />
    </>
  );
}

const ABOUT_FIELDS = [
  { path: 'profile.tagline', field: 'tagline', label: 'Tagline', placeholder: 'e.g. Kopi and kaya toast since 1968', maxLength: 300 },
  { path: 'profile.description', field: 'description', label: 'About your restaurant', placeholder: 'e.g. We serve family recipes and freshly brewed kopi every morning in Sungai Besi.', multiline: true, rows: 6, maxLength: 10000 },
];
const CONTACT_FIELDS = [
  { path: 'profile.phone', field: 'phone', label: 'Phone' },
  { path: 'profile.whatsapp', field: 'whatsapp', label: 'WhatsApp' },
  { path: 'profile.email', field: 'email', label: 'Email', type: 'email', inputMode: 'email' as const, placeholder: 'hello@yourshop.my' },
];

export default function MerchantDashboardPage() {
  const [areaRequests] = useState(createAreaRequests);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [data, setData] = useState<Loaded | null>(null);
  const [confirmed, setConfirmed] = useState<Record<string, Snapshot>>({});
  const [switchPrompt, setSwitchPrompt] = useState<SwitchPrompt>(null);
  const [leavePrompt, setLeavePrompt] = useState<LeavePrompt>(null);
  const [switching, setSwitching] = useState(false);
  const [listing, setListing] = useState<ListingState | null>(null);
  const [listingError, setListingError] = useState('');
  const [listingBusy, setListingBusy] = useState(false);
  const listingSeq = useRef(0);
  const handles = useRef(new Map<string, SectionHandle>());
  const loadSeq = useRef(0);
  const leaving = useRef(false);

  const statusMerchantId = data?.profile.id;
  const statusLoadId = data?.loadId;
  const onBusinessStatus = useCallback((businessStatus: string) => {
    setData((current) => {
      if (!current || current.profile.id !== statusMerchantId || current.loadId !== statusLoadId || current.profile.business_status === businessStatus) return current;
      return { ...current, profile: { ...current.profile, business_status: businessStatus } };
    });
  }, [statusMerchantId, statusLoadId]);

  const register = useCallback((id: string, handle: SectionHandle | null) => {
    if (handle) handles.current.set(id, handle); else handles.current.delete(id);
  }, []);
  const onConfirmed = useCallback((values: Record<string, Snapshot>) => setConfirmed((current) => ({ ...current, ...values })), []);

  const loadMerchant = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoad({ kind: 'loading' });
    const { data: session } = await supabase.auth.getSession();
    const accessToken = session.session?.access_token;
    const userId = session.session?.user?.id;
    if (seq !== loadSeq.current) return;
    if (!accessToken || !userId) { setLoad({ kind: 'signed-out' }); return; }
    const headers = { Authorization: `Bearer ${accessToken}` };
    try {
      const selected = selectedMerchantIdFromSearch(window.location.search);
      const meResponse = await fetch(selected ? `/api/merchant/me?merchantId=${encodeURIComponent(selected)}` : '/api/merchant/me', { headers, cache: 'no-store' });
      const me = await readJson(meResponse);
      if (seq !== loadSeq.current) return;
      if (meResponse.status === 401) { setLoad({ kind: 'signed-out' }); return; }
      if (!meResponse.ok) { setLoad({ kind: 'error', message: errorMessage(me, 'We could not load your merchant account.') }); return; }
      const merchants = Array.isArray(me.merchants) ? (me.merchants as Choice[]) : [];
      if (!me.merchant) { setLoad(merchants.length === 0 ? { kind: 'no-merchant' } : { kind: 'choose', merchants }); return; }
      const profile = me.merchant as Profile;
      const fieldsResponse = await fetch(`/api/merchant/restaurants/${encodeURIComponent(profile.id)}/fields`, { headers, cache: 'no-store' });
      const fieldsData = await readJson(fieldsResponse);
      if (seq !== loadSeq.current) return;
      if (!fieldsResponse.ok) { setLoad({ kind: 'error', message: errorMessage(fieldsData, 'We could not load your restaurant details.') }); return; }
      const fields = ((fieldsData.data as { fields?: Record<string, Snapshot> } | undefined)?.fields) ?? {};
      const listingResponse = await fetch(`/api/merchant/restaurants/${encodeURIComponent(profile.id)}/listing`, { headers, cache: 'no-store' });
      const listingData = await readJson(listingResponse);
      if (seq !== loadSeq.current) return;
      if (!listingResponse.ok || !(listingData.data as { state?: ListingState })?.state) { setLoad({ kind: 'error', message: errorMessage(listingData, 'Could not load listing status.') }); return; }
      setListing((listingData.data as { state: ListingState }).state);
      setData({ userId, profile, merchants, fields, loadId: seq });
      setConfirmed(fields);
      setLoad({ kind: 'ready' });
    } catch {
      if (seq === loadSeq.current) setLoad({ kind: 'error', message: 'We could not reach BiteSite. Check your connection and try again.' });
    }
  }, []);

  useEffect(() => { void loadMerchant(); }, [loadMerchant]);

  const send: SendSave = useCallback(async (body) => {
    const current = data;
    if (!current) throw new Error('not loaded');
    const { data: session } = await supabase.auth.getSession();
    // A save belongs to the account and restaurant it was made for; a changed session is not used.
    if (!session.session?.access_token || session.session.user.id !== current.userId) {
      return new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Your session has ended or changed. Sign in again as the same account in a new tab, then retry. Your changes are still here.' } }), { status: 401 });
    }
    return fetch(`/api/merchant/restaurants/${encodeURIComponent(current.profile.id)}/fields`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [data]);

  // Photo uploads (M6b) use the same account check as saves: a changed session is not used.
  const photoHeaders = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token || session.session.user.id !== data?.userId) return null;
    return { Authorization: `Bearer ${session.session.access_token}` };
  }, [data?.userId]);
  const onListingState = useCallback((state: ListingState) => {
    setListing(state);
    setData((current) => current ? { ...current, profile: { ...current.profile, slug: state.slug } } : current);
  }, []);
  const listingMerchantId = data?.profile.id;
  const refreshListing = useCallback(async () => {
    if (!listingMerchantId) return;
    const seq = ++listingSeq.current;
    const merchantLoad = loadSeq.current;
    try {
      const headers = await photoHeaders();
      if (!headers) throw new Error('session');
      const response = await fetch(`/api/merchant/restaurants/${encodeURIComponent(listingMerchantId)}/listing`, { headers, cache: 'no-store' });
      const body = await response.json();
      if (!response.ok || !body.data?.state) throw new Error('listing');
      if (seq !== listingSeq.current || merchantLoad !== loadSeq.current) return;
      onListingState(body.data.state); setListingError('');
    } catch { if (seq === listingSeq.current && merchantLoad === loadSeq.current) setListingError('Could not refresh listing status. Try Refresh status again.'); }
  }, [listingMerchantId, photoHeaders, onListingState]);
  useEffect(() => { void refreshListing(); }, [confirmed, refreshListing]);

  const onPhotoChanged = useCallback((slot: 'logo' | 'cover', value: string | null) => {
    setData((current) => (current ? { ...current, profile: { ...current.profile, [slot === 'logo' ? 'logo_image' : 'cover_image']: value } } : current));
  }, []);

  const anyStatus = useCallback(() => {
    const statuses = [...handles.current.values()].map((handle) => handle.status());
    return {
      dirty: statuses.some((s) => s.dirty || s.conflicts),
      busy: statuses.some((s) => s.pending || s.unknown),
    };
  }, []);

  // Warn before closing or reloading the tab with unsaved or unconfirmed changes.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) return;
      const status = anyStatus();
      if (status.dirty || status.busy) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyStatus]);

  const goTo = (targetId: string) => {
    leaving.current = true;
    window.location.assign(merchantPageUrl('/merchant', targetId));
  };

  const requestSwitch = (targetId: string) => {
    if (!data || targetId === data.profile.id) return;
    const status = anyStatus();
    if (status.busy) { setSwitchPrompt({ targetId, message: 'A save is still in progress or unconfirmed. Wait for it (or choose Retry) before switching restaurants.' }); return; }
    if (status.dirty) { setSwitchPrompt({ targetId }); return; }
    goTo(targetId);
  };

  const saveAllAndSwitch = async (targetId: string) => {
    setSwitching(true);
    const results: string[] = [];
    for (const [id, handle] of handles.current) {
      if (!handle.status().dirty) continue;
      const outcome = await handle.save();
      results.push(`${id}: ${outcome}`);
      if (outcome !== 'saved' && outcome !== 'noop') {
        setSwitching(false);
        setSwitchPrompt({ targetId, message: `Not switched. ${outcome === 'skipped' ? 'Finish or cancel the open edit in Photos / Links / Menu first.' : outcome === 'conflict' ? 'A section has a conflict to resolve.' : 'A section could not be saved.'} Sections saved before it stay saved.` });
        return;
      }
    }
    setSwitching(false);
    if (anyStatus().dirty) { setSwitchPrompt({ targetId, message: 'You kept typing while saving. Save or discard those changes first.' }); return; }
    goTo(targetId);
  };

  const discardAndSwitch = (targetId: string) => {
    for (const handle of handles.current.values()) handle.discard();
    goTo(targetId);
  };

  const goToStories = () => {
    if (!data) return;
    leaving.current = true;
    window.location.assign(merchantPageUrl('/merchant/stories', data.profile.id));
  };

  const goToNewRestaurant = () => {
    leaving.current = true;
    window.location.assign('/merchant/new');
  };

  const performSignOut = async () => {
    const status = anyStatus();
    if (status.dirty || status.busy) return;
    leaving.current = true;
    await supabase.auth.signOut();
    setData(null);
    setLoad({ kind: 'signed-out' });
    leaving.current = false;
  };

  const requestStories = () => {
    const status = anyStatus();
    if (status.busy) {
      setLeavePrompt({ kind: 'stories', message: 'A save is still in progress or unconfirmed. Wait for it (or choose Retry) before leaving.' });
      return;
    }
    if (status.dirty) {
      setLeavePrompt({ kind: 'stories' });
      return;
    }
    goToStories();
  };

  const requestNewRestaurant = () => {
    const status = anyStatus();
    if (status.busy) {
      setLeavePrompt({ kind: 'new', message: 'A save is still in progress or unconfirmed. Wait for it (or choose Retry) before leaving.' });
      return;
    }
    if (status.dirty) {
      setLeavePrompt({ kind: 'new' });
      return;
    }
    goToNewRestaurant();
  };

  const requestSignOut = () => {
    const status = anyStatus();
    if (status.busy) {
      setLeavePrompt({ kind: 'signout', message: 'A save is still in progress or unconfirmed. Wait for it (or choose Retry) before signing out.' });
      return;
    }
    if (status.dirty) {
      setLeavePrompt({ kind: 'signout' });
      return;
    }
    void performSignOut();
  };

  const finishLeave = (kind: LeaveKind) => {
    setLeavePrompt(null);
    if (kind === 'stories') goToStories();
    else if (kind === 'new') goToNewRestaurant();
    else void performSignOut();
  };

  const saveAllAndLeave = async () => {
    if (!leavePrompt) return;
    const kind = leavePrompt.kind;
    setSwitching(true);
    for (const handle of handles.current.values()) {
      if (!handle.status().dirty) continue;
      const outcome = await handle.save();
      if (outcome !== 'saved' && outcome !== 'noop') {
        setSwitching(false);
        setLeavePrompt({ kind, message: `Not leaving. ${outcome === 'skipped' ? 'Finish or cancel the open edit in Photos / Links / Menu first.' : outcome === 'conflict' ? 'A section has a conflict to resolve.' : 'A section could not be saved.'} Your changes are still here.` });
        return;
      }
    }
    setSwitching(false);
    if (anyStatus().dirty) {
      setLeavePrompt({ kind, message: 'You kept typing while saving. Save or discard those changes first.' });
      return;
    }
    finishLeave(kind);
  };

  const discardAndLeave = () => {
    if (!leavePrompt) return;
    const kind = leavePrompt.kind;
    for (const handle of handles.current.values()) handle.discard();
    finishLeave(kind);
  };

  if (load.kind !== 'ready' || !data) {
    return (
      <main className="min-h-screen bg-[#FAFBF7] px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#DDE5DC] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="font-serif text-3xl text-[#2C3E2D]">Merchant dashboard</h1>
          {load.kind === 'loading' && <p className="mt-4 text-sm text-[#6B6560]" aria-live="polite">Loading your merchant account…</p>}
          {load.kind === 'signed-out' && (
            <>
              <p className="mt-4 text-sm text-[#6B6560]">Please sign in with your merchant email to manage your listing.</p>
              <Link href="/merchant/login" className="mt-5 inline-flex min-h-11 w-full items-center justify-center sm:w-auto rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white">Merchant login</Link>
            </>
          )}
          {load.kind === 'no-merchant' && (
            <div className="mt-4"><p className="text-sm text-[#6B6560]">Create your first private restaurant draft to get started.</p><Link href="/merchant/new" className="mt-5 inline-block rounded-lg bg-[#2C3E2D] px-4 py-2.5 text-sm font-medium text-white">Create a restaurant</Link><button type="button" onClick={() => void performSignOut()} className="mt-2 min-h-11 w-full text-sm underline sm:ml-4 sm:w-auto">Sign out</button></div>
          )}
          {load.kind === 'choose' && (
            <>
              <p className="mt-4 text-sm text-[#6B6560]">Choose the restaurant you want to manage.</p>
              <Link href="/merchant/new" className="mt-4 inline-block text-sm text-emerald-800 underline">Create another restaurant</Link>
              <ul className="mt-4 space-y-2">
                {archivedLast(load.merchants).map((choice) => (
                  <li key={choice.id}>
                    {/* A full page load, so nothing from one restaurant carries over to another. */}
                    <a href={merchantPageUrl('/merchant', choice.id)} className="flex items-center justify-between gap-3 rounded-lg border border-[#DDE5DC] px-4 py-3 text-sm font-medium text-[#2C3E2D] hover:border-emerald-700">
                      <span className="min-w-0 break-words">{choice.name}</span>
                      {choice.restriction !== 'none' && <span className="shrink-0 text-xs font-normal text-[#6B6560]">{choice.restriction === 'archived' ? 'Discarded' : 'Read only'}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}
          {load.kind === 'error' && (
            <>
              <p className="mt-4 text-sm text-red-700" role="alert">{load.message}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={() => void loadMerchant()} className="rounded-lg border border-[#2C3E2D] px-4 py-2 text-sm font-medium text-[#2C3E2D]">Try again</button>
                <a href="/merchant" className="rounded-lg px-4 py-2 text-sm font-medium text-emerald-800 underline">Back to my restaurants</a>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  const { profile, merchants } = data;
  const readOnly = profile.restriction === 'suspended' || profile.restriction === 'archived' || listing?.reviewStatus === 'pending' || listing?.restriction !== 'none' || listingBusy;
  const restriction = profile.restriction !== 'none' && profile.restriction ? profile.restriction : listing?.restriction;
  const readOnlyNotice = restriction === 'suspended'
    ? 'This restaurant is suspended by BiteSite, so it cannot be changed. Contact the BiteSite team through Feedback.'
    : restriction === 'archived'
      ? 'This restaurant is archived and cannot be changed.'
      : listing?.reviewStatus === 'pending'
        ? 'Your restaurant is waiting for review, so it cannot be changed. Withdraw it from review if you need to edit.'
        : null;
  const value = (path: string) => snapshotValue(confirmed[path]);
  const hasText = (path: string) => typeof value(path) === 'string' && (value(path) as string).trim() !== '';
  const checklist = listing?.stateSource === 'managed' ? [
    { label: 'Restaurant name', complete: listing.checks.name, anchor: 'basics' },
    { label: 'Address', complete: listing.checks.address, anchor: 'basics' },
    { label: 'A way to contact you', complete: listing.checks.contact, anchor: 'contact' },
    { label: 'Cuisine', complete: listing.checks.category, anchor: 'basics' },
    { label: 'At least one dish', complete: listing.checks.dish, anchor: 'menu' },
  ] : [
    { label: 'Short description', complete: hasText('profile.description'), anchor: 'about' },
    { label: 'A way to contact you', complete: hasText('profile.phone') || hasText('profile.whatsapp') || hasText('profile.email'), anchor: 'contact' },
    { label: 'Cover photo or logo', complete: Boolean(profile.cover_image || profile.logo_image), anchor: 'photos' },
    // A dish in the menu editor or a menu link (Contact & links) both give visitors a menu.
    { label: 'Menu', complete: Boolean(listing?.checks.dish) || hasText('profile.menu_pdf_url'), anchor: 'menu' },
    { label: 'Opening hours', complete: WEEK_DAYS.some((day) => confirmed[`hours.${DAY_CODES[day]}`]?.exists), anchor: 'hours' },
  ];
  const completed = checklist.filter((item) => item.complete).length;
  const percent = Math.round((completed / checklist.length) * 100);
  const sectionKey = `${data.userId}:${profile.id}:${data.loadId}`;
  const sectionProps = { fields: data.fields, send, readOnly, register, onConfirmed };

  return (
    <main className="min-h-screen bg-[#FAFBF7] pb-16">
      <header className="border-b border-[#DDE5DC] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-emerald-800">Merchant dashboard</p>
            <h1 className="mt-1 font-serif text-2xl text-[#2C3E2D] break-words sm:text-3xl">{profile.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-[#F0F4EC] px-2.5 py-1 text-[#2C3E2D]">Listing: {listing?.stateSource === 'managed' ? (listing.public ? 'Live' : statusLabel(listing.reviewStatus, 'Draft')) : statusLabel(profile.platform_status, 'Published')}</span>
              <span className="rounded-full bg-[#F0F4EC] px-2.5 py-1 text-[#2C3E2D]">Business: {statusLabel(profile.business_status, 'Open')}</span>
            </div>
            {merchants.length > 1 && (
              <label className="mt-3 flex max-w-full flex-wrap items-center gap-2 text-sm text-[#2C3E2D]">
                <span className="font-medium">Restaurant</span>
                <select
                  value={profile.id}
                  onChange={(event) => requestSwitch(event.target.value)}
                  className="min-w-0 max-w-full rounded-lg border border-[#C9D6C7] bg-white px-3 py-2 text-sm"
                >
                  {archivedLast(merchants).map((choice) => (
                    <option key={choice.id} value={choice.id}>{choice.name}{choice.restriction === 'archived' ? ' (Discarded)' : choice.restriction !== 'none' ? ' (read only)' : ''}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <nav aria-label="Merchant links" className="flex flex-wrap items-center gap-2 text-sm">
            <a href="/merchant/new" onClick={(event) => { event.preventDefault(); requestNewRestaurant(); }} className="rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">Create another restaurant</a>
            {(listing?.stateSource === 'legacy' || listing?.public) && <a href={`/store/${profile.slug}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">View public page</a>}
            <div className="max-w-xs">
              <a href={merchantPageUrl('/merchant/preview', profile.id)} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">Preview page</a>
              <p className="mt-1 text-xs leading-5 text-[#6B6560]">Changes waiting for BiteSite review (links, name, address, cuisine) are not shown here until approved.</p>
            </div>
            <Link href={merchantPageUrl('/merchant/stories', profile.id)} onClick={(event) => { event.preventDefault(); requestStories(); }} className="rounded-lg border border-[#DDE5DC] px-3 py-2 font-medium text-[#2C3E2D] hover:border-emerald-700">Stories</Link>
            <button type="button" onClick={requestSignOut} className="rounded-lg px-3 py-2 font-medium text-[#6B6560] hover:text-[#2C3E2D]">Sign out</button>
          </nav>
        </div>
      </header>

      {switchPrompt && (
        <div role="dialog" aria-modal="true" aria-labelledby="switch-title" className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="switch-title" className="font-serif text-xl text-[#2C3E2D]">Unsaved changes</h2>
            <p className="mt-2 text-sm text-[#4B4540]">
              {switchPrompt.message ?? `You have unsaved changes for ${profile.name}. Save them before switching, discard them, or stay here.`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setSwitchPrompt(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-[#2C3E2D]">Cancel</button>
              {!anyStatus().busy && (
                <>
                  <button type="button" disabled={switching} onClick={() => discardAndSwitch(switchPrompt.targetId)} className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Discard</button>
                  <button type="button" disabled={switching} onClick={() => void saveAllAndSwitch(switchPrompt.targetId)} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{switching ? 'Saving…' : 'Save'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {leavePrompt && (
        <div role="dialog" aria-modal="true" aria-labelledby="leave-title" className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="leave-title" className="font-serif text-xl text-[#2C3E2D]">Unsaved changes</h2>
            <p className="mt-2 text-sm text-[#4B4540]">
              {leavePrompt.message ?? `You have unsaved changes for ${profile.name}. Save them before ${leavePrompt.kind === 'signout' ? 'signing out' : leavePrompt.kind === 'new' ? 'creating another restaurant' : 'opening Stories'}, discard them, or stay here.`}
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={switching} onClick={() => setLeavePrompt(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-[#2C3E2D] disabled:opacity-50">Cancel</button>
              {!anyStatus().busy && (
                <>
                  <button type="button" disabled={switching} onClick={discardAndLeave} className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50">Discard</button>
                  <button type="button" disabled={switching} onClick={() => void saveAllAndLeave()} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{switching ? 'Saving…' : 'Save'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {readOnlyNotice && (
        <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">
          <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {readOnlyNotice}
          </p>
        </div>
      )}

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:py-8">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {listing?.stateSource !== 'managed' && <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-[#2C3E2D]">Listing checklist</h2>
              <span className="text-xs font-semibold text-emerald-800">{completed}/{checklist.length}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={`Listing ${percent}% complete`}>
              <div className="h-full rounded-full bg-emerald-700 transition-all" style={{ width: `${percent}%` }} />
            </div>
            <ul className="mt-3 space-y-1.5 text-sm">
              {checklist.map((item) => (
                <li key={item.label}>
                  {item.complete
                    ? <span className="text-emerald-800">✓ {item.label}</span>
                    : <a href={`#${item.anchor}`} className="text-[#2C3E2D] underline underline-offset-2">○ {item.label}</a>}
                </li>
              ))}
            </ul>
          </div>}
          <nav aria-label="Dashboard sections" className="mt-4">
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              {SECTIONS.map((section) => (
                <li key={section.id} className="shrink-0">
                  <a href={`#${section.id}`} className="block rounded-lg border border-[#DDE5DC] bg-white px-3 py-2 text-sm text-[#2C3E2D] hover:border-emerald-700 lg:border-transparent lg:bg-transparent lg:hover:bg-white">{section.label}</a>
                </li>
              ))}
            </ul>
          </nav>
          <p className="mt-4 hidden text-xs leading-relaxed text-[#6B6560] lg:block">
            Save each section separately. You can edit listing basics until approval; later changes to those details are requested and checked by BiteSite. External links are reviewed.
          </p>
        </aside>

        <div className="min-w-0 space-y-6">
          {listingError && <p role="alert" className="text-sm text-red-700">{listingError}</p>}
          {listing && <ListingPanel key={sectionKey} merchantId={profile.id} state={listing} getHeaders={photoHeaders} refresh={refreshListing} onState={onListingState} onBusy={setListingBusy} register={register} beforeAction={() => { const status = anyStatus(); return !status.dirty && !status.busy; }} />}
          {(listing?.stateSource === 'legacy' || listing?.public) && <MonthlySummaryCard key={`summary:${profile.id}`} merchantId={profile.id} getHeaders={photoHeaders} />}
          <SectionCard id="basics" title="Listing basics" description="Your restaurant name, location and cuisine.">
            <ListingBasics key={`basics:${sectionKey}`} {...sectionProps} readOnly={readOnly || !listing?.basicsEditable} merchantId={profile.id} getHeaders={photoHeaders} areaRequests={areaRequests} />
            {listing && !listing.basicsEditable && <BasicsRequests key={`basics-requests:${profile.id}:${data.loadId}`} merchantId={profile.id} getHeaders={photoHeaders} readOnly={readOnly} register={register} areaRequests={areaRequests} />}
          </SectionCard>
          <SectionCard id="about" title="About" description="A short line and description help visitors decide to come in.">
            <TextSection key={`about:${sectionKey}`} id="about" config={ABOUT_FIELDS} {...sectionProps} />
          </SectionCard>

          <SectionCard id="contact" title="Contact & links" description="All optional. Leave a field empty to hide it from your page.">
            <TextSection key={`contact:${sectionKey}`} id="contact" config={CONTACT_FIELDS} {...sectionProps} />
            {/* Shown once the database offers tags.payment (migration 20260929120000). */}
            {'tags.payment' in sectionProps.fields && (
              <div className="mt-6 border-t border-[#EEF2EC] pt-5">
                <PaymentSection key={`payment:${sectionKey}`} {...sectionProps} />
              </div>
            )}
            <div className="mt-6 rounded-lg border border-[#EEF2EC] bg-[#FAFBF7] p-4">
              <h3 className="mb-2 text-sm font-semibold text-[#2C3E2D]">Links</h3>
              <LinkRequests key={`links:${profile.id}:${data.loadId}`} merchantId={profile.id} getHeaders={photoHeaders} readOnly={readOnly} register={register} />
            </div>
          </SectionCard>

          <SectionCard id="photos" title="Photos" description="Choose a photo from your phone or take a new one. It is resized before upload and appears on your page after BiteSite checks the file. The public gallery shows up to 8 photos: your cover first, then dish photos in menu order.">
            <ProfileImagesPanel key={`photos:${profile.id}:${data.loadId}`} apiBase={`/api/merchant/restaurants/${encodeURIComponent(profile.id)}/media`} getHeaders={photoHeaders} disabled={readOnly} register={register} onChanged={onPhotoChanged} />
          </SectionCard>

          <SectionCard id="menu" title="Menu" description="Add categories and dishes, change prices, and mark dishes sold out. Changes show on your page right away.">
            <MenuManager onChanged={refreshListing} key={`menu:${profile.id}:${data.loadId}`} merchantId={profile.id} getHeaders={photoHeaders} readOnly={readOnly} />
          </SectionCard>

          <SectionCard id="hours" title="Opening hours" description="Customers see these on your page. Changes to one day leave the other days as they are.">
            <div className="mb-6 border-b border-[#EEF2EC] pb-6">
              <ClosurePanel key={`closure:${profile.id}:${data.loadId}`} merchantId={profile.id} getHeaders={photoHeaders} readOnly={readOnly} onStatus={onBusinessStatus} />
            </div>
            <HoursSection key={`hours:${sectionKey}`} {...sectionProps} />
          </SectionCard>

          <SectionCard id="stats" title="Visitors" description="How many people opened your page and what they did.">
            <StatsPanel key={`stats:${profile.id}`} merchantId={profile.id} getHeaders={photoHeaders} />
          </SectionCard>

          <SectionCard id="feedback" title="Feedback" description="Tell the BiteSite team what would make the dashboard or your page work better for you.">
            <FeedbackPanel merchantId={profile.id} getHeaders={photoHeaders} />
          </SectionCard>

          <p className="text-xs leading-relaxed text-[#6B6560] lg:hidden">
            Save each section separately. You can edit listing basics until approval; later changes to those details go through BiteSite. External links are reviewed.
          </p>
        </div>
      </div>
    </main>
  );
}
