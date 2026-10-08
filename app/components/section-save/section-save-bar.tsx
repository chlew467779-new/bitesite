'use client';

/**
 * Save button, status and conflict resolution for one editor section (D2-B). Values are shown as
 * plain text (never HTML). Conflicts must each be resolved before the section can be saved again.
 */

import { snapshotValue, type SectionState } from '@/lib/section-save.mjs';
import { useT } from '@/lib/i18n';
import { buttonClasses } from '@/components/ui/button';

export type FieldLabel = { path: string; label: string; format?: (value: unknown) => string };

export function formatValue(value: unknown, t?: ReturnType<typeof useT>): string {
  if (value === null || value === undefined || value === '') return t ? t('owner.save.empty') : '(empty)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : t ? t('owner.save.none') : '(none)';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${item === null ? (t ? t('owner.save.empty') : '(empty)') : String(item)}`).join(' · ');
  }
  if (typeof value === 'boolean') return t ? t(value ? 'owner.save.on' : 'owner.save.off') : value ? 'On' : 'Off';
  return String(value);
}

type Props = {
  state: SectionState;
  labels: FieldLabel[];
  canSave: boolean;
  dirty: boolean;
  readOnly?: boolean;
  savedMessage?: string;
  lastOutcome?: string | null;
  onSave: () => void;
  onRetry: () => void;
  onKeepCurrent: (path: string) => void;
  onUseMine: (path: string) => void;
};

export function SectionSaveBar({ state, labels, canSave, dirty, readOnly, savedMessage, lastOutcome, onSave, onRetry, onKeepCurrent, onUseMine }: Props) {
  const t = useT();
  const labelOf = (path: string) => labels.find((item) => item.path === path);
  const conflictPaths = Object.keys(state.conflicts);
  const unknown = state.error?.code === 'UNKNOWN_RESULT';
  let status = '';
  if (readOnly) status = t('owner.save.thisSectionCannotBeChangedRight');
  else if (state.pending && !unknown) status = 'Saving…';
  else if (unknown) status = state.error?.message ?? '';
  else if (conflictPaths.length) status = t('owner.save.thisSectionWasNotSavedSomeone');
  else if (state.error) status = state.error.message ?? t('owner.save.thisSectionCouldNotBeSaved');
  else if (dirty) status = t('owner.save.unsavedChangesInThisSection');
  else if (lastOutcome === 'saved' || lastOutcome === 'noop') status = savedMessage ?? 'Saved.';

  // While something is unsaved or saving, the bar sticks to the bottom of the screen (inside its
  // own section), so the Save button is in reach on a phone without scrolling to the end.
  const sticky = !readOnly && (dirty || state.pending || unknown || conflictPaths.length > 0);

  return (
    <div className={sticky
      ? 'sticky bottom-0 z-20 mt-5 border-t border-line bg-page pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-10px_12px_-8px_rgba(23,32,27,0.12)]'
      : 'mt-5 border-t border-line pt-4'}>
      {conflictPaths.length > 0 && (
        <div role="alert" className="mb-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">{t('owner.save.thisSectionWasNotSavedAnother')}</p>
          {conflictPaths.map((path) => {
            const conflict = state.conflicts[path];
            const label = labelOf(path);
            const show = label?.format ?? ((value: unknown) => formatValue(value, t));
            const draft = state.draft[path];
            const typedAfter = JSON.stringify(draft) !== JSON.stringify(conflict.proposed);
            return (
              <div key={path} className="rounded-md border border-amber-200 bg-white p-3">
                <p className="font-medium text-[#2C3E2D]">{label?.label ?? path}</p>
                <dl className="mt-2 space-y-1.5 text-xs text-[#4B4540]">
                  <div><dt className="font-semibold">{t('owner.save.currentValue')}</dt><dd className="whitespace-pre-wrap break-words">{show(snapshotValue(conflict.current))}</dd></div>
                  <div><dt className="font-semibold">{t('owner.save.yourEditSent')}</dt><dd className="whitespace-pre-wrap break-words">{show(conflict.proposed)}</dd></div>
                  {typedAfter && <div><dt className="font-semibold">{t('owner.save.yourCurrentDraft')}</dt><dd className="whitespace-pre-wrap break-words">{show(draft)}</dd></div>}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onKeepCurrent(path)} className="rounded-lg border border-[#2C3E2D] px-3 py-1.5 text-xs font-medium text-[#2C3E2D]">{t('owner.save.keepCurrent')}</button>
                  <button type="button" onClick={() => onUseMine(path)} className="rounded-lg bg-[#2C3E2D] px-3 py-1.5 text-xs font-medium text-white">{t('owner.save.useMine')}</button>
                </div>
              </div>
            );
          })}
          <p className="text-xs">{t('owner.save.afterChoosingSaveThisSectionAgain')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className={`min-w-0 flex-1 text-sm ${state.error && !unknown ? 'text-red-700' : conflictPaths.length || unknown ? 'text-amber-800' : dirty ? 'font-semibold text-ink' : 'text-muted'}`}>
          {status}
        </p>
        {unknown ? (
          <button type="button" onClick={onRetry} className={buttonClasses({ variant: 'primary', size: 'md' })}>{t('owner.common.retry')}</button>
        ) : (
          <button type="button" onClick={onSave} disabled={!canSave || readOnly} className={buttonClasses({ variant: 'primary', size: 'md' })}>
            {state.pending ? 'Saving…' : t('owner.save.saveThisSection')}
          </button>
        )}
      </div>
    </div>
  );
}
