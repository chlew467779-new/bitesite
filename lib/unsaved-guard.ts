'use client';

/**
 * In-app navigation guard for editors with unsaved or unconfirmed section saves (D2-B / M1-B).
 * Editors register a check; navigation code (e.g. the Admin sidebar, sign-out) asks
 * `confirmLeave()` before unmounting them. Page reloads and closing the tab are covered separately
 * by each editor's `beforeunload` handler.
 *
 * A check returns null when leaving is fine, `{ block: true, message }` when a save is in flight or
 * unconfirmed (leaving is refused: the result must be known first), or `{ block: false, message }`
 * when there are unsaved edits (the user may choose to discard them).
 */

export type LeaveCheck = () => { block: boolean; message: string } | null;

const checks = new Set<LeaveCheck>();

export function registerLeaveCheck(check: LeaveCheck) {
  checks.add(check);
  return () => { checks.delete(check); };
}

export function confirmLeave(): boolean {
  for (const check of checks) {
    const result = check();
    if (!result) continue;
    if (result.block) {
      window.alert(result.message);
      return false;
    }
    return window.confirm(result.message);
  }
  return true;
}
