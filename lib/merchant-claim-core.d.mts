export type ClaimRelationship = "owner" | "manager";
export type ClaimStatus = "pending" | "approved" | "rejected" | "withdrawn" | "superseded";
export type ClaimTargetStatus = "available" | "already_owner" | "managed";

export interface ClaimForm {
  relationship: ClaimRelationship | "";
  contactName: string;
  contactPhone: string;
  evidence: string;
}
export interface ClaimTarget {
  merchantId: string;
  name: string;
  slug: string;
  area: string | null;
  status: ClaimTargetStatus;
  myPending: { id: string; merchantId: string; createdAt: string } | null;
}
export interface MyClaim {
  id: string;
  merchantId: string;
  merchantName: string;
  slug: string;
  relationship: ClaimRelationship;
  status: ClaimStatus;
  createdAt: string;
  decidedAt: string | null;
  reviewNote: string | null;
}
export interface ClaimQueueItem {
  id: string;
  merchantId: string;
  userId: string;
  userEmail?: string | null;
  relationship: ClaimRelationship;
  contactName: string;
  contactPhone: string;
  evidence: string;
  emailDomainMatch: boolean;
  createdAt: string;
  restaurant: { name: string; slug: string; phone: string | null; whatsapp: string | null; email: string | null; website: string | null; address: string | null; area: string | null };
  ownerExists: boolean;
  otherPending: number;
}

type Invalid = { ok: false; status: number; code: string; message: string };

export declare const MAX_CLAIM_BODY_BYTES: number;
export declare const CLAIM_RELATIONSHIPS: readonly { value: ClaimRelationship; label: string }[];
export declare const CLAIM_STATUS_TEXT: Readonly<Record<ClaimTargetStatus, string | null>>;
export declare function isClaimSlug(value: unknown): value is string;
export declare function claimFormProblems(form: Partial<ClaimForm>): Partial<Record<keyof ClaimForm, string>>;
export declare function parseClaimRequest(body: unknown):
  | { ok: true; action: "submit"; requestId: string; relationship: ClaimRelationship; contactName: string; contactPhone: string; evidence: string }
  | { ok: true; action: "withdraw"; requestId: string; claimId: string }
  | Invalid;
export declare function parseClaimDecision(body: unknown): { ok: true; requestId: string; claimId: string; decision: "approve" | "reject"; note: string | null } | Invalid;
export declare function mapClaimRpcError(error: unknown): { status: number; code: string; message: string };
export declare function safeMerchantNext(value: unknown): string;
