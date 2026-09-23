/* bitesite/lib/layout-theme.d.mts */

/**
 * Types for lib/layout-theme.mjs. Every field is a complete, literal Tailwind class string.
 * The slot list here, LAYOUT_THEME_SLOTS in the .mjs, and each theme object must match;
 * scripts/test-layout-theme.mjs asserts all three.
 */

import type { LayoutKey } from "./layout-registry.mjs";

export interface GalleryTheme {
  readonly sectionBg: string;
  readonly title: string;
}

export interface SeasonalTheme {
  readonly sectionBg: string;
  readonly card: string;
  readonly text: string;
  readonly badge: string;
}

export interface ReviewsTheme {
  readonly sectionBg: string;
  readonly card: string;
  readonly text: string;
  readonly dotActive: string;
  readonly dotInactive: string;
  readonly arrow: string;
}

export interface AppointmentTheme {
  readonly sectionBg: string;
  readonly card: string;
  readonly text: string;
  /** Colour classes only; the component adds the shared sizing/shape classes in front. */
  readonly input: string;
  readonly buttonPrimary: string;
  /** Icon on the "Request Sent!" confirmation. */
  readonly successIcon: string;
}

export interface EventsTheme {
  readonly sectionBg: string;
  readonly card: string;
  readonly text: string;
  readonly dateBadge: string;
}

export interface ShareTheme {
  readonly button: string;
}

export interface RelatedMerchantsTheme {
  readonly section: string;
  readonly title: string;
  readonly viewAll: string;
  readonly viewAllHover: string;
  readonly cardBg: string;
  readonly cardBorder: string;
  readonly cuisineTagBorder: string;
  readonly cuisineTagBg: string;
  readonly cuisineTagText: string;
  readonly areaTagBg: string;
  readonly areaTagText: string;
  readonly hoursText: string;
  readonly viewMenu: string;
  readonly viewMenuHover: string;
  readonly closedBadge: string;
}

export interface LayoutTheme {
  readonly gallery: GalleryTheme;
  readonly seasonal: SeasonalTheme;
  readonly reviews: ReviewsTheme;
  readonly appointment: AppointmentTheme;
  readonly events: EventsTheme;
  readonly share: ShareTheme;
  readonly related: RelatedMerchantsTheme;
}

export declare const LAYOUT_THEME_SLOTS: {
  readonly [Group in keyof LayoutTheme]: readonly (keyof LayoutTheme[Group])[];
};

export declare const LAYOUT_THEMES: Readonly<Record<LayoutKey, LayoutTheme>>;

/** Theme for a layout key; unregistered or theme-less values get the default (Classic) theme. */
export declare function getLayoutTheme(key: unknown): LayoutTheme;
