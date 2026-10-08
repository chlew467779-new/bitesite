'use client';

import { useT, useLang, presetLabel } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { CUISINE_TAGS } from '@/lib/presets';
import { useSectionSave } from '@/app/components/section-save/use-section-save';
import { SectionSaveBar } from '@/app/components/section-save/section-save-bar';
import type { SectionProps } from '@/app/components/section-save/hours-section';
import { LISTING_BASICS_PATHS } from '@/lib/merchant-review-core.mjs';
import { TextField } from './text-field';
import { AreaField } from './area-field';

const paths = [...LISTING_BASICS_PATHS];
export function ListingBasics(props: SectionProps & { merchantId?: string; getHeaders?: () => Promise<Record<string, string> | null>; areaRequests?: import('@/lib/area-requests.mjs').AreaRequests }) {
  const t = useT();
  const lang = useLang();
  const labels = [{ path: 'profile.name', label: t('owner.common.restaurantName') }, { path: 'location', label: t('owner.listing.location') }, { path: 'tags.cuisine', label: t('owner.common.cuisine') }];
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const { register } = props;
  useEffect(() => { register('basics', section.handle); return () => register('basics', null); }, [register, section.handle]);
  const [error, setError] = useState('');
  const draft = section.state.draft;
  const location = (draft.location ?? { address: null, area: null, latitude: null, longitude: null }) as Record<string, unknown>;
  const cuisine = (Array.isArray(draft['tags.cuisine']) ? draft['tags.cuisine'] : []) as string[];
  const text = (v: unknown) => typeof v === 'string' ? v : '';
  const save = () => {
    if (!text(draft['profile.name']).trim()) { setError(t('owner.listing.enterYourRestaurantName')); return; }
    setError(''); void section.save();
  };
  return <div className="space-y-5">
    {props.readOnly && <p className="text-sm text-[#6B6560]">{t('owner.listing.bitesiteChecksChangesToYourRestaurant')}</p>}
    <TextField name="name" label={t('owner.common.restaurantName')} autoComplete="organization" placeholder={t('owner.common.eGKedaiKopiSeriPagi')} maxLength={160} showCount value={text(draft['profile.name'])} onChange={(v) => section.edit('profile.name', v)} readOnly={props.readOnly} error={section.state.error?.fieldErrors?.['profile.name']} />
    <TextField name="address" label={t('owner.common.address')} autoComplete="street-address" placeholder={t('owner.listing.eG12JalanTasikUtama')} multiline maxLength={500} showCount value={text(location.address)} onChange={(v) => section.edit('location', { ...location, address: v.trim() ? v : null })} readOnly={props.readOnly} error={section.state.error?.fieldErrors?.location} />
    <AreaField name="area" label={t('owner.listing.areaOptional')} value={text(location.area)} onChange={(v) => section.edit('location', { ...location, area: v.trim() ? v : null })} readOnly={props.readOnly} merchantId={props.merchantId} address={text(location.address)} getHeaders={props.getHeaders} areaRequests={props.areaRequests} />
    <fieldset disabled={props.readOnly}>
      <legend className="text-sm font-medium">{t('owner.listing.cuisineChooseUpTo3')}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{[...new Set([...CUISINE_TAGS, ...cuisine])].map((tag) => <button key={tag} type="button" aria-pressed={cuisine.includes(tag)} disabled={props.readOnly || (!cuisine.includes(tag) && cuisine.length >= 3)} onClick={() => section.edit('tags.cuisine', cuisine.includes(tag) ? cuisine.filter((v) => v !== tag) : [...cuisine, tag])} className={`min-h-11 rounded-full border px-4 text-sm disabled:opacity-50 ${cuisine.includes(tag) ? 'border-[#2C3E2D] bg-[#2C3E2D] text-white' : 'border-[#C9D6C7]'}`}>{presetLabel(lang, tag)}</button>)}</div>
    </fieldset>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <SectionSaveBar state={section.state} labels={labels} canSave={section.canSave} dirty={section.dirty} readOnly={props.readOnly} lastOutcome={section.lastOutcome} savedMessage={t('owner.common.saved')} onSave={save} onRetry={() => void section.retry()} onKeepCurrent={section.chooseCurrent} onUseMine={section.chooseMine} />
  </div>;
}
