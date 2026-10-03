'use client';

import { useEffect } from 'react';
import { getPersistableLayouts } from '@/lib/layout-registry.mjs';
import { defaultFeatures } from '@/types';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';

/**
 * Page style and sections (issue #11, CH 2026-09-30, option C): the Owner picks one of the
 * production layouts and turns page sections on or off. No review; the page changes at once.
 * Same rules as Admin's editor: a switch shows the page default until it is set, and switching
 * back to the default leaves the stored value unset.
 */

const LAYOUTS = getPersistableLayouts();
const SECTIONS = [
  { key: 'hero', label: 'Big cover photo', desc: 'Your cover photo across the top of the page.' },
  { key: 'about', label: 'About', desc: 'Your short description.' },
  { key: 'contact', label: 'Contact & map', desc: 'Phone, WhatsApp, email, opening hours and map.' },
  { key: 'gallery', label: 'Photo gallery', desc: 'Your cover and dish photos.' },
  { key: 'appointment', label: 'Book a Table', desc: 'Visitors send a booking request to your WhatsApp. Shown only when you have a WhatsApp number.' },
  { key: 'seasonal_popup', label: 'Featured dishes', desc: 'The dishes you mark "Featured" in the menu.' },
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
        <legend className="text-sm font-medium text-[#2C3E2D]">Page style</legend>
        <p className="mt-1 text-xs text-[#6B6560]">Colours and fonts of your public page. Save, then tap <strong>Preview page</strong> at the top to see it.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {LAYOUTS.map((layout) => {
            const on = value === layout.key;
            return (
              <button key={layout.key} type="button" aria-pressed={on} onClick={() => section.edit('presentation.layout', layout.key)}
                className={`flex min-h-11 items-center gap-3 rounded-xl border p-3 text-left disabled:opacity-50 ${on ? 'border-[#2C3E2D] ring-2 ring-[#2C3E2D]/20' : 'border-[#DDE5DC] hover:border-emerald-700'}`}>
                <span className="flex shrink-0 overflow-hidden rounded-md border border-black/10" aria-hidden>
                  {layout.swatches.map((color) => <span key={color} className="h-8 w-4" style={{ backgroundColor: color }} />)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-[#2C3E2D]">{layout.displayName}{on && <span className="ml-1 text-xs font-normal text-emerald-800">(chosen)</span>}</span>
                  <span className="block text-xs text-[#6B6560]">{layout.shortDescription} · good for {layout.suitableCuisines.slice(0, 2).join(', ').toLowerCase()}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={[{ path: 'presentation.layout', label: 'Page style' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved. Your page uses the new style now." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}

function SectionSwitches(props: SectionProps) {
  const section = useSectionSave(sectionPaths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('page-sections', section.handle); return () => register('page-sections', null); }, [register, section.handle]);
  const defaults = defaultFeatures as unknown as Record<string, boolean>;
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-sm font-medium text-[#2C3E2D]">Sections on your page</legend>
        <p className="mt-1 text-xs text-[#6B6560]">Your menu is always shown.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((item) => {
            const path = `features.${item.key}`;
            const stored = section.state.baseline[path];
            const draft = section.state.draft[path];
            const shown = typeof draft === 'boolean' ? draft : Boolean(defaults[item.key]);
            return (
              <label key={item.key} className="flex min-h-11 items-start gap-3 rounded-lg border border-[#EEF2EC] p-3">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-[#2C3E2D]" checked={shown}
                  onChange={() => {
                    const next = !shown;
                    // A default shown for a missing value is not stored: going back to it clears the edit.
                    section.edit(path, !stored?.exists && next === Boolean(defaults[item.key]) ? null : next);
                  }} />
                <span>
                  <span className="block text-sm font-medium text-[#2C3E2D]">{item.label}</span>
                  <span className="block text-xs text-[#6B6560]">{item.desc}</span>
                </span>
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
  return (
    <div className="space-y-8">
      {'presentation.layout' in props.fields && <LayoutPicker {...props} />}
      {sectionPaths.every((path) => path in props.fields) && <div className="border-t border-[#EEF2EC] pt-6"><SectionSwitches {...props} /></div>}
    </div>
  );
}
