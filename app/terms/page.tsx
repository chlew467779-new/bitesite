import type { Metadata } from 'next';
import { LegalHeading, LegalDate, LegalBack } from '@/app/components/legal-frame';
import { MERCHANT_TERMS_UPDATED, MERCHANT_TERMS_VERSION } from '@/lib/merchant-terms.mjs';
import { MerchantTermsCopy } from './terms-copy';

export const metadata: Metadata = { title: 'BiteSite Merchant Terms', description: 'Terms for restaurants that use BiteSite.' };

export default function MerchantTermsPage() {
  return <main className="min-h-screen bg-page px-4 py-10 sm:py-16">
    <article className="mx-auto max-w-2xl rounded-[20px] border border-line bg-page p-6 sm:p-10">
      <LegalHeading kind="terms" />
      <p className="mt-2 text-sm text-muted"><LegalDate date={MERCHANT_TERMS_UPDATED} version={MERCHANT_TERMS_VERSION} /></p>
      <div className="mt-8"><MerchantTermsCopy /></div>
      <LegalBack create />
    </article>
  </main>;
}
