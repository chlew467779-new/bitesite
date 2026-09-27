'use client';

/**
 * Save button, status and conflict resolution for one editor section (D2-B). Values are shown as
 * plain text (never HTML). Conflicts must each be resolved before the section can be saved again.
 */

import { snapshotValue, type SectionState } from '@/lib/section-save.mjs';

export type FieldLabel = { path: string; label: string; format?: (value: unknown) => string };

export function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(none)';
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${item === null ? '(empty)' : String(item)}`).join(' · ');
  }
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
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
  const labelOf = (path: string) => labels.find((item) => item.path === path);
  const conflictPaths = Object.keys(state.conflicts);
  const unknown = state.error?.code === 'UNKNOWN_RESULT';
  let status = '';
  if (readOnly) status = 'This section cannot be changed right now.';
  else if (state.pending && !unknown) status = 'Saving…';
  else if (unknown) status = state.error?.message ?? '';
  else if (conflictPaths.length) status = 'This section was not saved: someone else changed it. Choose what to keep below.';
  else if (state.error) status = state.error.message ?? 'This section could not be saved.';
  else if (dirty) status = 'Unsaved changes in this section.';
  else if (lastOutcome === 'saved' || lastOutcome === 'noop') status = savedMessage ?? 'Saved.';

  return (
    <div className="mt-5 border-t border-[#EEF2EC] pt-4">
      {conflictPaths.length > 0 && (
        <div role="alert" className="mb-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">This section was not saved. Another session changed:</p>
          {conflictPaths.map((path) => {
            const conflict = state.conflicts[path];
            const label = labelOf(path);
            const show = label?.format ?? formatValue;
            const draft = state.draft[path];
            const typedAfter = JSON.stringify(draft) !== JSON.stringify(conflict.proposed);
            return (
              <div key={path} className="rounded-md border border-amber-200 bg-white p-3">
                <p className="font-medium text-[#2C3E2D]">{label?.label ?? path}</p>
                <dl className="mt-2 space-y-1.5 text-xs text-[#4B4540]">
                  <div><dt className="font-semibold">Current value</dt><dd className="whitespace-pre-wrap break-words">{show(snapshotValue(conflict.current))}</dd></div>
                  <div><dt className="font-semibold">Your edit (sent)</dt><dd className="whitespace-pre-wrap break-words">{show(conflict.proposed)}</dd></div>
                  {typedAfter && <div><dt className="font-semibold">Your current draft</dt><dd className="whitespace-pre-wrap break-words">{show(draft)}</dd></div>}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onKeepCurrent(path)} className="rounded-lg border border-[#2C3E2D] px-3 py-1.5 text-xs font-medium text-[#2C3E2D]">Keep current</button>
                  <button type="button" onClick={() => onUseMine(path)} className="rounded-lg bg-[#2C3E2D] px-3 py-1.5 text-xs font-medium text-white">Use mine</button>
                </div>
              </div>
            );
          })}
          <p className="text-xs">After choosing, save this section again. It can conflict again if someone keeps editing.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className={`min-w-0 flex-1 text-sm ${state.error && !unknown ? 'text-red-700' : conflictPaths.length || unknown ? 'text-amber-800' : 'text-[#6B6560]'}`}>
          {status}
        </p>
        {unknown ? (
          <button type="button" onClick={onRetry} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white">Retry</button>
        ) : (
          <button type="button" onClick={onSave} disabled={!canSave || readOnly} className="rounded-lg bg-[#2C3E2D] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
            {state.pending ? 'Saving…' : 'Save this section'}
          </button>
        )}
      </div>
    </div>
  );
}
