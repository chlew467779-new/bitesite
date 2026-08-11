import Image from "next/image";
import type { Merchant } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface StoreHeroProps {
  merchant: Merchant;
  style: StyleConfig;
}

export function StoreHero({ merchant, style }: StoreHeroProps) {
  return (
    <section className="relative w-full">
      <div className="relative hidden aspect-[16/7] w-full overflow-hidden md:block">
        {merchant.cover_image ? (
          <Image
            src={merchant.cover_image}
            alt={`${merchant.name} hero image`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ backgroundColor: style.bg2 }}>
            <span style={{ color: style.muted }}>No cover image</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: `linear-gradient(to top, ${style.bg}, transparent)` }} />
      </div>
      <div className="relative aspect-[3/4] w-full overflow-hidden md:hidden">
        {merchant.cover_image ? (
          <Image
            src={merchant.cover_image}
            alt={`${merchant.name} hero image`}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ backgroundColor: style.bg2 }}>
            <span style={{ color: style.muted }}>No cover image</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-32" style={{ background: `linear-gradient(to top, ${style.bg}, transparent)` }} />
      </div>
    </section>
  );
}
