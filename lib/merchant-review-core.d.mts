import type { MenuSnapshot } from './merchant-menu-core.mjs';
export type ListingAction = 'submit' | 'withdraw' | 'publish' | 'hide' | 'discard';
export type ListingCheck = 'name' | 'address' | 'contact' | 'category' | 'dish';
export interface ListingState {
  stateSource: 'legacy' | 'managed'; reviewStatus: string; listingVisibility: string;
  restriction: 'none' | 'suspended' | 'archived'; businessStatus: string; public: boolean; slug: string;
  firstPublishedAt: string | null; checks: Record<ListingCheck, boolean>; basicsEditable: boolean;
  allowedActions: ListingAction[]; pendingSubmission: { id: string; createdAt: string } | null;
  lastDecision: { status: string; note: string | null; decidedAt: string } | null;
}
export interface ReviewSnapshot {
  name: string; tagline: string | null; description: string | null; address: string | null; area: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; cuisine: string[] | null;
  logoImage: string | null; coverImage: string | null; menu: MenuSnapshot;
}
export interface ReviewItem { id: string; merchantId: string; slug: string; createdAt: string; snapshot: ReviewSnapshot; changed: boolean; restriction: string; /** Added by the Admin route (MYR or SGD). */ currency?: string }
type Invalid = { ok: false; status: number; code: string; message: string };
export declare const LISTING_BASICS_PATHS: readonly string[];
export declare const MAX_REVIEW_BODY_BYTES: number;
export declare const CHECK_LABELS: Readonly<Record<ListingCheck, string>>;
export declare function isListingBasicsPatch(body: unknown): boolean;
export declare function parseListingAction(body: unknown): { ok: true; requestId: string; action: ListingAction } | Invalid;
export declare function parseReviewDecision(body: unknown): { ok: true; requestId: string; submissionId: string; decision: 'approve' | 'reject'; note: string | null } | Invalid;
export type IntakeMode = 'open' | 'limited' | 'paused';
export declare const INTAKE_MODES: readonly IntakeMode[];
export declare function parseCapacity(body: unknown): { ok: true; capacity: number; pilotCapacity?: number; intakeMode?: IntakeMode } | Invalid;
export declare function intakeNotice(reason: string | null | undefined): string | null;
export declare function mapReviewRpcError(error: unknown): { status: number; code: string; message: string };
