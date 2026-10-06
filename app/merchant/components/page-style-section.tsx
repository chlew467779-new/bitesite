'use client';

import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { getPersistableLayouts } from '@/lib/layout-registry.mjs';
import { PAGE_COLOURS, pageColour } from '@/lib/page-colours';
import { defaultFeatures } from '@/types';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';

/**
 * Page style and sections (issue #11; R4 redesign, design: Picker). Every page has the same
 * layout (T7), so the Owner picks a colour and which sections show. No review; the page changes
 * at once. Same rules as Admin's editor: a switch shows the page default until it is set, and
 * switching back to the default leaves the stored value unset.
 */

const LAYOUTS = getPersistableLayouts();
// Shown in the design order (Forest, Amber, Chilli, Stone, Night), not registry order.
const COLOUR_ORDER = Object.keys(PAGE_COLOURS);
const ORDERED_LAYOUTS = [...LAYOUTS].sort((a, b) => COLOUR_ORDER.indexOf(a.key) - COLOUR_ORDER.indexOf(b.key));
const SECTIONS = [
  { key: 'hero', label: 'Cover photo', desc: 'Your cover photo across the top of the page.' },
  { key: 'about', label: 'About text', desc: 'Your short description under the name.' },
  { key: 'seasonal_popup', label: 'Popular dishes', desc: 'The dishes you mark "Featured" in the menu, in a row near the top.' },
  { key: 'gallery', label: 'Photo gallery', desc: 'Your cover and dish photos in a row you can swipe.' },
  { key: 'appointment', label: 'Book a table', desc: 'Visitors send a booking request to your WhatsApp. Needs a WhatsApp number.' },
  { key: 'contact', label: 'Contact, hours & map', desc: 'WhatsApp, call and directions buttons, opening hours and map.' },
] as const;
const layoutPaths = ['presentation.layout'];
const sectionPaths = SECTIONS.map((s) => `features.${s.key}`);

function LayoutPicker(props: SectionProps) {
  const section = useSectionSave(layoutPaths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('page-style', section.handle); return () => register('page-style', null); }, [register, section.handle]);
  const value = section.state.draft['presentation.layout'];
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-base font-extrabold text-ink">1. Colour</legend>
        <p className="mt-1 text-sm text-muted">Buttons and titles on your page use this colour. Save, then tap <strong>Preview page</strong> at the top to see it.</p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {ORDERED_LAYOUTS.map((layout) => {
            const on = value === layout.key;
            const colour = pageColour(layout.key);
            return (
              <button key={layout.key} type="button" aria-pressed={on} onClick={() => section.edit('presentation.layout', layout.key)}
                className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-sm font-semibold text-ink transition-colors disabled:opacity-50 ${on ? 'border-ink bg-surface ring-2 ring-ink/15' : 'border-line hover:bg-surface'}`}>
                <span aria-hidden className="flex size-10 items-center justify-center rounded-full" style={{ backgroundColor: colour.colour, boxShadow: colour.dark ? 'inset 0 0 0 3px #FDE68A' : undefined }}>
                  {on && <Check size={20} className={colour.dark ? 'text-[#FDE68A]' : 'text-white'} />}
                </span>
                {colour.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={[{ path: 'presentation.layout', label: 'Colour' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved. Your page uses the new colour now." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

const menuLookPaths = ['features.menu_grid'];

/** R4b: list or photo grid. Offered only once release SQL 20261006120000 adds the field. */
function MenuLookPicker(props: SectionProps) {
  const section = useSectionSave(menuLookPaths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('menu-look', section.handle); return () => register('menu-look', null); }, [register, section.handle]);
  const stored = section.state.baseline['features.menu_grid'];
  const grid = section.state.draft['features.menu_grid'] === true;
  const choose = (next: boolean) => section.edit('features.menu_grid', !stored?.exists && !next ? null : next);
  const option = (value: boolean, label: string, picture: React.ReactNode) => (
    <button type="button" aria-pressed={grid === value} onClick={() => choose(value)}
      className={`flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-sm font-semibold text-ink transition-colors disabled:opacity-50 ${grid === value ? 'border-ink bg-surface ring-2 ring-ink/15' : 'border-line hover:bg-surface'}`}>
      {picture}
      {label}
    </button>
  );
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-base font-extrabold text-ink">2. How the menu looks</legend>
        <p className="mt-1 text-sm text-muted">Photo grid suits cafés and desserts with good dish photos. List suits long menus.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {option(false, 'List', (
            <span aria-hidden className="flex w-16 flex-col gap-1.5">
              {[0, 1, 2].map((i) => <span key={i} className="flex items-center gap-1.5"><span className="h-2 flex-1 rounded bg-line-strong" /><span className="size-4 rounded bg-line-strong" /></span>)}
            </span>
          ))}
          {option(true, 'Photo grid', (
            <span aria-hidden className="grid w-16 grid-cols-2 gap-1.5">
              {[0, 1, 2, 3].map((i) => <span key={i} className="aspect-square rounded bg-line-strong" />)}
            </span>
          ))}
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={[{ path: 'features.menu_grid', label: 'Menu look' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved. Your menu uses the new look now." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

function SectionSwitches(props: SectionProps & { step: number }) {
  const section = useSectionSave(sectionPaths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('page-sections', section.handle); return () => register('page-sections', null); }, [register, section.handle]);
  const defaults = defaultFeatures as unknown as Record<string, boolean>;
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-base font-extrabold text-ink">{props.step}. Sections on your page</legend>
        <p className="mt-1 text-sm text-muted">Your name and menu are always shown.</p>
        <div className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {SECTIONS.map((item) => {
            const path = `features.${item.key}`;
            const stored = section.state.baseline[path];
            const draft = section.state.draft[path];
            const shown = typeof draft === 'boolean' ? draft : Boolean(defaults[item.key]);
            return (
              <label key={item.key} className="flex min-h-14 cursor-pointer items-center gap-3 bg-page px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-ink">{item.label}</span>
                  <span className="block text-sm text-muted">{item.desc}</span>
                </span>
                <input type="checkbox" className="h-6 w-6 shrink-0 accent-[#1F4D3A]" checked={shown}
                  onChange={() => {
                    const next = !shown;
                    // A default shown for a missing value is not stored: going back to it clears the edit.
                    section.edit(path, !stored?.exists && next === Boolean(defaults[item.key]) ? null : next);
                  }} />
              </label>
            );
          })}
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={SECTIONS.map((s) => ({ path: `features.${s.key}`, label: s.label }))} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved. Your page shows these sections now." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

export function PageStyleSection(props: SectionProps) {
  const hasMenuLook = 'features.menu_grid' in props.fields;
  return (
    <div className="space-y-8">
      {'presentation.layout' in props.fields && <LayoutPicker {...props} />}
      {hasMenuLook && <div className="border-t border-line pt-6"><MenuLookPicker {...props} /></div>}
      {sectionPaths.every((path) => path in props.fields) && <div className="border-t border-line pt-6"><SectionSwitches {...props} step={hasMenuLook ? 3 : 2} /></div>}
    </div>
  );
}
