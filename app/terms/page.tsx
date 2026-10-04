import type { Metadata } from 'next';
import Link from 'next/link';
import { MERCHANT_TERMS_UPDATED, MERCHANT_TERMS_VERSION } from '@/lib/merchant-terms.mjs';
import { MerchantTermsCopy } from './terms-copy';

export const metadata: Metadata = { title: 'BiteSite Merchant Terms', description: 'Terms for restaurants that use BiteSite.' };

export default function MerchantTermsPage() {
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-10 sm:py-16">
    <article className="mx-auto max-w-2xl rounded-2xl border border-[#DDE5DC] bg-white p-6 sm:p-10">
      <h1 className="font-serif text-3xl text-[#2C3E2D]">BiteSite Merchant Terms</h1>
      <p className="mt-2 text-sm text-[#6B6560]">Last updated {MERCHANT_TERMS_UPDATED} · Version {MERCHANT_TERMS_VERSION}</p>
      <div className="mt-8"><MerchantTermsCopy /></div>
      <Link href="/merchant/new" className="mt-8 inline-flex min-h-11 items-center text-emerald-800 underline">Back to create a restaurant</Link>
    </article>
  </main>;
}
