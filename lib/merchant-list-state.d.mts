export declare function merchantListState(merchant: {
  state_source?: string | null; platform_restriction?: string | null;
  platform_status?: string | null; is_published?: boolean | null;
  review_status?: string | null; listing_visibility?: string | null;
  business_status?: string | null; status?: string | null;
}): { isPublic: boolean; visibility: 'Public' | 'Hidden' | 'Suspended' | 'Archived'; businessLabel: string; isOpen: boolean };
