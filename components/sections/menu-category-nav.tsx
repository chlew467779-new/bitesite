"use client";

import { useRef } from "react";
import type { Category, Product } from "@/types";
import type { LayoutKey } from "@/lib/layout-registry.mjs";
import { getLayoutTheme } from "@/lib/layout-theme.mjs";

export function menuCategoryId(id: string) {
  return `menu-category-${encodeURIComponent(id)}`;
}

/** Only rendered categories count; labels scroll horizontally within the menu at narrow widths. */
export function MenuCategoryNav({ categories, products, variant }: { categories: Category[]; products: Product[]; variant: LayoutKey }) {
  const ref = useRef<HTMLElement>(null);
  const categoryIds = new Set(products.map(p => p.category_id));
  const visible = categories.filter(category => categoryIds.has(category.id));
  if (visible.length < 4) return null;

  const jump = (id: string) => {
    const target = document.getElementById(menuCategoryId(id));
    if (!target) return;
    const layout = ref.current?.closest('[data-restaurant-layout]');
    let offset = 0;
    for (const bar of layout?.querySelectorAll<HTMLElement>('[data-menu-sticky]') ?? []) {
      offset = Math.max(offset, (parseFloat(getComputedStyle(bar).top) || 0) + bar.getBoundingClientRect().height);
    }
    const header = document.querySelector('header');
    if (header && getComputedStyle(header).position === 'sticky') offset = Math.max(offset, header.getBoundingClientRect().height);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Layout offsets stay stable while the menu's FadeIn wrapper translates.
    let documentTop = 0;
    for (let node: HTMLElement | null = target; node; node = node.offsetParent as HTMLElement | null) {
      documentTop += node.offsetTop;
      if (node.offsetParent instanceof HTMLElement) documentTop += node.offsetParent.clientTop;
    }
    window.scrollTo({ top: documentTop - offset - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
    target.querySelector<HTMLElement>('h3')?.focus({ preventScroll: true });
  };

  return (
    <nav ref={ref} aria-label="Menu categories" className="col-span-full mb-6 max-w-full overflow-x-auto pb-2">
      <div className="flex w-max gap-2">
        {visible.map(category => (
          <a key={category.id} href={`#${menuCategoryId(category.id)}`}
            onClick={event => { event.preventDefault(); jump(category.id); }}
            className={`inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap ${getLayoutTheme(variant).share.button}`}>
            {category.name}
          </a>
        ))}
      </div>
    </nav>
  );
}
