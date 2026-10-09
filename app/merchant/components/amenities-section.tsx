'use client';

import { useT, useLang, presetLabel } from '@/lib/i18n';
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
  { path: 'tags.amenities', label: 'owner.facilities.facilities', hint: 'owner.facilities.chooseUpTo5ThatCustomers', options: SELECTABLE_AMENITY_TAGS, max: 5 },
  { path: 'tags.occasion', label: 'owner.facilities.goodFor', hint: 'owner.facilities.chooseUpTo3', options: OCCASION_TAGS as readonly string[], max: 3 },
] as const;
const paths = GROUPS.map((g) => g.path);


export function AmenitiesSection(props: SectionProps) {
  const t = useT();
  const lang = useLang();
  const labels = GROUPS.map((g) => ({ path: g.path, label: t(g.label) }));
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
            <legend className="text-sm font-medium text-[#2C3E2D]">{t(group.label)}</legend>
            <p className="mt-1 text-xs text-[#6B6560]">{t(group.hint)} {t('owner.facilities.chosen', { count: chosen.length, max: group.max })}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {options.map((tag) => {
                const on = chosen.includes(tag);
                return (
                  <button key={tag} type="button" aria-pressed={on} disabled={!on && full} onClick={() => toggle(tag)}
                    className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-40 ${on ? 'border-brand bg-brand text-on-brand' : 'border-line-strong bg-page text-ink'}`}>
                    {presetLabel(lang, tag)}
                  </button>
                );
              })}
            </div>
            {section.state.error?.fieldErrors?.[group.path] && <p role="alert" className="mt-2 text-sm text-red-700">{section.state.error.fieldErrors[group.path]}</p>}
          </fieldset>
        );
      })}
      <p className="text-xs text-[#6B6560]">{t('owner.common.changesShowOnYourPageRight')}</p>
      <SectionSaveBar state={section.state} labels={labels} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage={t('owner.common.saved')} onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}
