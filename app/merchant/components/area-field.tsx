'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { findArea, matchAreas, type AreaItem } from '@/lib/areas-core.mjs';
import { getAreas } from '@/lib/supabase';
import { createAreaRequests, type AreaRequests } from '@/lib/area-requests.mjs';

/**
 * Area picker (issue #7): type a few letters ("k", "besi", "PJ") and choose from the fixed area
 * list. Text that is not on the list stays visible with a message; the database refuses it on save.
 */

let areasPromise: Promise<AreaItem[]> | null = null;
const loadAreas = () => {
  areasPromise ??= getAreas().catch((error) => { areasPromise = null; throw error; });
  return areasPromise;
};

type Props = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  merchantId?: string;
  address?: string;
  getHeaders?: () => Promise<Record<string, string> | null>;
  areaRequests?: AreaRequests;
};

export function AreaField({ name, label, value, onChange, readOnly = false, merchantId, address, getHeaders, areaRequests }: Props) {
  const id = `field-${name}`;
  const listId = `${id}-list`;
  const [areas, setAreas] = useState<AreaItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [sending, setSending] = useState(false);
  const [localRequests] = useState(createAreaRequests);
  const requests = areaRequests ?? localRequests;
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    let live = true;
    loadAreas().then((list) => { if (live) setAreas(list); }, () => { if (live) setLoadFailed(true); });
    return () => { live = false; };
  }, []);

  const listed = areas ? findArea(areas, value) : null;
  const suggestions = useMemo(() => (areas ? matchAreas(areas, value) : []), [areas, value]);
  const showList = open && !readOnly && suggestions.length > 0 && !(listed && listed.name === value && suggestions.length === 1);
  const unlisted = Boolean(areas && value.trim() && !listed);
  const requestedArea = value.trim();
  const requestKey = requestedArea.toLocaleLowerCase();
  const wasSent = !!merchantId && requests.isSent(merchantId, requestedArea);
  const canRequest = !readOnly && !!merchantId && !!getHeaders && !!areas && requestedArea.length >= 2 && suggestions.length === 0;

  const askForArea = async () => {
    if (!canRequest || !merchantId || !getHeaders || sendingRef.current || wasSent) return;
    sendingRef.current = true;
    setSending(true);
    setRequestError(null);
    try {
      await requests.submit({ merchantId, area: requestedArea, address, getHeaders });
    } catch (error) {
      setRequestError({ key: requestKey, message: error instanceof Error ? error.message : 'Could not reach BiteSite. Please retry.' });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const choose = (area: AreaItem) => { onChange(area.name); setOpen(false); };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (event.key === 'Enter' && showList && suggestions[active]) { event.preventDefault(); choose(suggestions[active]); }
    else if (event.key === 'Escape') setOpen(false);
  };
  const onBlur = () => {
    setOpen(false);
    if (listed && listed.name !== value) onChange(listed.name);
  };

  const describedBy = unlisted ? `${id}-error` : `${id}-hint`;
  return (
    <div className="relative">
      <label htmlFor={id} className="text-sm font-medium text-[#2C3E2D]">{label}</label>
      <input
        id={id}
        name={name}
        value={value}
        placeholder="Start typing, e.g. Sungai Besi"
        autoComplete="off"
        maxLength={80}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={unlisted}
        aria-describedby={describedBy}
        readOnly={readOnly}
        onChange={(event) => { onChange(event.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className={`mt-1.5 block min-h-11 w-full min-w-0 rounded-lg border bg-white px-3 py-2.5 text-sm text-[#2C3E2D] placeholder:text-[#9A948E] focus:outline-none focus:ring-2 ${unlisted ? 'border-red-600 focus:border-red-600 focus:ring-red-600/20' : 'border-[#C9D6C7] focus:border-emerald-700 focus:ring-emerald-700/20'}${readOnly ? ' bg-[#F4F6F1] text-[#6B6560]' : ''}`}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-[#C9D6C7] bg-white py-1 shadow-lg">
          {suggestions.map((area, index) => (
            <li
              key={area.name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => { event.preventDefault(); choose(area); }}
              onMouseEnter={() => setActive(index)}
              className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm ${index === active ? 'bg-[#EEF3EC]' : ''}`}
            >
              <span className="text-[#2C3E2D]">{area.name}</span>
              <span className="text-xs text-[#6B6560]">{area.state}</span>
            </li>
          ))}
        </ul>
      )}
      {unlisted ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          Choose an area from the list. If yours is not listed, ask BiteSite to add it, then clear this field before saving.
        </p>
      ) : (
        <p id={`${id}-hint`} className="mt-1 text-xs text-[#6B6560]">
          {loadFailed ? 'The area list could not load. You can still type your area; it is checked when you save.' : 'Pick from the list. Short names like PJ or TTDI work too.'}
        </p>
      )}
      {canRequest && (wasSent ? <p role="status" className="mt-2 text-sm text-emerald-800">Sent. We&apos;ll add it and let you know.</p> : <div className="mt-2 space-y-2">
        <button type="button" disabled={sending} onClick={() => void askForArea()} className="min-h-11 w-full whitespace-normal break-words rounded-lg border border-[#2C3E2D] px-3 py-2 text-left text-sm font-medium text-[#2C3E2D] disabled:opacity-50">
          {sending ? 'Sending…' : <>Ask BiteSite to add &quot;{requestedArea}&quot;</>}
        </button>
        {requestError?.key === requestKey && <p role="alert" className="break-words text-sm text-red-700">{requestError.message}</p>}
      </div>)}
    </div>
  );
}
