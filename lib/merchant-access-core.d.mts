/* bitesite/lib/merchant-access-core.d.mts */

export type MerchantRestriction = "none" | "suspended" | "archived";
export type MerchantCapability = "read" | "write";

export interface MerchantAccessRow {
  id: string;
  name: string;
  slug: string;
  business_status: string | null;
  platform_status: string | null;
  platform_restriction: string | null;
}

export interface MerchantSummary {
  id: string;
  name: string;
  slug: string;
  business_status: string | null;
  restriction: MerchantRestriction;
}

export type MerchantAccessResult =
  | { ok: true; merchant: MerchantAccessRow; restriction: MerchantRestriction }
  | {
      ok: false;
      status: 403 | 404 | 409;
      code: "RESOURCE_NOT_FOUND" | "MERCHANT_CONTEXT_REQUIRED" | "MERCHANT_SUSPENDED" | "OPERATION_FORBIDDEN";
      message: string;
    };

export declare const MERCHANT_ACCESS_COLUMNS: readonly [
  "id",
  "name",
  "slug",
  "business_status",
  "platform_status",
  "platform_restriction",
];

export declare function merchantRestriction(
  merchant: Pick<MerchantAccessRow, "platform_status" | "platform_restriction"> | null | undefined,
): MerchantRestriction;

export declare function merchantSummary(merchant: MerchantAccessRow): MerchantSummary;

export declare function readRequestedMerchantId(value: string | null | undefined): string | undefined;

export declare function resolveMerchantAccess(input: {
  merchants: readonly MerchantAccessRow[];
  requestedMerchantId: string | undefined;
  capability: MerchantCapability;
}): MerchantAccessResult;
