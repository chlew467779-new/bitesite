import type { Metadata } from 'next';
import { DiscoveryLandingPage, discoveryMetadata } from '@/app/components/discovery-landing';

export const revalidate = 300;

type Props = { params: Promise<{ cuisine: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { cuisine } = await params;
  return discoveryMetadata('cuisine', cuisine);
}

export default async function CuisinePage({ params }: Props) {
  const { cuisine } = await params;
  return <DiscoveryLandingPage kind="cuisine" slug={cuisine} />;
}
