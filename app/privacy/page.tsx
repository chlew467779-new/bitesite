import type { Metadata } from 'next';
import { LegalHeading, LegalDate, LegalNav, LegalBack } from '@/app/components/legal-frame';
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
    <a key={index} href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="break-all text-brand underline">{PRIVACY_CONTACT_EMAIL}</a>, part,
  ]);
}

function PolicyBlock({ block }: { block: Block }) {
  if (typeof block === 'string') return <p>{withEmailLink(block)}</p>;
  if ('list' in block) return <ul className="list-disc space-y-2 pl-5">{block.list.map((item) => <li key={item}>{withEmailLink(item)}</li>)}</ul>;
  return <dl className="space-y-3">{block.items.map(([label, text]) => (
    <div key={label} className="rounded-xl bg-surface p-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="mt-1">{withEmailLink(text)}</dd>
    </div>
  ))}</dl>;
}

function PolicyText({ policy, id }: { policy: Policy; id: string }) {
  return <section id={id} lang={policy.lang} className="scroll-mt-24">
    <h2 className="text-3xl text-ink">{policy.heading}</h2>
    <p className="mt-2 text-sm text-muted"><LegalDate date={PRIVACY_EFFECTIVE_DATE.iso} /></p>
    <div className="mt-8 space-y-8 text-sm leading-7 text-ink-2">
      {policy.sections.map((section) => <section key={section.title} className="space-y-3">
        <h3 className="text-xl text-ink">{section.title}</h3>
        {section.blocks.map((block, index) => <PolicyBlock key={index} block={block} />)}
      </section>)}
    </div>
  </section>;
}

export default function PrivacyPage() {
  return <main className="min-h-screen bg-page px-4 py-10 sm:py-16">
    <article className="mx-auto max-w-2xl rounded-[20px] border border-line bg-page p-6 sm:p-10">
      <LegalHeading kind="privacy" />
      <LegalNav />
      <div className="mt-8"><PolicyText policy={PRIVACY_POLICY.en as Policy} id="english" /></div>
      <hr className="my-12 border-line" />
      <PolicyText policy={PRIVACY_POLICY.ms as Policy} id="bahasa-melayu" />
      <LegalBack />
    </article>
  </main>;
}
