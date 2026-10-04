/* bitesite/app/admin/components/merchant-form.tsx */
'use client';

/**
 * Admin restaurant editor (D2-B write cutover).
 *
 * Create: only a name (and optional web address) makes a hidden draft (POST
 * /api/admin/merchants-crud); nothing is published and no links or images are set.
 *
 * Edit: every section saves on its own through the field-level save contract
 * (PATCH /api/admin/merchants/[merchantId]/fields). Only changed fields are sent, each with the
 * value this editor loaded, so an Owner's change made meanwhile is reported as a conflict instead
 * of being overwritten; changes to other fields merge. Links and GrabFood are edited in
 * MerchantLinksPanel (compare-and-set; Owner requests are reviewed on Change Requests). The web
 * address is renamed in MerchantSlugPanel (old addresses redirect). Payment methods are shown
 * read-only: they need a workflow that is not built yet, and the old whole-form save is retired. Publish / hide / suspend / lift
 * suspension / archive / restore and the business status are dedicated, audited actions in
 * MerchantStatusPanel (D2-C), never part of a section save. Logo and cover upload through the
 * checked photo flow (M6b, ProfileImagesPanel).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Briefcase, FileText, Globe, Image as ImageIcon, Loader2, MapPin, Phone, UtensilsCrossed } from 'lucide-react';
import { useAuth } from './auth-context';
import { registerLeaveCheck } from '@/lib/unsaved-guard';
import MenuEditor from './menu-editor';
import MerchantStatusPanel from './merchant-status-panel';
import MerchantLinksPanel from './merchant-links-panel';
import MerchantSlugPanel from './merchant-slug-panel';
import MerchantHistoryPanel from './merchant-history-panel';
import { ProfileImagesPanel } from '@/app/components/media/profile-images-panel';
import { JobsPanel } from '@/app/merchant/components/jobs-panel';
import { AMENITY_TAGS, CUISINE_TAGS, OCCASION_TAGS } from '@/lib/presets';
import { getPersistableLayouts } from '@/lib/layout-registry.mjs';
import { defaultFeatures } from '@/types';
import { snapshotValue, type Snapshot } from '@/lib/section-save.mjs';
import { useSectionSave, type SectionHandle, type SendSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar, formatValue } from '@/app/components/section-save/section-save-bar';
import { HoursSection, type SectionProps } from '@/app/components/section-save/hours-section';
import { AreaField } from '@/app/merchant/components/area-field';
import { outsideMalaysiaSingaporeBounds, parseCoordinates } from '@/lib/coordinates-core.mjs';

interface MerchantFormProps {
  merchant?: {
    id: string;
    slug: string;
    name: string;
    payment_methods?: string[] | null;
    tags?: string[] | null;
    website?: string;
    instagram?: string;
    facebook?: string;
    grabfood_url?: string;
    /** MYR (RM) by default; SGD shows S$ (#24). */
    currency?: string;
    menu_pdf_url?: string;
    logo_image?: string;
    cover_image?: string;
    is_published?: boolean;
    status?: string;
    platform_status?: string;
    business_status?: string;
  } | null;
  onBack: () => void;
  onSaved: () => void;
  /** Non-blocking warning shown when the caller could not confirm this record is server-fresh. */
  loadWarning?: string;
}

type Current = { id: string; name: string; slug: string; currency?: string };

const LAYOUTS = getPersistableLayouts();
const LAYOUT_KEYS: readonly string[] = LAYOUTS.map((layout) => layout.key);
const WRITABLE_FEATURES = [
  { key: 'hero', label: 'Hero', desc: 'Full-bleed cover image' },
  { key: 'about', label: 'About', desc: 'Brand story text' },
  { key: 'contact', label: 'Contact', desc: 'Contact info (the phone/WhatsApp/email values are not changed)' },
  { key: 'gallery', label: 'Gallery', desc: 'Photo gallery' },
  // Events: hidden until CH decides whether restaurants get an events editor (09-30); nobody can add events yet.
  { key: 'appointment', label: 'Book a Table', desc: 'Shown only when the restaurant has a valid WhatsApp number' },
  { key: 'seasonal_popup', label: 'Featured dishes', desc: 'A "Featured Dishes" block with the dishes marked Featured in the menu' },
];
const TAG_GROUPS = [
  { path: 'tags.cuisine', label: 'Cuisine', options: CUISINE_TAGS, max: 3 },
  { path: 'tags.amenities', label: 'Amenities', options: AMENITY_TAGS, max: 5 },
  { path: 'tags.occasion', label: 'Occasion', options: OCCASION_TAGS, max: 3 },
] as const;

const panel = 'rounded-xl bg-white p-5 text-[#2C3E2D]';
const input = 'mt-1 block w-full min-w-0 rounded-lg border border-[#C9D6C7] bg-white px-3 py-2 text-sm text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20';
const labelClass = 'block text-sm font-medium text-[#2C3E2D]';

function textOf(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function safeHref(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function PanelTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h3 className="font-semibold text-[#2C3E2D]">{title}</h3>
      {note && <p className="mt-1 text-xs text-[#6B6560]">{note}</p>}
    </div>
  );
}

function ReadOnlyList({ items }: { items: { label: string; value: unknown; link?: boolean }[] }) {
  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      {items.map((item) => {
        const href = item.link ? safeHref(item.value) : null;
        return (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs font-medium text-[#6B6560]">{item.label}</dt>
            <dd className="mt-0.5 break-words">
              {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{href}</a> : formatValue(item.value === '' ? null : item.value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/* ── generic sections ─────────────────────────────────────────────────────────────────────── */

type TextFieldConfig = { path: string; label: string; multiline?: boolean; maxLength?: number; placeholder?: string };

function TextFieldsSection({ id, title, fieldsConfig, ...props }: SectionProps & { id: string; title: string; fieldsConfig: TextFieldConfig[] }) {
  const paths = useMemo(() => fieldsConfig.map((item) => item.path), [fieldsConfig]);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register(id, section.handle); return () => register(id, null); }, [id, register, section.handle]);
  return (
    <div className={panel}>
      <PanelTitle title={title} />
      <div className="space-y-4">
        {fieldsConfig.map((item) => {
          const error = section.state.error?.fieldErrors?.[item.path];
          const common = {
            id: `admin-${item.path}`,
            value: textOf(section.state.draft[item.path]),
            placeholder: item.placeholder,
            maxLength: item.maxLength,
            readOnly: props.readOnly,
            'aria-invalid': Boolean(error),
            className: input,
            onChange: (event: { target: { value: string } }) => section.edit(item.path, event.target.value.trim() === '' ? null : event.target.value),
          };
          return (
            <div key={item.path}>
              <label htmlFor={`admin-${item.path}`} className={labelClass}>{item.label}</label>
              {item.multiline ? <textarea {...common} rows={5} /> : <input {...common} />}
              {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
            </div>
          );
        })}
      </div>
      <SectionSaveBar state={section.state} labels={fieldsConfig} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome}
        onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

function LayoutSection(props: SectionProps) {
  const paths = useMemo(() => ['presentation.layout'], []);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('layout', section.handle); return () => register('layout', null); }, [register, section.handle]);
  const value = textOf(section.state.draft['presentation.layout']);
  const known = LAYOUT_KEYS.includes(value);
  return (
    <div className={panel}>
      <PanelTitle title="Layout" note={value && !known ? `Stored value "${value}" is not a production layout and renders as Classic. Choose one to replace it.` : undefined} />
      <label htmlFor="admin-layout" className="sr-only">Layout</label>
      <select id="admin-layout" value={known ? value : ''} disabled={props.readOnly} onChange={(event) => section.edit('presentation.layout', event.target.value)} className={input}>
        {!known && <option value="" disabled>{value ? 'Not a production layout' : 'Classic (default)'}</option>}
        {LAYOUTS.map((layout) => <option key={layout.key} value={layout.key}>{layout.displayName}</option>)}
      </select>
      <SectionSaveBar state={section.state} labels={[{ path: 'presentation.layout', label: 'Layout' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome}
        onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

function TagsSection(props: SectionProps) {
  const paths = useMemo(() => TAG_GROUPS.map((group) => group.path), []);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('tags', section.handle); return () => register('tags', null); }, [register, section.handle]);
  const toggle = (path: string, tag: string) => {
    const current = Array.isArray(section.state.draft[path]) ? (section.state.draft[path] as string[]) : [];
    section.edit(path, current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };
  return (
    <div className={panel}>
      <PanelTitle title="Discovery tags" note="Each group is saved as a whole. Older tags that are no longer in the list stay until removed." />
      <div className="space-y-5">
        {TAG_GROUPS.map((group) => {
          const selected = Array.isArray(section.state.draft[group.path]) ? (section.state.draft[group.path] as string[]) : [];
          const legacy = selected.filter((tag) => !(group.options as readonly string[]).includes(tag));
          const error = section.state.error?.fieldErrors?.[group.path];
          return (
            <fieldset key={group.path} disabled={props.readOnly}>
              <legend className="text-sm font-medium">{group.label} <span className="font-normal text-[#6B6560]">({selected.length}/{group.max})</span></legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {[...group.options, ...legacy].map((tag) => {
                  const on = selected.includes(tag);
                  return (
                    <button key={tag} type="button" aria-pressed={on} onClick={() => toggle(group.path, tag)}
                      disabled={!on && selected.length >= group.max}
                      className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-[#C9D6C7] text-[#2C3E2D]'} disabled:opacity-40`}>
                      {tag}{(group.options as readonly string[]).includes(tag) ? '' : ' (older tag)'}
                    </button>
                  );
                })}
              </div>
              {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
            </fieldset>
          );
        })}
      </div>
      <SectionSaveBar state={section.state} labels={TAG_GROUPS.map((group) => ({ path: group.path, label: group.label }))} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome}
        onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

type LocationValue = { address: string | null; area: string | null; latitude: number | string | null; longitude: number | string | null };

function LocationSection(props: SectionProps) {
  const paths = useMemo(() => ['location'], []);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const [localError, setLocalError] = useState('');
  const [coordinatesText, setCoordinatesText] = useState('');
  const { register } = props;
  useEffect(() => { register('location', section.handle); return () => register('location', null); }, [register, section.handle]);
  const value = (section.state.draft.location as LocationValue | null) ?? { address: null, area: null, latitude: null, longitude: null };
  const set = (key: keyof LocationValue, raw: string) => {
    const text = raw.trim() === '' ? null : raw;
    // Coordinates are numbers; while a typed value is not a number it stays text and saving is blocked.
    const next = key === 'latitude' || key === 'longitude' ? (text === null ? null : Number.isFinite(Number(text)) ? Number(text) : text) : text;
    section.edit('location', { ...value, [key]: next });
    setLocalError('');
  };
  const save = () => {
    if (typeof value.latitude === 'string' || typeof value.longitude === 'string') { setLocalError('Latitude and longitude must be numbers.'); return; }
    if ((value.latitude === null) !== (value.longitude === null)) { setLocalError('Enter both latitude and longitude, or clear both.'); return; }
    void section.save();
  };
  const error = localError || section.state.error?.fieldErrors?.location;
  const address = textOf(value.address).trim();
  const coordinatesOutsideLocalBounds = outsideMalaysiaSingaporeBounds(value.latitude, value.longitude);
  return (
    <div className={panel}>
      <PanelTitle title="Location" note="Address, area and coordinates are saved together so they cannot mismatch. 0 is a valid coordinate." />
      <fieldset disabled={props.readOnly} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="admin-address" className={labelClass}>Address</label>
          <textarea id="admin-address" rows={2} maxLength={500} className={input} value={textOf(value.address)} onChange={(e) => set('address', e.target.value)} />
          <button type="button" disabled={!address} onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer')}
            className="mt-2 rounded-lg border border-[#C9D6C7] px-3 py-2 text-sm text-[#2C3E2D] disabled:opacity-50">Open address in Google Maps</button>
        </div>
        <div className="sm:col-span-2">
          <AreaField name="admin-area" label="Area" value={textOf(value.area)} onChange={(v) => set('area', v)} readOnly={props.readOnly} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="admin-paste-coordinates" className={labelClass}>Paste coordinates</label>
          <input id="admin-paste-coordinates" className={input} value={coordinatesText} placeholder="3.0908, 101.6995 or a Google Maps URL" onChange={(event) => {
            const text = event.target.value;
            setCoordinatesText(text);
            const parsed = parseCoordinates(text);
            if (parsed) {
              section.edit('location', { ...value, ...parsed });
              setLocalError('');
            }
          }} />
          <p className="mt-1 text-xs text-[#6B6560]">A coordinate pair or Google Maps link fills both fields automatically.</p>
        </div>
        {(['latitude', 'longitude'] as const).map((key) => (
          <div key={key}>
            <label htmlFor={`admin-${key}`} className={labelClass}>{key === 'latitude' ? 'Latitude' : 'Longitude'}</label>
            <input id={`admin-${key}`} inputMode="decimal" className={input} value={value[key] === null ? '' : String(value[key])} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}
      </fieldset>
      {coordinatesOutsideLocalBounds && <p role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">These coordinates are outside the approximate Malaysia/Singapore range (latitude 0.8–7.5, longitude 99.5–119.5). Check whether they were reversed.</p>}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      <SectionSaveBar state={section.state} labels={[{ path: 'location', label: 'Location' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome}
        onSave={save} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

function FeaturesSection(props: SectionProps) {
  const paths = useMemo(() => WRITABLE_FEATURES.map((feature) => `features.${feature.key}`), []);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('features', section.handle); return () => register('features', null); }, [register, section.handle]);
  const defaults = defaultFeatures as unknown as Record<string, boolean>;
  return (
    <div className={panel}>
      <PanelTitle title="Page sections" note="A switch shows the page default until it has been set. Changing it back to the default leaves the stored value unset." />
      <fieldset disabled={props.readOnly} className="grid gap-3 sm:grid-cols-2">
        {WRITABLE_FEATURES.map((feature) => {
          const path = `features.${feature.key}`;
          const stored = section.state.baseline[path];
          const draft = section.state.draft[path];
          const shown = typeof draft === 'boolean' ? draft : Boolean(defaults[feature.key]);
          return (
            <label key={feature.key} className="flex items-start gap-3 rounded-lg border border-[#EEF2EC] p-3">
              <input type="checkbox" className="mt-1 h-4 w-4" checked={shown}
                onChange={() => {
                  const next = !shown;
                  // A default shown for a missing key is not a stored value: going back to it clears the edit.
                  section.edit(path, !stored?.exists && next === Boolean(defaults[feature.key]) ? null : next);
                }} />
              <span>
                <span className="block text-sm font-medium">{feature.label}{!stored?.exists && <span className="ml-1 text-xs font-normal text-[#6B6560]">(default)</span>}</span>
                <span className="block text-xs text-[#6B6560]">{feature.desc}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <SectionSaveBar state={section.state} labels={WRITABLE_FEATURES.map((feature) => ({ path: `features.${feature.key}`, label: feature.label }))} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome}
        onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

/* ── editor ───────────────────────────────────────────────────────────────────────────────── */

const tabs = [
  { label: 'Basic Info', icon: FileText },
  { label: 'Contact', icon: Phone },
  { label: 'Hours', icon: MapPin },
  { label: 'Settings', icon: Globe },
  { label: 'Images', icon: ImageIcon },
  { label: 'Menu', icon: UtensilsCrossed },
  { label: 'Jobs', icon: Briefcase },
];

export default function MerchantForm({ merchant, onBack, onSaved, loadWarning }: MerchantFormProps) {
  const { token } = useAuth();
  const [current, setCurrent] = useState<Current | null>(merchant ? { id: merchant.id, name: merchant.name, slug: merchant.slug, currency: merchant.currency } : null);
  const [activeTab, setActiveTab] = useState(0);
  const [fields, setFields] = useState<Record<string, Snapshot> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadId, setLoadId] = useState(0);
  const [leavePrompt, setLeavePrompt] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const savingAllRef = useRef(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const leaveDialog = useRef<HTMLDivElement | null>(null);
  const [createName, setCreateName] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const handles = useRef(new Map<string, SectionHandle>());
  const loadSeq = useRef(0);

  // Profile images (M6b) are uploaded and bound through the media endpoint, not the section saves.
  const mediaHeaders = useCallback(async () => (token ? { 'x-admin-token': token } : null), [token]);

  const register = useCallback((id: string, handle: SectionHandle | null) => {
    if (handle) handles.current.set(id, handle); else handles.current.delete(id);
  }, []);
  const onConfirmed = useCallback((values: Record<string, Snapshot>) => setFields((f) => (f ? { ...f, ...values } : f)), []);

  const load = useCallback(async (id: string) => {
    const seq = ++loadSeq.current;
    setFields(null);
    setLoadError('');
    try {
      const response = await fetch(`/api/admin/merchants/${encodeURIComponent(id)}/fields`, { headers: { 'x-admin-token': token || '' }, cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (seq !== loadSeq.current) return;
      if (!response.ok) { setLoadError(data?.error?.message || 'Could not load this restaurant.'); return; }
      setFields(data.data.fields);
      setLoadId(seq);
    } catch {
      if (seq === loadSeq.current) setLoadError('Could not reach the server.');
    }
  }, [token]);

  // Reload only when the restaurant changes, not when its name or web address is updated here.
  const currentId = current?.id ?? null;
  useEffect(() => { if (currentId) void load(currentId); }, [currentId, load]);

  const send: SendSave = useCallback(async (body) => {
    if (!currentId || !token) {
      return new Response(JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'Your Admin session has ended. Sign in again in a new tab, then retry.' } }), { status: 401 });
    }
    return fetch(`/api/admin/merchants/${encodeURIComponent(currentId)}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
      body: JSON.stringify(body),
    });
  }, [currentId, token]);

  const anyStatus = useCallback(() => {
    const statuses = [...handles.current.values()].map((handle) => handle.status());
    return { dirty: statuses.some((s) => s.dirty || s.conflicts), busy: savingAllRef.current || statuses.some((s) => s.pending || s.unknown) };
  }, []);

  const openLeavePrompt = useCallback((continueLeave: () => void) => {
    // Keep the first destination, including when the user clicks the sidebar repeatedly.
    if (pendingLeave.current) return;
    pendingLeave.current = continueLeave;
    const s = anyStatus();
    setLeavePrompt(s.busy ? 'A save is still in progress or unconfirmed. Wait for it (or choose Retry) before leaving.' : '');
  }, [anyStatus]);

  const cancelLeave = useCallback(() => {
    if (savingAllRef.current) return;
    pendingLeave.current = null;
    setLeavePrompt(null);
  }, []);

  const promptOpen = leavePrompt !== null;
  useEffect(() => {
    if (!promptOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = leaveDialog.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); cancelLeave(); return; }
      if (event.key !== 'Tab' || !dialog) return;
      const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [promptOpen, cancelLeave]);

  // In-app navigation (sidebar, sign-out) asks before unmounting this editor.
  useEffect(() => registerLeaveCheck(() => {
    const s = anyStatus();
    if (s.busy) return { block: true, message: 'A restaurant section is still saving or its result is unconfirmed. Wait for it (or choose Retry) before leaving.' };
    if (s.dirty) return { block: false, message: 'You have unsaved restaurant changes.', prompt: openLeavePrompt };
    return null;
  }), [anyStatus, openLeavePrompt]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { const s = anyStatus(); if (s.dirty || s.busy) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyStatus]);

  const leave = () => { onSaved(); onBack(); };
  const requestBack = () => {
    const s = anyStatus();
    if (s.dirty || s.busy) { openLeavePrompt(leave); return; }
    leave();
  };
  const finishLeave = () => {
    const s = anyStatus();
    if (s.dirty || s.busy) { setLeavePrompt('Changes are still unsaved or unconfirmed. Stay here and resolve them before leaving.'); return; }
    const continueLeave = pendingLeave.current;
    pendingLeave.current = null;
    setLeavePrompt(null);
    continueLeave?.();
  };
  const saveAllAndLeave = async () => {
    if (!pendingLeave.current || anyStatus().busy) return;
    // A ref closes the double-click gap before React renders the disabled buttons.
    savingAllRef.current = true;
    setSavingAll(true);
    let savedAll = false;
    try {
      for (const handle of handles.current.values()) {
        const status = handle.status();
        if (status.pending || status.unknown) {
          setLeavePrompt('A save is still in progress or unconfirmed. Wait for it (or choose Retry) before leaving.');
          return;
        }
        if (!status.dirty && !status.conflicts) continue;
        const outcome = await handle.save();
        if (outcome !== 'saved' && outcome !== 'noop') {
          setLeavePrompt('Not leaving: a section has a conflict or could not be saved. Sections saved before it stay saved. Cancel to resolve the section or retry an unconfirmed save.');
          return;
        }
      }
      // Ignore only our own loop lock; another section may have started a save in the meantime.
      const statuses = [...handles.current.values()].map((handle) => handle.status());
      if (statuses.some((s) => s.dirty || s.conflicts || s.pending || s.unknown)) {
        setLeavePrompt('Changes are still unsaved or unconfirmed. Save or resolve those changes first.');
        return;
      }
      savedAll = true;
    } catch {
      setLeavePrompt('Not leaving: a section could not be saved. Sections saved before it stay saved. Cancel to check the section.');
    } finally {
      savingAllRef.current = false;
      setSavingAll(false);
    }
    if (savedAll) finishLeave();
  };
  const discardAndLeave = () => {
    if (!pendingLeave.current || anyStatus().busy) return;
    for (const handle of handles.current.values()) handle.discard();
    finishLeave();
  };

  const create = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/admin/merchants-crud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token || '' },
        body: JSON.stringify(createSlug.trim() ? { name: createName, slug: createSlug.trim() } : { name: createName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setCreateError(data.error || 'The restaurant could not be created.'); return; }
      // Stay in the editor for the new draft; the list refreshes when the editor is closed.
      setCurrent(data.merchant as Current);
    } catch {
      setCreateError('Could not reach the server.');
    } finally {
      setCreating(false);
    }
  };

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={requestBack} className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200">
        <ArrowLeft className="h-4 w-4" /> Back to merchants
      </button>
      {current && <p className="text-sm text-slate-400">Editing <span className="font-medium text-slate-100">{current.name}</span> · /{current.slug}</p>}
    </div>
  );

  if (!current) {
    return (
      <div className="space-y-6">
        {header}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className={panel}>
            <PanelTitle title="New restaurant" note="Creates a hidden draft. Fill in the details after it is created; it is not published." />
            <label htmlFor="create-name" className={labelClass}>Name</label>
            <input id="create-name" className={input} maxLength={160} value={createName} onChange={(e) => setCreateName(e.target.value)} />
            <label htmlFor="create-slug" className={`${labelClass} mt-4`}>Web address (optional)</label>
            <input id="create-slug" className={input} maxLength={64} placeholder="generated from the name" value={createSlug} onChange={(e) => setCreateSlug(e.target.value)} />
            <p className="mt-1 text-xs text-[#6B6560]">Lowercase letters, numbers and hyphens. It cannot be changed here later.</p>
            {createError && <p className="mt-2 text-sm text-red-700" role="alert">{createError}</p>}
            <button type="button" disabled={creating || !createName.trim()} onClick={() => void create()} className="mt-4 rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {creating ? 'Creating…' : 'Create draft'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionKey = `${current.id}:${loadId}`;
  const readOnly = false; // Admin: the database refuses archived/pending restaurants and says why.
  const props = fields ? { fields, send, readOnly, register, onConfirmed } : null;
  const stored = (path: string) => snapshotValue(fields?.[path]);

  return (
    <div className="space-y-6">
      {header}
      {loadWarning && <p className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-4 py-2 text-sm text-amber-300">{loadWarning}</p>}

      {leavePrompt !== null && (
        <div ref={leaveDialog} role="dialog" aria-modal="true" aria-labelledby="leave-title" className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-[#2C3E2D] shadow-xl">
            <h2 id="leave-title" className="font-semibold">Unsaved changes</h2>
            <p className="mt-2 text-sm">{leavePrompt || `You have unsaved changes for ${current.name}. Save them, discard them, or stay.`}</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={savingAll} onClick={cancelLeave} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50">Cancel</button>
              {(!anyStatus().busy || savingAll) && (
                <>
                  <button type="button" disabled={savingAll} onClick={discardAndLeave} className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-700">Discard</button>
                  <button type="button" disabled={savingAll} onClick={() => void saveAllAndLeave()} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{savingAll ? 'Saving…' : 'Save'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          const isActive = activeTab === idx;
          return (
            <button key={tab.label} type="button" onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'}`}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 space-y-4">
        {loadError && <p className="rounded-lg bg-red-950/40 px-4 py-3 text-sm text-red-300" role="alert">{loadError} <button type="button" className="ml-2 underline" onClick={() => void load(current.id)}>Try again</button></p>}
        {!props && !loadError && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-amber-500" /></div>}
        {props && (
          <>
            {/* Tabs stay mounted so unsaved edits survive switching tabs. */}
            <div hidden={activeTab !== 0} className="space-y-4">
              <TextFieldsSection key={`name:${sectionKey}`} id="name" title="Name" fieldsConfig={[{ path: 'profile.name', label: 'Restaurant name', maxLength: 160 }]} {...props} />
              <TextFieldsSection key={`about:${sectionKey}`} id="about" title="About" fieldsConfig={[{ path: 'profile.tagline', label: 'Tagline', maxLength: 300 }, { path: 'profile.description', label: 'Description', multiline: true, maxLength: 10000 }]} {...props} />
              <LayoutSection key={`layout:${sectionKey}`} {...props} />
              <TagsSection key={`tags:${sectionKey}`} {...props} />
              <div className={panel}>
                <PanelTitle title="Web address" note="Renaming keeps old links working: they redirect permanently to the new address." />
                <MerchantSlugPanel key={`slug:${current.id}`} merchantId={current.id} token={token} onChanged={(slug) => setCurrent((c) => (c ? { ...c, slug } : c))} />
              </div>
              <div className={panel}>
                <PanelTitle title="Not editable here" note="Payment methods and legacy tags need a defined list." />
                <ReadOnlyList items={[
                  { label: 'Payment methods', value: merchant?.payment_methods ?? null },
                  { label: 'Legacy tags', value: merchant?.tags ?? null },
                ]} />
              </div>
            </div>
            <div hidden={activeTab !== 1} className="space-y-4">
              <TextFieldsSection key={`contact:${sectionKey}`} id="contact" title="Contact" fieldsConfig={[{ path: 'profile.phone', label: 'Phone' }, { path: 'profile.whatsapp', label: 'WhatsApp (optional; international, e.g. +60 12-345 6789)' }, { path: 'profile.email', label: 'Email' }]} {...props} />
              <LocationSection key={`location:${sectionKey}`} {...props} />
              <div className={panel}>
                <PanelTitle title="Links" note="Links must use https. Owner requests wait on the Change Requests page; saving here replaces a waiting request." />
                <MerchantLinksPanel key={`links:${current.id}`} merchantId={current.id} token={token} />
              </div>
            </div>
            <div hidden={activeTab !== 2} className={panel}>
              <PanelTitle title="Opening hours" note="Each day is saved separately from other editors' changes. Older text values stay unless you change that day." />
              <HoursSection key={`hours:${sectionKey}`} {...props} />
            </div>
            <div hidden={activeTab !== 3} className="space-y-4">
              <FeaturesSection key={`features:${sectionKey}`} {...props} />
              <MerchantStatusPanel key={`status:${current.id}`} merchantId={current.id} merchantName={current.name} token={token} />
              <MerchantHistoryPanel key={`history:${current.id}`} merchantId={current.id} token={token} />
              <div className={panel}>
                <PanelTitle title="Not editable here" note="The menu section is always shown; it cannot be switched off." />
                <ReadOnlyList items={[
                  { label: 'Menu section (protected)', value: stored('features.menu') ?? '(default)' },
                ]} />
              </div>
            </div>
            <div hidden={activeTab !== 4} className={panel}>
              <PanelTitle title="Images" note="Photos are resized on the device and checked by the server before they appear on the restaurant page." />
              <ProfileImagesPanel key={`media:${current.id}`} apiBase={`/api/admin/merchants/${encodeURIComponent(current.id)}/media`} getHeaders={mediaHeaders} />
            </div>
            <div hidden={activeTab !== 5}>
              <MenuEditor merchantId={current.id} merchantName={current.name} currency={current.currency} />
            </div>
            <div hidden={activeTab !== 6} className={panel}>
              <PanelTitle title="Jobs" note="Post, edit, renew or close job posts for this restaurant. Admin can post even before the page is public; visitors only see posts of public restaurants." />
              <JobsPanel key={`jobs:${current.id}`} merchantId={current.id} getHeaders={mediaHeaders} readOnly={false}
                endpoint={{ read: `/api/admin/jobs?merchantId=${encodeURIComponent(current.id)}`, write: '/api/admin/jobs', body: { merchantId: current.id } }}
                renderSection={(body) => body} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
