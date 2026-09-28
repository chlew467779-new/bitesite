import type { Metadata } from 'next';
import { DiscoveryLandingPage, discoveryMetadata } from '@/app/components/discovery-landing';

export const revalidate = 300;

type Props = { params: Promise<{ area: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { area } = await params;
  return discoveryMetadata('area', area);
}

export default async function AreaPage({ params }: Props) {
  const { area } = await params;
  return <DiscoveryLandingPage kind="area" slug={area} />;
}
