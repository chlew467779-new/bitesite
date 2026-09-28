'use client';

/**
 * Editors check in-app navigation before the Admin shell unmounts them. A dirty restaurant
 * editor can defer the requested action to its Save / Discard / Cancel dialog. Its continuation
 * checks all editors again: completing one prompt never bypasses another editor's pending save.
 * Reloads and closing the tab remain covered by each editor's beforeunload handler.
 */
export type LeaveCheck = () => {
  block: boolean;
  message: string;
  prompt?: (continueLeave: () => void) => void;
} | null;

const checks = new Set<LeaveCheck>();

export function registerLeaveCheck(check: LeaveCheck) {
  checks.add(check);
  return () => { checks.delete(check); };
}

export function requestLeave(leave: () => void): void {
  const results = [...checks].map((check) => check()).filter((result) => result !== null);
  // A blocked editor takes priority even when an earlier editor only has unsaved changes.
  const blocked = results.find((result) => result.block);
  if (blocked) { window.alert(blocked.message); return; }
  for (const result of results) {
    if (result.prompt) {
      result.prompt(() => requestLeave(leave));
      return;
    }
    // Keep the native discard confirmation available for editors without a custom prompt.
    if (!window.confirm(result.message)) return;
  }
  leave();
}
