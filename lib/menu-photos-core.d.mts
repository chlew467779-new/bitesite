type Invalid = { ok: false; status: number; code: string; message: string };
export interface MenuPhoto { name: string; uploadedAt: string | null; size: number }
export interface StorageListItem { name: string; id: string | null; created_at?: string | null; metadata?: { size?: number } | null }
export declare const MENU_PHOTOS_BUCKET: string;
export declare const MENU_PHOTO_MAX_BYTES: number;
export declare const MENU_PHOTO_MAX_COUNT: number;
export declare const MENU_PHOTO_TYPES: Readonly<Record<string, string>>;
export declare const MAX_MENU_PHOTO_BODY_BYTES: number;
export declare function isMenuPhotoName(value: unknown): value is string;
export declare function incomingPath(merchantId: string, name: string): string;
export declare function photoPath(merchantId: string, name: string): string;
export declare function newMenuPhotoName(contentType: string, uuid: string): string | null;
export declare function contentTypeOfName(name: string): string | null;
export declare function parseMenuPhotoRequest(body: unknown): { ok: true; action: "ticket"; contentType: string } | { ok: true; action: "confirm"; name: string } | Invalid;
export declare function checkedPhotos(listing: readonly StorageListItem[] | null | undefined): MenuPhoto[];
export declare function merchantFolders(listing: readonly StorageListItem[] | null | undefined): string[];
export declare function isMissingBucketError(error: unknown): boolean;
