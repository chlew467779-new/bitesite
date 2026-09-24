'use client';

import type { HTMLInputTypeAttribute } from 'react';

/** Labelled input or textarea with its own error, hint and optional character counter. */

type Props = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  hint?: string;
  warning?: string;
  type?: HTMLInputTypeAttribute;
  inputMode?: 'text' | 'tel' | 'email' | 'url';
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  multiline?: boolean;
  rows?: number;
  showCount?: boolean;
};

const baseClass =
  'mt-1.5 block w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm text-[#2C3E2D] placeholder:text-[#9A948E] focus:outline-none focus:ring-2';

export function TextField({
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  warning,
  type = 'text',
  inputMode,
  placeholder,
  autoComplete,
  maxLength,
  multiline = false,
  rows = 4,
  showCount = false,
}: Props) {
  const id = `field-${name}`;
  const describedBy = [error && `${id}-error`, warning && !error && `${id}-warning`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  const stateClass = error
    ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20'
    : 'border-[#C9D6C7] focus:border-emerald-700 focus:ring-emerald-700/20';
  const common = {
    id,
    name,
    value,
    placeholder,
    autoComplete,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
    onBlur,
    className: `${baseClass} ${stateClass}`,
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-[#2C3E2D]">
          {label}
        </label>
        {showCount && maxLength && (
          <span className={`text-xs tabular-nums ${value.length > maxLength ? 'text-red-700' : 'text-[#6B6560]'}`}>
            {value.length.toLocaleString('en-US')}/{maxLength.toLocaleString('en-US')}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea {...common} rows={rows} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input {...common} type={type} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[#6B6560]">
          {hint}
        </p>
      )}
      {warning && !error && (
        <p id={`${id}-warning`} className="mt-1 text-xs text-amber-800">
          {warning}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
