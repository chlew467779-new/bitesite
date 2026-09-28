export type MerchantListInput = {
  state_source?: string | null; platform_restriction?: string | null;
  platform_status?: string | null; is_published?: boolean | null;
  review_status?: string | null; listing_visibility?: string | null;
  first_published_at?: string | null;
  business_status?: string | null; status?: string | null;
};
export declare function merchantReviewLabel(merchant: MerchantListInput): 'Draft' | 'Waiting for review' | 'Changes requested' | 'Approved – hidden' | 'Live' | 'Discarded' | 'Archived' | 'Suspended' | null;
export declare function merchantListState(merchant: MerchantListInput): { isPublic: boolean; visibility: 'Public' | 'Hidden' | 'Suspended' | 'Archived'; businessLabel: string; isOpen: boolean };
