import type { MerchantStyle } from "@/types";

export interface StyleConfig {
  bg: string;
  bg2: string;
  text: string;
  text2: string;
  muted: string;
  accent: string;
  accentHover: string;
  price: string;
  border: string;
  footerBg: string;
  footerText: string;
  fontSerif: string;
  fontSans: string;
}

export const styleMap: Record<MerchantStyle, StyleConfig> = {
  fresh: {
    bg: "#FAFBF7",
    bg2: "#F0F4EC",
    text: "#2C3E2D",
    text2: "#6B6560",
    muted: "#8A968B",
    accent: "#5A8F6E",
    accentHover: "#4A7A5E",
    price: "#C4785A",
    border: "#DDE5DC",
    footerBg: "#1A1A1A",
    footerText: "#A0A0A0",
    fontSerif: "var(--font-playfair)",
    fontSans: "var(--font-inter)",
  },
  luxury: {
    bg: "#0F0F0F",
    bg2: "#1A1A1A",
    text: "#F5F0E8",
    text2: "#B8B0A0",
    muted: "#7A7268",
    accent: "#C9A96E",
    accentHover: "#B8955A",
    price: "#D4A574",
    border: "#2A2A2A",
    footerBg: "#0A0A0A",
    footerText: "#7A7268",
    fontSerif: "var(--font-cormorant)",
    fontSans: "var(--font-inter)",
  },
  japanese: {
    bg: "#F7F5F0",
    bg2: "#EDE9E0",
    text: "#2D2D2D",
    text2: "#6B6560",
    muted: "#9A958D",
    accent: "#6B8E6B",
    accentHover: "#5A7A5A",
    price: "#B85C3D",
    border: "#D8D4CC",
    footerBg: "#2D2D2D",
    footerText: "#9A958D",
    fontSerif: "var(--font-noto-serif-jp)",
    fontSans: "var(--font-noto-sans-jp)",
  },
};

export function getStyleConfig(style: MerchantStyle): StyleConfig {
  return styleMap[style] || styleMap.fresh;
}
