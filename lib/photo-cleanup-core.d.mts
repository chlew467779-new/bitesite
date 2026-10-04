export type CleanupBucket = "merchant-media" | "story-media";
export interface StoredPhoto { bucket: CleanupBucket | string; path: string; size: number; createdAt: string }

export declare const CLEANUP_BUCKETS: readonly CleanupBucket[];
export declare const MIN_AGE_DAYS: number;
export declare const MAX_DELETE_PER_RUN: number;
export declare const REFERENCE_SOURCES: readonly { table: string; columns: readonly string[] }[];
export declare function findUnusedPhotos(objects: readonly StoredPhoto[], referenceText: string, now?: number, minAgeDays?: number): StoredPhoto[];
export declare function formatBytes(bytes: number): string;
export declare function parseCleanupDelete(body: unknown):
  | { ok: true; items: { bucket: CleanupBucket; path: string }[] }
  | { ok: false; status: number; code: string; message: string };
