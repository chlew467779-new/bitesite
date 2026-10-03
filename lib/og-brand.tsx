/* bitesite/lib/og-brand.tsx */

/**
 * Brand pieces for generated images (share cards, icons): the leaf mark from
 * components/ui/bitesite-logo.tsx as an SVG data URI, the brand colours, and a font loader.
 * Share cards are PNG because WhatsApp and other link previews show PNG/JPEG reliably, while
 * restaurant covers are stored as WebP.
 */

export const BRAND = { green: "#5A8F6E", ink: "#2C3E2D", paper: "#FAFBF7", muted: "#6B6560" } as const;
export const OG_SIZE = { width: 1200, height: 630 } as const;

const LEAF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none">
<circle cx="28" cy="28" r="26" stroke="${BRAND.green}" stroke-width="2.5" fill="#FFFFFF"/>
<path d="M28 14 C28 14, 20 24, 20 34 C20 40, 24 44, 28 44 C32 44, 36 40, 36 34 C36 24, 28 14, 28 14Z" fill="${BRAND.green}" fill-opacity="0.15"/>
<path d="M28 16 C28 16, 22 25, 22 34 C22 39, 25 42, 28 42 C31 42, 34 39, 34 34 C34 25, 28 16, 28 16Z" stroke="${BRAND.green}" stroke-width="2" fill="none"/>
<line x1="28" y1="16" x2="28" y2="42" stroke="${BRAND.green}" stroke-width="1.5"/>
</svg>`;

export const LEAF_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LEAF_SVG).toString("base64")}`;

export function LeafMark({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not in the browser
  return <img src={LEAF_DATA_URI} width={size} height={size} alt="" />;
}

/**
 * A Google Font cut down to the characters actually drawn (so a Chinese restaurant name loads a
 * few kilobytes, not the whole font). Null when it cannot be fetched; the card then falls back to
 * the built-in font instead of failing.
 */
export async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`, { cache: "force-cache" })).text();
    const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const response = await fetch(url, { cache: "force-cache" });
    return response.ok ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Any character outside Latin, so the card needs a CJK font. */
export function needsCjkFont(text: string) {
  return /[^\u0000-\u024F\u2000-\u206F]/.test(text);
}

type CardFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/**
 * Fonts for a card. Every text block names its font: the body font comes first so it is the
 * fallback, and the subset fonts (Playfair for the wordmark, Noto Sans SC for non-Latin names)
 * never lend their few glyphs to other text.
 */
export async function cardFonts({ body, wordmark, cjk }: { body: string; wordmark?: string; cjk?: string }): Promise<CardFont[]> {
  const [regular, bold, title, chinese] = await Promise.all([
    loadGoogleFont("Noto Sans", 400, body),
    loadGoogleFont("Noto Sans", 700, body),
    wordmark ? loadGoogleFont("Playfair Display", 700, wordmark) : Promise.resolve(null),
    cjk && needsCjkFont(cjk) ? loadGoogleFont("Noto Sans SC", 700, cjk) : Promise.resolve(null),
  ]);
  const fonts: CardFont[] = [];
  if (regular) fonts.push({ name: "Body", data: regular, weight: 400, style: "normal" });
  if (bold) fonts.push({ name: "Body", data: bold, weight: 700, style: "normal" });
  if (title) fonts.push({ name: "Wordmark", data: title, weight: 700, style: "normal" });
  if (chinese) fonts.push({ name: "CJK", data: chinese, weight: 700, style: "normal" });
  return fonts;
}

export const hasFont = (fonts: CardFont[], name: string) => fonts.some((f) => f.name === name);
