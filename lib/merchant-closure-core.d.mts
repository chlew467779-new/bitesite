type Invalid = { ok: false; status: number; code: string; message: string };
export type OwnerBusinessStatus = "OPEN" | "TEMPORARILY_CLOSED";

export declare const CLOSURE_NOTE_LIMIT: number;
export declare function parseClosureRequest(body: unknown):
  | { ok: true; requestId: string; status: OwnerBusinessStatus; note: string | null; reopenOn: string | null }
  | Invalid;
export declare function mapClosureRpcError(error: unknown): { status: number; code: string; message: string };
