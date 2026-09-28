import type { Metadata } from 'next';
import { ClaimClient } from './claim-client';

export const metadata: Metadata = { title: 'Claim your restaurant — BiteSite', robots: { index: false, follow: false } };

export default async function ClaimPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const restaurant = typeof params.restaurant === 'string' ? params.restaurant : null;
  return <ClaimClient slug={restaurant} />;
}
