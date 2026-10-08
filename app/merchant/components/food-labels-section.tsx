'use client';

import { useT } from '@/lib/i18n';
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
  const t = useT();
  const feedback = t('owner.tile.feedback');
  const [beforeFeedback, afterFeedback] = t('owner.foodLabels.bitesiteShowsThisLabelOnlyFor').split('{feedback}');
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('food-labels', section.handle); return () => register('food-labels', null); }, [register, section.handle]);
  const stored = section.state.baseline[PATH];
  const on = section.state.draft[PATH] === true;
  return (
    <div className="space-y-3">
      <fieldset disabled={props.readOnly}>
        <legend className="text-sm font-semibold text-ink">{t('owner.foodLabels.foodLabels')}</legend>
        <label className="mt-3 flex min-h-14 cursor-pointer items-start gap-3 rounded-2xl border border-line p-4">
          <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[#1F4D3A]" checked={on}
            onChange={() => section.edit(PATH, !stored?.exists && on ? null : !on)} />
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold text-ink">{t('owner.foodLabels.vegetarianOptions')}</span>
            <span className="block text-sm text-muted">
              {t('owner.foodLabels.tickOnlyIfAtLeastOne')}
            </span>
          </span>
        </label>
        <div className="mt-3 rounded-2xl bg-surface p-4 text-sm text-ink-2">
          <p className="font-semibold text-ink">{t('owner.foodLabels.halalCertified')}</p>
          <p className="mt-1">
            {beforeFeedback}<a href="/feedback" className="inline-flex min-h-11 min-w-11 items-center font-semibold text-brand underline">{feedback}</a>{afterFeedback}
          </p>
        </div>
      </fieldset>
      <SectionSaveBar state={section.state} labels={[{ path: PATH, label: t('owner.foodLabels.vegetarianOptions') }]} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage={t('owner.foodLabels.savedYourPageShowsThisNow')} onSave={() => void section.save()} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
    </div>
  );
}
