export interface HistoryChange {
  path: string;
  label: string;
  before: string | null;
  after: string | null;
}
export interface HistoryEntry {
  id: string;
  revision: number;
  at: string;
  operation: string;
  actorType: string;
  actorId: string | null;
  reason: string | null;
  changes: HistoryChange[];
}

export declare const HISTORY_PAGE_SIZE: number;
export declare const HISTORY_MAX_PAGE_SIZE: number;
export declare function pathLabel(path: string): string;
export declare function operationLabel(operation: string | null, action: string): string;
export declare function actorLabel(actorType: string, email: string | null): string;
export declare function formatValue(value: unknown): string | null;
export declare function describeHistoryRow(row: {
  id: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  changed_paths: string[] | null;
  before: unknown;
  after: unknown;
  revision: number;
  reason: string | null;
  operation: string | null;
  created_at: string;
}): HistoryEntry;
export declare function parseHistoryQuery(params: URLSearchParams): { ok: true; before: number | null; limit: number } | { ok: false; message: string };
