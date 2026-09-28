'use client';

/**
 * Opening-hours section for the field save contract (D2-B), shared by the Merchant dashboard and
 * the Admin editor. Each day is its own path (hours.mon … hours.sun), so changes to different days
 * merge and only edited days are sent; unreadable older values stay untouched unless edited.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  WEEK_DAYS,
  parseDayForEditor,
  serializeDay,
  validateDay,
  type DayEditorState,
  type WeekDay,
  type WeekEditorState,
} from '@/lib/merchant-hours.mjs';
import { snapshotValue, type Snapshot } from '@/lib/section-save.mjs';
import { HoursEditor } from '@/app/merchant/components/hours-editor';
import { useSectionSave, type SectionHandle, type SendSave } from './use-section-save';
import { SectionSaveBar } from './section-save-bar';

export const DAY_CODES: Record<WeekDay, string> = { monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu', friday: 'fri', saturday: 'sat', sunday: 'sun' };

export type SectionProps = {
  fields: Record<string, Snapshot>;
  send: SendSave;
  readOnly: boolean;
  register: (id: string, handle: SectionHandle | null) => void;
  onConfirmed: (values: Record<string, Snapshot>) => void;
};

export function HoursSection(props: SectionProps) {
  const paths = useMemo(() => WEEK_DAYS.map((day) => `hours.${DAY_CODES[day]}`), []);
  const section = useSectionSave(paths, props.fields, props.send, props.onConfirmed);
  const [week, setWeek] = useState<WeekEditorState>(() => Object.fromEntries(WEEK_DAYS.map((day) => [day, parseDayForEditor(snapshotValue(props.fields[`hours.${DAY_CODES[day]}`]))])) as WeekEditorState);
  const [errors, setErrors] = useState<Partial<Record<WeekDay, string>>>({});
  const { register } = props;
  useEffect(() => { register('hours', section.handle); return () => register('hours', null); }, [register, section.handle]);

  // A day that is clean again (saved, kept current or discarded) shows the confirmed value.
  const { baseline, draft } = section.state;
  useEffect(() => {
    setWeek((current) => {
      let changed = false;
      const next = { ...current };
      for (const day of WEEK_DAYS) {
        const path = `hours.${DAY_CODES[day]}`;
        const confirmed = snapshotValue(baseline[path]) as string | null;
        if (draft[path] === confirmed && (current[day].dirty || current[day].original !== confirmed)) {
          next[day] = parseDayForEditor(confirmed);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [baseline, draft]);

  const setDay = (day: WeekDay, next: DayEditorState) => {
    setWeek((current) => ({ ...current, [day]: next }));
    section.edit(`hours.${DAY_CODES[day]}`, serializeDay(next));
    setErrors((current) => { const copy = { ...current }; delete copy[day]; return copy; });
  };
  const copyMondayToAll = () => {
    const monday = week.monday;
    for (const day of WEEK_DAYS) setDay(day, { ...week[day], mode: monday.mode, slots: monday.slots.map((slot) => ({ ...slot })), dirty: true });
  };
  const save = () => {
    const found: Partial<Record<WeekDay, string>> = {};
    for (const day of WEEK_DAYS) {
      if (!week[day].dirty) continue;
      const message = validateDay(week[day]);
      if (message) found[day] = message;
    }
    setErrors(found);
    if (Object.keys(found).length === 0) void section.save();
  };
  const serverErrors = Object.fromEntries(WEEK_DAYS.flatMap((day) => {
    const message = section.state.error?.fieldErrors?.[`hours.${DAY_CODES[day]}`];
    return message ? [[day, message]] : [];
  }));

  return (
    <>
      <fieldset disabled={props.readOnly} className="min-w-0">
        <HoursEditor week={week} errors={{ ...serverErrors, ...errors }} onChange={setDay} onCopyMondayToAll={copyMondayToAll} />
      </fieldset>
      <SectionSaveBar
        state={section.state}
        labels={WEEK_DAYS.map((day) => ({ path: `hours.${DAY_CODES[day]}`, label: day.replace(/^\w/, (c) => c.toUpperCase()) }))}
        canSave={section.canSave}
        dirty={section.dirty}
        readOnly={props.readOnly}
        lastOutcome={section.lastOutcome}
        savedMessage="Saved."
        onSave={save}
        onRetry={() => void section.retry()}
        onKeepCurrent={section.chooseCurrent}
        onUseMine={section.chooseMine}
      />
    </>
  );
}
