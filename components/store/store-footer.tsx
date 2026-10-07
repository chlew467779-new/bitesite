/* bitesite/components/store/store-footer.tsx */

"use client";

import Link from "next/link";
import { chipClasses } from "@/components/ui/chip";
import { discoveryPath, discoverySlug } from "@/lib/discovery-core.mjs";
import { presetLabel, useLang, useT } from "@/lib/i18n";

/** Links to this restaurant's area and cuisine landing pages (internal links for visitors and search). */
export function DiscoveryLinks({ area, cuisines }: { area: string | null; cuisines: string[] }) {
  const t = useT();
  const lang = useLang();
  const links = [
    ...(area ? [{ href: discoveryPath("area", discoverySlug(area)), label: t("store.moreArea", { area }) }] : []),
    ...cuisines.slice(0, 3).map((c) => ({ href: discoveryPath("cuisine", discoverySlug(c)), label: t("store.moreCuisine", { cuisine: presetLabel(lang, c) }) })),
  ];
  if (links.length === 0) return null;
  return (
    <nav aria-label={t("store.similarLabel")} className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 pt-6">
      {links.map((link) => (
        <a key={link.href} href={link.href} className={chipClasses()}>{link.label}</a>
      ))}
    </nav>
  );
}

/**
 * "More on BiteSite" and "Send feedback" under the restaurant page. The Admin footer text is
 * English site content, so other languages show the standard wording instead.
 */
export function StoreFooterLinks({ footerText }: { footerText?: string | null }) {
  const t = useT();
  const lang = useLang();
  const home = lang === "en" && footerText ? footerText : t("store.footerDefault");
  return (
    <nav aria-label="BiteSite" className="flex flex-wrap gap-x-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-brand">{home}</Link>
      <Link href="/feedback" className="inline-flex min-h-11 items-center text-sm text-ink-2 hover:text-brand">{t("store.feedback")}</Link>
    </nav>
  );
}
