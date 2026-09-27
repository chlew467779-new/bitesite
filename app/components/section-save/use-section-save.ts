'use client';

/**
 * React binding of lib/section-save.mjs for one section of a restaurant editor (D2-B).
 *
 * - Every reply is applied only if it answers the exact save that is still pending (object
 *   identity), and only while this section instance is mounted. Editors are keyed by actor +
 *   restaurant, so after a switch (including A→B→A) a late reply lands on an unmounted instance
 *   and is dropped.
 * - A network failure is an UNKNOWN result, not a failure: the save stays pending and can only be
 *   retried with the same request id and payload, so a save that did commit is not applied twice.
 * - Typing continues while a save is in flight; lib/section-save keeps later edits.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyConflict,
  applyFailure,
  applySaved,
  buildSave,
  canSave,
  createSection,
  dirtyPaths,
  editField,
  hasConflicts,
  keepCurrent,
  startSave,
  acceptMine,
  type SectionSave,
  type SectionState,
  type Snapshot,
} from '@/lib/section-save.mjs';

export type SendSave = (body: SectionSave['body']) => Promise<Response>;
export type SaveOutcome = 'saved' | 'noop' | 'conflict' | 'error' | 'unknown' | 'skipped';

export type SectionHandle = {
  save: () => Promise<SaveOutcome>;
  discard: () => void;
  status: () => { dirty: boolean; pending: boolean; unknown: boolean; conflicts: boolean };
};

const UNKNOWN_MESSAGE = 'We could not confirm whether this section was saved. Check your connection, then choose Retry. Your changes are still here.';

export function useSectionSave(
  paths: readonly string[],
  snapshots: Record<string, Snapshot>,
  send: SendSave,
  onConfirmed?: (values: Record<string, Snapshot>) => void,
) {
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const [state, setState] = useState<SectionState>(() => createSection(paths, snapshots));
  const [lastOutcome, setLastOutcome] = useState<SaveOutcome | null>(null);
  // stateRef is the source of truth for event handlers: every change goes through update(),
  // which sets it synchronously, so code right after an await (e.g. "is anything still dirty?")
  // never reads a state older than the last applied reply.
  const stateRef = useRef(state);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const update = useCallback((fn: (current: SectionState) => SectionState) => {
    if (!mounted.current) return;
    const next = fn(stateRef.current);
    if (next === stateRef.current) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const run = useCallback(async (save: SectionSave): Promise<SaveOutcome> => {
    let response: Response;
    try {
      response = await send(save.body);
    } catch {
      update((s) => (s.pending === save ? { ...s, error: { code: 'UNKNOWN_RESULT', message: UNKNOWN_MESSAGE } } : s));
      return 'unknown';
    }
    let data: Record<string, unknown> = {};
    try { data = (await response.json()) as Record<string, unknown>; } catch { /* non-JSON error page */ }
    const error = (data.error && typeof data.error === 'object' ? data.error : {}) as { code?: string; message?: string; conflicts?: unknown[]; fieldErrors?: Record<string, string> };
    if (response.ok) {
      const result = data.data as { status?: string; values?: Record<string, Snapshot> } | undefined;
      const matched = stateRef.current.pending === save;
      update((s) => (s.pending === save ? applySaved(s, save, result?.values) : s));
      if (matched && mounted.current && result?.values) onConfirmedRef.current?.(result.values);
      return result?.status === 'noop' ? 'noop' : 'saved';
    }
    if (response.status === 409 && error.code === 'FIELD_CONFLICT') {
      update((s) => (s.pending === save ? applyConflict(s, save, error.conflicts as { path: string; current: Snapshot; proposed: unknown }[]) : s));
      return 'conflict';
    }
    const message = error.message || (typeof data.error === 'string' ? data.error : '') || 'This section could not be saved. Your changes are still here.';
    update((s) => (s.pending === save ? applyFailure(s, { code: error.code || `HTTP_${response.status}`, message, fieldErrors: error.fieldErrors, status: response.status }) : s));
    return 'error';
  }, [send, update]);

  const save = useCallback(async (): Promise<SaveOutcome> => {
    const current = stateRef.current;
    if (current.pending || hasConflicts(current)) return 'skipped';
    const next = buildSave(current, crypto.randomUUID());
    if (!next) return 'noop';
    update((s) => startSave(s, next));
    const outcome = await run(next);
    if (mounted.current) setLastOutcome(outcome);
    return outcome;
  }, [run, update]);

  const retry = useCallback(async (): Promise<SaveOutcome> => {
    const current = stateRef.current;
    if (!current.pending || current.error?.code !== 'UNKNOWN_RESULT') return 'skipped';
    const pending = current.pending;
    update((s) => ({ ...s, error: null }));
    const outcome = await run(pending);
    if (mounted.current) setLastOutcome(outcome);
    return outcome;
  }, [run, update]);

  const edit = useCallback((path: string, value: unknown) => update((s) => editField(s, path, value)), [update]);
  const chooseCurrent = useCallback((path: string) => update((s) => keepCurrent(s, path)), [update]);
  const chooseMine = useCallback((path: string) => update((s) => acceptMine(s, path)), [update]);
  const discard = useCallback(() => update((s) => (s.pending ? s : createSection(s.paths, s.baseline))), [update]);

  const handle = useMemo<SectionHandle>(() => ({
    save,
    discard,
    status: () => {
      const s = stateRef.current;
      return { dirty: dirtyPaths(s).length > 0, pending: Boolean(s.pending), unknown: s.error?.code === 'UNKNOWN_RESULT', conflicts: hasConflicts(s) };
    },
  }), [save, discard]);

  return { state, lastOutcome, edit, save, retry, chooseCurrent, chooseMine, discard, handle, canSave: canSave(state), dirty: dirtyPaths(state).length > 0 };
}
