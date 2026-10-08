'use client';

import {
  MAX_SLOTS_PER_DAY,
  WEEK_DAYS,
  type DayEditorState,
  type WeekDay,
  type WeekEditorState,
} from '@/lib/merchant-hours.mjs';
import { cn } from '@/lib/utils';
import { buttonClasses } from '@/components/ui/button';
import { useT, useLang, dayName } from '@/lib/i18n';

/**
 * Monday–Sunday opening hours: each day is Open (with opening and closing times from a time
 * picker, up to MAX_SLOTS_PER_DAY ranges) or Closed. There is no free-text input. Days the
 * merchant has not touched keep their stored value exactly (see lib/merchant-hours.mjs).
 */

const inputClass =
  'mt-1 block w-full min-w-0 rounded-lg border border-line-strong bg-white px-3 py-2 text-base text-ink focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 aria-[invalid=true]:border-red-600';

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
      className={buttonClasses({ variant: active ? 'primary' : 'ghost', size: 'md' })}
    >
      {children}
    </button>
  );
}

function DayRow({ day, state, error, onChange }: { day: WeekDay; state: DayEditorState; error?: string; onChange: (next: DayEditorState) => void }) {
  const t = useT();
  const lang = useLang();
  const label = dayName(lang, day);
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
      className={`rounded-xl border p-3 sm:p-4 ${error ? 'border-red-300 bg-red-50/40' : 'border-line bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`hours-${day}-label`} className="font-medium text-ink">
          {label}
        </span>
        <div role="radiogroup" aria-label={t('owner.hours.status', { day: label })} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          <ToggleButton active={isOpen} onClick={setOpen}>{t('owner.common.open')}</ToggleButton>
          <ToggleButton active={state.mode === 'closed'} onClick={setClosed}>{t('owner.hours.closed')}</ToggleButton>
        </div>
      </div>

      {state.mode === 'unset' && <p className="mt-2 text-xs text-muted">{t('owner.hours.notSetYetThisDayIs')}</p>}
      {state.mode === 'legacy' && (
        <p className="mt-2 text-xs text-muted break-words">
          {t('owner.hours.savedAsItStaysAsIt', { value: state.original ?? '' })}
        </p>
      )}

      {isOpen && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted">{t('owner.hours.forExampleChoose0900To')}</p>
          {state.slots.map((slot, index) => {
            const overnight = Boolean(slot.open && slot.close && slot.close < slot.open);
            return (
              <div key={index} className="grid grid-cols-1 items-end gap-2 min-[400px]:grid-cols-2 sm:grid-cols-[11rem_11rem_auto] sm:gap-3">
                <label className="block text-xs font-medium text-muted">

                  {t('owner.hours.opens')}
                  <input
                    type="time"
                    step={300}
                    value={slot.open}
                    onChange={(event) => updateSlot(index, 'open', event.target.value)}
                    aria-invalid={Boolean(error) && !slot.open}
                    aria-label={t('owner.hours.openingTime', { day: label, number: state.slots.length > 1 ? ` ${index + 1}` : '' })}
                    className={inputClass}
                  />
                </label>
                <label className="block text-xs font-medium text-muted">

                  {t('owner.hours.closes')}
                  <input
                    type="time"
                    step={300}
                    value={slot.close}
                    onChange={(event) => updateSlot(index, 'close', event.target.value)}
                    aria-invalid={Boolean(error) && !slot.close}
                    aria-label={t('owner.hours.closingTime', { day: label, number: state.slots.length > 1 ? ` ${index + 1}` : '' })}
                    className={inputClass}
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 min-[400px]:col-span-2 sm:col-span-1 sm:pb-2">
                  {overnight && <span className="text-xs text-muted">{t('owner.hours.closesAfterMidnight')}</span>}
                  {state.slots.length > 1 && (
                    <button type="button" onClick={() => removeSlot(index)} className={buttonClasses({ variant: 'ghost', size: 'md' }) + ' text-red-700'}>

                      {t('owner.hours.removeThisTime')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {state.slots.length < MAX_SLOTS_PER_DAY && (
            <button type="button" onClick={addSlot} className={cn(buttonClasses({ variant: 'ghost', size: 'md' }), 'whitespace-normal text-brand')}>

              {t('owner.hours.addAnotherTimeEGLunch')}
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
  const t = useT();
  const mondaySet = week.monday.mode === 'open' || week.monday.mode === 'closed';
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t('owner.hours.chooseOpenOrClosedForEach')}</p>
        <button
          type="button"
          onClick={onCopyMondayToAll}
          disabled={!mondaySet}
          className={cn(buttonClasses({ variant: 'secondary', size: 'md' }), 'whitespace-normal')}
        >

          {t('owner.hours.copyMondayToEveryDay')}
        </button>
      </div>
      {WEEK_DAYS.map((day) => (
        <DayRow key={day} day={day} state={week[day]} error={errors[day]} onChange={(next) => onChange(day, next)} />
      ))}
    </div>
  );
}
