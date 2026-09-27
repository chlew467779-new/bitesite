/* bitesite/lib/merchant-field-patch-core.d.mts */

export type FieldActorType = "owner" | "admin";
export type FieldKind = "text" | "hours" | "feature" | "layout" | "tag_array" | "location";

export interface FieldRegistryRow {
  readonly path: string;
  readonly kind: FieldKind;
  readonly target: string;
  readonly owner: boolean;
  readonly admin: boolean;
  readonly maxLength: number | null;
}

export interface FieldLocation {
  address: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type FieldSnapshot = { exists: true; value: unknown } | { exists: false };

export interface FieldPatch {
  path: string;
  expected: FieldSnapshot;
  value: string | boolean | null | string[] | FieldLocation;
}

export type ParsedFieldPatchRequest =
  | { ok: true; requestId: string; patches: FieldPatch[] }
  | { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string> };

export declare const MERCHANT_FIELD_REGISTRY: readonly FieldRegistryRow[];
export declare const MAX_PATCHES: number;
export declare const MAX_FIELD_PATCH_BODY_BYTES: number;

export declare function isWritablePath(path: string, actorType: FieldActorType): boolean;
export declare function notWritableMessage(path: string): string;
export declare function parseFieldPatchRequest(body: unknown, actorType: FieldActorType): ParsedFieldPatchRequest;
export declare function mapFieldRpcError(error: { code?: string; message?: string; details?: string } | null | undefined): {
  status: number;
  code: string;
  message: string;
};
export declare function fieldPatchResponse(result: unknown, requestId: string): { status: number; body: Record<string, unknown> };

export declare function parseLocation(value: unknown): FieldLocation | string;
