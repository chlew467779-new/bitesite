/* bitesite/lib/page-colours.ts */

/**
 * Owner-facing names for the page styles (R4, docs/DESIGN.md "Restaurant page styles"). The stored
 * value is still the layout key; since T7 a style only changes colour, so the picker shows colours.
 */
export const PAGE_COLOURS: Record<string, { name: string; colour: string; dark?: boolean }> = {
  modern: { name: "Forest", colour: "#1F4D3A" },
  classic: { name: "Amber", colour: "#8A4B0F" },
  rustic: { name: "Chilli", colour: "#A2341F" },
  minimal: { name: "Stone", colour: "#44403C" },
  elegant: { name: "Night", colour: "#0F172A", dark: true },
};

export function pageColour(layoutKey: string | null | undefined) {
  return PAGE_COLOURS[layoutKey ?? ""] ?? PAGE_COLOURS.classic;
}
