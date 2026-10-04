import type { Metadata } from 'next';
import Link from 'next/link';
import { PRIVACY_CONTACT_EMAIL, PRIVACY_EFFECTIVE_DATE, PRIVACY_POLICY } from '@/lib/privacy-policy.mjs';

/** Privacy Policy (SYNC-071): English and Bahasa Melayu on one page, text in lib/privacy-policy.mjs. */

export const metadata: Metadata = {
  title: 'Privacy Policy · Dasar Privasi',
  description: 'How BiteSite uses information from restaurants and visitors. Cara BiteSite menggunakan maklumat restoran dan pelawat.',
  alternates: { canonical: '/privacy' },
};

type Block = string | { list: string[] } | { items: [string, string][] };
type Policy = { lang: string; heading: string; effective: string; sections: { title: string; blocks: Block[] }[] };

function withEmailLink(text: string) {
  const parts = text.split(PRIVACY_CONTACT_EMAIL);
  return parts.flatMap((part, index) => index === 0 ? [part] : [
    <a key={index} href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="break-all text-emerald-800 underline">{PRIVACY_CONTACT_EMAIL}</a>, part,
  ]);
}

function PolicyBlock({ block }: { block: Block }) {
  if (typeof block === 'string') return <p>{withEmailLink(block)}</p>;
  if ('list' in block) return <ul className="list-disc space-y-2 pl-5">{block.list.map((item) => <li key={item}>{withEmailLink(item)}</li>)}</ul>;
  return <dl className="space-y-3">{block.items.map(([label, text]) => (
    <div key={label} className="rounded-xl bg-[#F7F5F0] p-4">
      <dt className="font-semibold text-[#2C3E2D]">{label}</dt>
      <dd className="mt-1">{withEmailLink(text)}</dd>
    </div>
  ))}</dl>;
}

function PolicyText({ policy, id }: { policy: Policy; id: string }) {
  return <section id={id} lang={policy.lang} className="scroll-mt-24">
    <h2 className="font-serif text-3xl text-[#2C3E2D]">{policy.heading}</h2>
    <p className="mt-2 text-sm text-[#6B6560]"><time dateTime={PRIVACY_EFFECTIVE_DATE.iso}>{policy.effective}</time></p>
    <div className="mt-8 space-y-8 text-sm leading-7 text-[#4B4540]">
      {policy.sections.map((section) => <section key={section.title} className="space-y-3">
        <h3 className="font-serif text-xl text-[#2C3E2D]">{section.title}</h3>
        {section.blocks.map((block, index) => <PolicyBlock key={index} block={block} />)}
      </section>)}
    </div>
  </section>;
}

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#FAFBF7] px-4 py-10 sm:py-16">
    <article className="mx-auto max-w-2xl rounded-2xl border border-[#DDE5DC] bg-white p-6 sm:p-10">
      <h1 className="sr-only">BiteSite Privacy Policy · Dasar Privasi BiteSite</h1>
      <nav aria-label="Language / Bahasa" className="flex flex-wrap gap-2">
        <a href="#english" className="inline-flex min-h-11 items-center rounded-full border border-[#DDE5DC] px-4 text-sm font-medium text-[#2C3E2D]">English</a>
        <a href="#bahasa-melayu" className="inline-flex min-h-11 items-center rounded-full border border-[#DDE5DC] px-4 text-sm font-medium text-[#2C3E2D]">Bahasa Melayu</a>
      </nav>
      <div className="mt-8"><PolicyText policy={PRIVACY_POLICY.en as Policy} id="english" /></div>
      <hr className="my-12 border-[#DDE5DC]" />
      <PolicyText policy={PRIVACY_POLICY.ms as Policy} id="bahasa-melayu" />
      <Link href="/" className="mt-10 inline-flex min-h-11 items-center text-emerald-800 underline">Back to BiteSite</Link>
    </article>
  </main>;
}
