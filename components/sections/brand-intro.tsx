import { DiamondSeparator } from "@/components/ui/diamond-separator";
import { CuisineTag } from "@/components/ui/cuisine-tag";
import type { Merchant } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface BrandIntroProps {
  merchant: Merchant;
  style: StyleConfig;
}

export function BrandIntro({ merchant, style }: BrandIntroProps) {
  const tags = merchant.cuisine_type
    ? merchant.cuisine_type.split(",").map((t) => t.trim())
    : [];

  return (
    <section className="px-4 py-16 text-center md:py-24" style={{ backgroundColor: style.bg }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          {tags.map((tag) => (
            <CuisineTag key={tag} label={tag} borderColor={style.border} textColor={style.muted} />
          ))}
        </div>
        <h1
          className="mb-2 text-3xl font-medium md:text-4xl lg:text-5xl"
          style={{ fontFamily: style.fontSerif, color: style.text }}
        >
          {merchant.name}
        </h1>
        <DiamondSeparator color={style.muted} />
        {merchant.description && (
          <div className="space-y-4 text-base leading-relaxed md:text-lg" style={{ color: style.text2 }}>
            {merchant.description.split("\n").map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        )}
        {merchant.whatsapp && (
          <a
            href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full border-2 px-8 py-3 text-sm font-medium uppercase tracking-wider transition-all duration-300"
            style={{ borderColor: style.accent, color: style.accent }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = style.accent;
              (e.target as HTMLElement).style.color = style.bg;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
              (e.target as HTMLElement).style.color = style.accent;
            }}
          >
            Message on WhatsApp
          </a>
        )}
      </div>
    </section>
  );
}
