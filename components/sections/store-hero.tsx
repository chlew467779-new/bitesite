import type { Merchant } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface StoreHeroProps {
  merchant: Merchant;
  style: StyleConfig;
}

export function StoreHero({ merchant, style }: StoreHeroProps) {
  return (
    <section className="relative h-[60vh] min-h-[400px] overflow-hidden">
      <img
        src={merchant.cover_image}
        alt={`${merchant.name} cover`}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 z-10 flex items-end justify-center pb-16 px-4 bg-gradient-to-t from-black/60 to-transparent">
        <div className="text-center">
          <p className="mb-2 text-sm uppercase tracking-widest" style={{ color: style.accent }}>
            {merchant.cuisine_type}
          </p>
          <h1 className="text-4xl md:text-7xl font-bold text-white" style={{ fontFamily: style.fontSerif }}>
            {merchant.name}
          </h1>
        </div>
      </div>
    </section>
  );
}
