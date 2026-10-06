/* bitesite/app/layouts/index.ts    */

import { createElement, type ComponentType } from "react";
import type { LayoutProps } from "@/types";
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { StoreLayout, type PageStyle } from "./store-layout";

/**
 * Key → component map. Since T7 (CH 2026-10-05) every page style is the same structure
 * (store-layout.tsx) in its own colours. `satisfies` makes typecheck fail if a key registered in
 * lib/layout-registry.mjs has no component here (or vice versa). Metadata (display name,
 * description, production readiness) lives in the registry, not here.
 */
const styled = (style: PageStyle): ComponentType<LayoutProps> => {
  const Styled = (props: LayoutProps) => createElement(StoreLayout, { ...props, style });
  Styled.displayName = `StoreLayout(${style})`;
  return Styled;
};

export const layouts = {
  classic: styled("classic"),
  elegant: styled("elegant"),
  minimal: styled("minimal"),
  modern: styled("modern"),
  rustic: styled("rustic"),
  ocean: styled("ocean"),
  // Retired from the picker in T8 (productionReady: false, so the public page never reaches
  // these); kept registered because the database still accepts the values.
  chinese: styled("classic"),
  malay: styled("classic"),
} satisfies Record<LayoutKey, ComponentType<LayoutProps>>;

export type { LayoutKey };
