/* bitesite/lib/section-save.d.mts */

export type Snapshot = { exists: true; value: unknown } | { exists: false };

export interface SentPath {
  readonly generation: number;
  readonly value: unknown;
}

export interface SectionSave {
  readonly requestId: string;
  readonly body: { requestId: string; patches: { path: string; expected: Snapshot; value: unknown }[] };
  readonly sent: Readonly<Record<string, SentPath>>;
}

export interface SectionError {
  code: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}

export interface SectionState {
  paths: string[];
  baseline: Record<string, Snapshot>;
  draft: Record<string, unknown>;
  generation: Record<string, number>;
  pending: SectionSave | null;
  conflicts: Record<string, { current: Snapshot; proposed: unknown }>;
  error: SectionError | null;
}

export declare function sameValue(a: unknown, b: unknown): boolean;
export declare function snapshotValue(snapshot: Snapshot | undefined): unknown;
export declare function createSection(paths: readonly string[], snapshots: Record<string, Snapshot> | null | undefined): SectionState;
export declare function editField(state: SectionState, path: string, value: unknown): SectionState;
export declare function isDirtyPath(state: SectionState, path: string): boolean;
export declare function dirtyPaths(state: SectionState): string[];
export declare function buildSave(state: SectionState, requestId: string): SectionSave | null;
export declare function startSave(state: SectionState, save: SectionSave): SectionState;
export declare function applySaved(state: SectionState, save: SectionSave, values: Record<string, Snapshot> | null | undefined): SectionState;
export declare function applyConflict(state: SectionState, save: SectionSave, conflicts: { path: string; current: Snapshot; proposed: unknown }[] | null | undefined): SectionState;
export declare function applyFailure(state: SectionState, error: SectionError): SectionState;
export declare function keepCurrent(state: SectionState, path: string): SectionState;
export declare function acceptMine(state: SectionState, path: string): SectionState;
export declare function hasConflicts(state: SectionState): boolean;
export declare function canSave(state: SectionState): boolean;
