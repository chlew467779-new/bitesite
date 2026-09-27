export type MediaSlot = "logo" | "cover";
export type MediaContentType = "image/jpeg" | "image/png" | "image/webp";

export declare const MEDIA_SLOTS: readonly MediaSlot[];
export declare const MEDIA_MAX_BYTES: number;
export declare const MEDIA_BUCKET: string;
export declare const MEDIA_TYPES: Readonly<Record<MediaContentType, string>>;
export declare const MAX_MEDIA_BODY_BYTES: number;
export declare const MEDIA_RESIZE: Readonly<Record<MediaSlot, { maxWidthOrHeight: number }>>;

type Invalid = { ok: false; status: number; code: string; message: string };
export declare function parseTicketRequest(body: unknown): { ok: true; slot: MediaSlot; contentType: MediaContentType } | Invalid;
export declare function parseBindRequest(body: unknown): { ok: true; requestId: string; slot: MediaSlot; uploadId: string | null; expected: string | null } | Invalid;
export declare function sniffImageType(bytes: Uint8Array | ArrayBuffer | null | undefined): MediaContentType | null;
export declare function mediaObjectPath(merchantId: string, slot: MediaSlot, contentType: MediaContentType, uuid: string): string;
export declare function mapMediaRpcError(error: unknown): { status: number; code: string; message: string };
export declare function mediaBindResponse(result: unknown, requestId: string): { status: number; body: Record<string, unknown> };
