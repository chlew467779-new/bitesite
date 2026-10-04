'use client';

import { useState } from 'react';
import { PHONE_COUNTRIES, joinPhone, splitPhone } from '@/lib/phone-core.mjs';

/**
 * Phone / WhatsApp input (issue #5): country code picker (+60 / +65) and the rest of the number
 * without the leading 0. Emits the stored form "+60165660239", or '' when cleared.
 */

type Props = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  readOnly?: boolean;
};

export function PhoneField({ name, label, value, onChange, onBlur, error, readOnly = false }: Props) {
  const id = `field-${name}`;
  const parts = splitPhone(value);
  // The picked country is kept while the number is empty, so choosing +65 first is not undone.
  const [pickedCountry, setPickedCountry] = useState(parts.country);
  const country = parts.local ? parts.country : pickedCountry;
  const example = PHONE_COUNTRIES.find((c) => c.code === country)?.example ?? '';
  const stateClass = error
    ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20'
    : 'border-[#C9D6C7] focus:border-emerald-700 focus:ring-emerald-700/20';
  const box = `mt-1.5 min-h-11 rounded-lg border bg-white px-3 py-2.5 text-sm text-[#2C3E2D] focus:outline-none focus:ring-2 ${stateClass}${readOnly ? ' bg-[#F4F6F1] text-[#6B6560]' : ''}`;

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#2C3E2D]">{label}</label>
      <div className="flex gap-2">
        <select
          aria-label={`${label} country code`}
          value={country}
          disabled={readOnly}
          onChange={(event) => {
            setPickedCountry(event.target.value);
            onChange(joinPhone(event.target.value, parts.local) ?? '');
          }}
          className={`${box} w-28 shrink-0`}
        >
          {PHONE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>+{c.code}</option>)}
        </select>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={parts.local}
          placeholder={example}
          readOnly={readOnly}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          onChange={(event) => onChange(joinPhone(country, event.target.value) ?? '')}
          onBlur={onBlur}
          className={`${box} block w-full min-w-0 placeholder:text-[#9A948E]`}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">{error}</p>
      ) : (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[#6B6560]">Type the number without the first 0, e.g. {example}.</p>
      )}
    </div>
  );
}
