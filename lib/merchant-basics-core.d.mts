export interface BasicsValues {
  name: string | null;
  address: string | null;
  area: string | null;
  cuisine: string[];
}
export type BasicsChanges = Partial<{ "profile.name": string; location: { address: string; area: string | null }; "tags.cuisine": string[] }>;
export interface BasicsRequestItem {
  id: string;
  changes: Partial<BasicsValues>;
  status: "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
  createdAt: string;
  decidedAt: string | null;
  reviewNote: string | null;
}
export interface BasicsRead {
  current: BasicsValues;
  requestable: boolean;
  requests: BasicsRequestItem[];
}
export interface BasicsQueueItem {
  id: string;
  merchantId: string;
  merchantName: string;
  slug: string;
  current: BasicsValues;
  changes: Partial<BasicsValues>;
  changedSinceRequest: boolean;
  createdAt: string;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const MAX_BASICS_BODY_BYTES: number;
export declare function basicsChanges(
  current: BasicsValues,
  draft: { name: string; address: string; area: string; cuisine: string[] },
): { ok: true; changes: BasicsChanges } | { ok: false; message: string };
export declare function parseOwnerBasicsRequest(body: unknown):
  | { ok: true; action: "request"; requestId: string; changes: BasicsChanges }
  | { ok: true; action: "withdraw"; requestId: string; basicsRequestId: string }
  | Invalid;
export declare function parseBasicsReview(body: unknown): { ok: true; requestId: string; basicsRequestId: string; decision: "approve" | "reject"; note: string | null } | Invalid;
export declare function mapBasicsRpcError(error: unknown): { status: number; code: string; message: string };
