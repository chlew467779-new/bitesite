'use client';

import {
  MAX_SLOTS_PER_DAY,
  WEEK_DAYS,
  type DayEditorState,
  type WeekDay,
  type WeekEditorState,
} from '@/lib/merchant-hours.mjs';

/**
 * Monday–Sunday opening hours: each day is Open (with opening and closing times from a time
 * picker, up to MAX_SLOTS_PER_DAY ranges) or Closed. There is no free-text input. Days the
 * merchant has not touched keep their stored value exactly (see lib/merchant-hours.mjs).
 */

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const inputClass =
  'mt-1 block w-full min-w-0 rounded-lg border border-[#C9D6C7] bg-white px-3 py-2 text-sm text-[#2C3E2D] focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 aria-[invalid=true]:border-red-600';

type Props = {
  week: WeekEditorState;
  errors: Partial<Record<WeekDay, string>>;
  onChange: (day: WeekDay, next: DayEditorState) => void;
  onCopyMondayToAll: () => void;
};

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`min-w-[4.5rem] rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-1 ${
        active ? 'bg-[#2C3E2D] text-white shadow-sm' : 'text-[#6B6560] hover:text-[#2C3E2D]'
      }`}
    >
      {children}
    </button>
  );
}

function DayRow({ day, state, error, onChange }: { day: WeekDay; state: DayEditorState; error?: string; onChange: (next: DayEditorState) => void }) {
  const label = DAY_LABELS[day];
  const isOpen = state.mode === 'open';
  const errorId = `hours-${day}-error`;

  const setOpen = () => {
    if (isOpen) return;
    const hasTimes = state.slots.some((slot) => slot.open || slot.close);
    onChange({ ...state, mode: 'open', slots: hasTimes ? state.slots : [{ open: '', close: '' }], dirty: true });
  };
  const setClosed = () => onChange({ ...state, mode: 'closed', dirty: true });
  const updateSlot = (index: number, key: 'open' | 'close', value: string) =>
    onChange({ ...state, dirty: true, slots: state.slots.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot)) });
  const addSlot = () => onChange({ ...state, dirty: true, slots: [...state.slots, { open: '', close: '' }] });
  const removeSlot = (index: number) => onChange({ ...state, dirty: true, slots: state.slots.filter((_, i) => i !== index) });

  return (
    <div
      id={`hours-${day}`}
      role="group"
      aria-labelledby={`hours-${day}-label`}
      aria-describedby={error ? errorId : undefined}
      className={`rounded-xl border p-3 sm:p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-[#DDE5DC] bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`hours-${day}-label`} className="font-medium text-[#2C3E2D]">
          {label}
        </span>
        <div role="radiogroup" aria-label={`${label} status`} className="inline-flex rounded-lg border border-[#DDE5DC] bg-[#F4F6F1] p-0.5">
          <ToggleButton active={isOpen} onClick={setOpen}>Open</ToggleButton>
          <ToggleButton active={state.mode === 'closed'} onClick={setClosed}>Closed</ToggleButton>
        </div>
      </div>

      {state.mode === 'unset' && <p className="mt-2 text-xs text-[#6B6560]">Not set yet. This day is not shown on your page.</p>}
      {state.mode === 'legacy' && (
        <p className="mt-2 text-xs text-[#6B6560] break-words">
          Saved as “{state.original}”. It stays as it is until you choose Open or Closed.
        </p>
      )}

      {isOpen && (
        <div className="mt-3 space-y-3">
          {state.slots.map((slot, index) => {
            const overnight = Boolean(slot.open && slot.close && slot.close < slot.open);
            return (
              <div key={index} className="grid grid-cols-1 items-end gap-2 min-[400px]:grid-cols-2 sm:grid-cols-[11rem_11rem_auto] sm:gap-3">
                <label className="block text-xs font-medium text-[#6B6560]">
                  Opens
                  <input
                    type="time"
                    step={300}
                    value={slot.open}
                    onChange={(event) => updateSlot(index, 'open', event.target.value)}
                    aria-invalid={Boolean(error) && !slot.open}
                    aria-label={`${label} opening time${state.slots.length > 1 ? ` ${index + 1}` : ''}`}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-[#6B6560]">
                  Closes
                  <input
                    type="time"
                    step={300}
                    value={slot.close}
                    onChange={(event) => updateSlot(index, 'close', event.target.value)}
                    aria-invalid={Boolean(error) && !slot.close}
                    aria-label={`${label} closing time${state.slots.length > 1 ? ` ${index + 1}` : ''}`}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 min-[400px]:col-span-2 sm:col-span-1 sm:pb-2">
                  {overnight && <span className="text-xs text-[#6B6560]">Closes after midnight</span>}
                  {state.slots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(index)} className="text-xs font-medium text-red-700 underline underline-offset-2">
                      Remove this time
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {state.slots.length < MAX_SLOTS_PER_DAY && (
            <button type="button" onClick={addSlot} className="text-sm font-medium text-emerald-800 underline underline-offset-2">
              + Add another time (e.g. lunch and dinner)
            </button>
          )}
        </div>
      )}

      {error && (
        <p id={errorId} className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function HoursEditor({ week, errors, onChange, onCopyMondayToAll }: Props) {
  const mondaySet = week.monday.mode === 'open' || week.monday.mode === 'closed';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[#6B6560]">Choose Open or Closed for each day, then pick the opening and closing times.</p>
        <button
          type="button"
          onClick={onCopyMondayToAll}
          disabled={!mondaySet}
          className="rounded-lg border border-[#DDE5DC] px-3 py-1.5 text-xs font-medium text-[#2C3E2D] hover:border-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Copy Monday to every day
        </button>
      </div>
      {WEEK_DAYS.map((day) => (
        <DayRow key={day} day={day} state={week[day]} error={errors[day]} onChange={(next) => onChange(day, next)} />
      ))}
    </div>
  );
}
