import { ClassicLayout } from "./classic-layout";
import ElegantLayout from "./elegant-layout";
import MinimalLayout from "./minimal-layout";
import ModernLayout from "./modern-layout";
import RusticLayout from "./rustic-layout";

export const layouts = {
  classic: ClassicLayout,
  elegant: ElegantLayout,
  minimal: MinimalLayout,
  modern: ModernLayout,
  rustic: RusticLayout,
};

export type LayoutKey = keyof typeof layouts;
