"use client";
import Link from 'next/link';
import { buttonClasses } from '@/components/ui/button';
import { chipClasses } from '@/components/ui/chip';
import { useT, useLang, presetLabel } from '@/lib/i18n';
import { discoveryPath, type DiscoveryKind } from '@/lib/discovery-core.mjs';
export function DiscoveryHeading({ kind, label, count }: { kind: DiscoveryKind; label: string; count: number }) {
  const t = useT();
  const lang = useLang();
  const name = kind === 'cuisine' ? presetLabel(lang, label) : label;
  const title = t(kind === 'area' ? 'discovery.areaTitle' : 'discovery.cuisineTitle', { name });
  return <>
    <nav aria-label={t('discovery.breadcrumb')} className="text-sm text-muted"><ol className="flex flex-wrap items-center gap-1">
      <li><Link href="/" className={buttonClasses({ variant: 'ghost', size: 'md' })}>{t('nav.home')}</Link></li>
      <li aria-hidden="true">/</li><li aria-current="page" className="text-ink">{title}</li>
    </ol></nav>
    <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink md:text-[40px]">{t(kind === 'area' ? 'discovery.areaHeading' : 'discovery.cuisineHeading', { name })}</h1>
    <p className="mt-2 max-w-2xl text-muted">{t(kind === 'area' ? (count === 1 ? 'discovery.areaBodyOne' : 'discovery.areaBody') : (count === 1 ? 'discovery.cuisineBodyOne' : 'discovery.cuisineBody'), { count, name })}</p>
  </>;
}
export function DiscoveryMore() {
  const t = useT();
  return <h2 id="explore-more" className="text-2xl font-extrabold tracking-[-0.02em] text-ink">{t('discovery.more')}</h2>;
}
export function DiscoveryChips({ kind, groups }: { kind: DiscoveryKind; groups: { slug: string; label: string; count: number }[] }) {
  const t = useT();
  const lang = useLang();
  return <div className="mt-4">
    <h3 className="text-sm font-medium text-muted">{t(kind === 'area' ? 'discovery.areas' : 'discovery.cuisines')}</h3>
    <ul className="mt-2 flex flex-wrap gap-2">{groups.map(g => <li key={g.slug}>
      <Link href={discoveryPath(kind, g.slug)} className={chipClasses()}>{kind === 'cuisine' ? presetLabel(lang, g.label) : g.label} <span className="ml-1.5 text-xs text-muted">{g.count}</span></Link>
    </li>)}</ul>
  </div>;
}
