/* bitesite/app/layouts/index.ts    */

import type { ComponentType } from "react";
import type { LayoutProps } from "@/types";
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { ClassicLayout } from "./classic-layout";
import { ElegantLayout } from "./elegant-layout";
import { MinimalLayout } from "./minimal-layout";
import { ModernLayout } from "./modern-layout";
import { RusticLayout } from "./rustic-layout";

/**
 * Key → component map. `satisfies` makes typecheck fail if a key registered in
 * lib/layout-registry.mjs has no component here (or vice versa), so a new layout cannot be
 * half-added. Metadata (display name, description, production readiness) lives in the registry,
 * not here.
 */
export const layouts = {
  classic: ClassicLayout,
  elegant: ElegantLayout,
  minimal: MinimalLayout,
  modern: ModernLayout,
  rustic: RusticLayout,
} satisfies Record<LayoutKey, ComponentType<LayoutProps>>;

export type { LayoutKey };
