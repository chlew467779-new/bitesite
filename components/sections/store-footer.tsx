/* bitesite/components/sections/store-footer.tsx */

import { Phone, MessageCircle } from "lucide-react";
import type { Merchant } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface StoreFooterProps {
  merchant: Merchant;
  style: StyleConfig;
}

export function StoreFooter({ merchant, style }: StoreFooterProps) {
  return (
    <footer className="px-4 py-16 text-center" style={{ backgroundColor: style.footerBg, color: style.footerText }}>
      <div className="mx-auto max-w-2xl">
        <h3 className="mb-2 text-2xl font-medium md:text-3xl" style={{ fontFamily: style.fontSerif, color: style.text }}>
          {merchant.name}
        </h3>
        {merchant.cuisine_type && (
          <p className="mb-6 text-sm uppercase tracking-widest" style={{ color: style.footerText }}>
            {merchant.cuisine_type}
          </p>
        )}

        {merchant.phone && (
          <a href={`tel:${merchant.phone}`} className="mb-5 inline-flex items-center gap-2 transition-colors hover:opacity-80" style={{ color: style.footerText }}>
            <Phone className="h-4 w-4" />
            {merchant.phone}
          </a>
        )}

        {merchant.whatsapp && (
          <div className="mt-4">
            <a
              href={`https://wa.me/${merchant.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-medium transition-colors"
              style={{ backgroundColor: style.accent, color: style.bg }}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp Us
            </a>
          </div>
        )}

        <div className="mt-12 border-t pt-6 text-xs" style={{ borderColor: "rgba(255,255,255,0.08)", color: style.footerText, opacity: 0.5 }}>
          Powered by BiteSite — Beautiful Menus for Local Restaurants
        </div>
      </div>
    </footer>
  );
}
