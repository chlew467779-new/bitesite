'use client';

import { useEffect } from 'react';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';

/**
 * Food labels (R5; wording and rules from ChatGPT G28). The restaurant declares "Vegetarian options"
 * itself. "Halal-certified" is never self-declared: BiteSite adds it after checking a valid
 * certificate, so it is explained here but cannot be ticked. Shown once migration 20261006120000
 * adds features.vegetarian_options.
 */
const PATH = 'features.vegetarian_options';
const paths = [PATH];

export function FoodLabelsSection(props: SectionProps) {
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('food-labels', section.handle); return () => register('food-labels', null); }, [register, section.handle]);
  const stored = section.state.baseline[PATH];
  const on = section.state.draft[PATH] === true;
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-sm font-semibold text-ink">Food labels</legend>
        <label className="mt-3 flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-line p-4">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#1F4D3A]" checked={on}
            onChange={() => section.edit(PATH, !stored?.exists && on ? null : !on)} />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-ink">Vegetarian options</span>
            <span className="block text-sm text-muted">
              Tick only if at least one dish has no meat, fish or seafood, including the stock and sauce
              (egg and dairy are fine; say so in the dish description). Your page will show it as declared by you.
            </span>
          </span>
        </label>
        <div className="mt-3 rounded-2xl bg-surface p-4 text-sm text-ink-2">
          <p className="font-semibold text-ink">Halal-certified</p>
          <p className="mt-1">
            BiteSite shows this label only for an outlet with a valid certificate from JAKIM or your state
            religious authority (Malaysia) or MUIS (Singapore). Send your certificate through <a href="/feedback" className="font-semibold text-brand underline">Feedback</a> and we will add the label after checking it.
          </p>
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={[{ path: PATH, label: 'Vegetarian options' }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage="Saved. Your page shows this now." onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}
