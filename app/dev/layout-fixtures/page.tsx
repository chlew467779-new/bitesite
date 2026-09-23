/* bitesite/app/dev/layout-fixtures/page.tsx */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { layouts } from "@/app/layouts";
import { LAYOUT_KEYS, getLayoutMeta, resolveRegisteredLayoutKey } from "@/lib/layout-registry.mjs";
import { analyticsSuppressedProps } from "@/lib/analytics";
import {
  DISH_STATES,
  IMAGE_STATES,
  PRICE_STATES,
  FIXTURE_CATEGORIES,
  buildMerchant,
  buildProducts,
  pick,
} from "./fixtures";

/**
 * Development-only layout fixtures.
 *
 * Renders the real public layout components against in-memory data, so price/availability states
 * can be reviewed and screenshotted without a database and without touching any merchant. It is
 * the tool used for the visual QA of show_prices, and it is meant to be reused when new layouts
 * are added.
 *
 * Safety properties, all asserted in scripts/test-layout-fixtures-safety.mjs:
 *  - It 404s unless NODE_ENV === "development", before it reads the query string or builds
 *    anything. It is therefore unreachable in production and on Vercel Preview.
 *  - It imports no Supabase client, no admin/merchant auth and no tracker component, and reads
 *    nothing from the network: every merchant, category and dish below is a literal in this file.
 *  - The layouts themselves embed MenuViewTracker, which fires without any interaction, so the
 *    whole preview is wrapped in the non-recording boundary from lib/analytics.ts. Nothing here
 *    can write analytics rows even when a dev server points at the production database.
 *  - Query parameters only select from the fixed sets below; no value from the URL is ever
 *    rendered, used as a URL, or written anywhere.
 *  - noindex, nofollow, and nothing in the app links here.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Layout fixtures (development only)",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LayoutFixturesPage({ searchParams }: PageProps) {
  // Before anything else: unreachable outside a local development server.
  if (process.env.NODE_ENV !== "development") notFound();

  const params = await searchParams;
  const { key: layoutKey } = resolveRegisteredLayoutKey(params.layout);
  const price = pick(params.price, PRICE_STATES, "normal");
  const dish = pick(params.state, DISH_STATES, "default");
  const image = pick(params.image, IMAGE_STATES, "with");

  const LayoutComponent = layouts[layoutKey];
  const merchant = buildMerchant(layoutKey, image);
  const products = buildProducts(price, dish, image);

  const href = (next: Record<string, string>) => {
    const query = new URLSearchParams({ layout: layoutKey, price, state: dish, image, ...next });
    return `/dev/layout-fixtures?${query.toString()}`;
  };

  const groups: { label: string; options: { value: string; param: string }[] }[] = [
    { label: "Layout", options: LAYOUT_KEYS.map((key) => ({ value: key, param: "layout" })) },
    { label: "Price", options: PRICE_STATES.map((value) => ({ value, param: "price" })) },
    { label: "Dish state", options: DISH_STATES.map((value) => ({ value, param: "state" })) },
    { label: "Image", options: IMAGE_STATES.map((value) => ({ value, param: "image" })) },
  ];
  const current: Record<string, string> = { layout: layoutKey, price, state: dish, image };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="px-4 py-3 text-slate-300 text-xs space-y-2 border-b border-slate-800">
        <p className="font-semibold text-amber-400">
          Development fixtures — fictional data, no database, no analytics. Not reachable in production.
        </p>
        <p>
          Rendering <strong>{getLayoutMeta(layoutKey).displayName}</strong>. Resize the browser for mobile (375px) and
          desktop (1440px) checks. Uncategorized dishes are not shown on the public menu, so dish-4 is expected to be
          absent below.
        </p>
        {groups.map((group) => (
          <div key={group.label} className="flex items-center gap-2 flex-wrap">
            <span className="w-20 shrink-0 text-slate-500">{group.label}</span>
            {group.options.map((option) => (
              <a
                key={`${group.label}-${option.value}`}
                href={href({ [option.param]: option.value })}
                className={
                  current[option.param] === option.value
                    ? "px-2 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
                }
              >
                {option.value}
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* Non-recording boundary: the layouts below embed trackers that fire without interaction. */}
      <div {...analyticsSuppressedProps}>
        <LayoutComponent
          merchant={merchant}
          categories={FIXTURE_CATEGORIES}
          products={products}
          features={merchant.features}
          footerText="Development fixtures"
        />
      </div>
    </div>
  );
}
