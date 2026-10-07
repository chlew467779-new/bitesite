'use client';

import { useEffect } from 'react';
import { SELECTABLE_AMENITY_TAGS, OCCASION_TAGS } from '@/lib/presets';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';

/**
 * Facilities and occasions (issue #4, CH 2026-09-29): the owner's choice appears on the page at
 * once, without review. Limits match the database registry: 5 facilities, 3 occasions.
 */

const GROUPS = [
  { path: 'tags.amenities', label: 'Facilities', hint: 'Choose up to 5 that customers should know about.', options: SELECTABLE_AMENITY_TAGS, max: 5 },
  { path: 'tags.occasion', label: 'Good for', hint: 'Choose up to 3.', options: OCCASION_TAGS as readonly string[], max: 3 },
] as const;
const paths = GROUPS.map((g) => g.path);
const labels = GROUPS.map((g) => ({ path: g.path, label: g.label }));

export function AmenitiesSection(props: SectionProps) {
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('amenities', section.handle); return () => register('amenities', null); }, [register, section.handle]);

  return (
    <div className="space-y-5">
      {GROUPS.map((group) => {
        const value = section.state.draft[group.path];
        const chosen = (Array.isArray(value) ? value : []) as string[];
        const full = chosen.length >= group.max;
        const toggle = (tag: string) => section.edit(group.path, chosen.includes(tag) ? chosen.filter((t) => t !== tag) : [...chosen, tag]);
        // Older values not in today's list stay visible so saving never drops them silently.
        const options = [...group.options, ...chosen.filter((t) => !group.options.includes(t))];
        return (
          <fieldset key={group.path} disabled={props.readOnly}>
            <legend className="text-sm font-medium text-[#2C3E2D]">{group.label}</legend>
            <p className="mt-1 text-xs text-[#6B6560]">{group.hint} {chosen.length}/{group.max} chosen.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((tag) => {
                const on = chosen.includes(tag);
                return (
                  <button key={tag} type="button" aria-pressed={on} disabled={!on && full} onClick={() => toggle(tag)}
                    className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-40 ${on ? 'border-[#2C3E2D] bg-[#2C3E2D] text-white' : 'border-[#C9D6C7] text-[#2C3E2D]'}`}>
                    {tag}
                  </button>
                );
              })}
            </div>
            {section.state.error?.fieldErrors?.[group.path] && <p role="alert" className="mt-2 text-sm text-red-700">{section.state.error.fieldErrors[group.path]}</p>}
          </fieldset>
        );
      })}
      <p className="text-xs text-[#6B6560]">Changes show on your page right away.</p>
      <SectionSaveBar state={section.state} labels={labels} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}
