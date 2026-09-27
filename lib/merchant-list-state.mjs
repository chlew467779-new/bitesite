/** Display/filter rules mirror private.merchant_is_public; they never write state. */
export function merchantListState(merchant) {
  const managed = merchant.state_source === 'managed';
  const restriction = managed ? merchant.platform_restriction :
    merchant.platform_status === 'ARCHIVED' ? 'archived' : merchant.platform_status === 'SUSPENDED' ? 'suspended' : 'none';
  const isPublic = managed
    ? merchant.review_status === 'approved' && merchant.listing_visibility === 'public' && restriction === 'none' && ['OPEN', 'TEMPORARILY_CLOSED'].includes(merchant.business_status)
    : merchant.is_published === true && restriction === 'none';
  const businessStatus = merchant.business_status ?? (merchant.status === 'inactive' ? 'TEMPORARILY_CLOSED' : 'OPEN');
  const businessLabel = { OPEN: 'Open', TEMPORARILY_CLOSED: 'Temporarily closed', MOVED: 'Moved', PERMANENTLY_CLOSED: 'Permanently closed' }[businessStatus] ?? 'Unknown';
  return { isPublic, visibility: restriction === 'archived' ? 'Archived' : restriction === 'suspended' ? 'Suspended' : isPublic ? 'Public' : 'Hidden', businessLabel, isOpen: businessStatus === 'OPEN' };
}
