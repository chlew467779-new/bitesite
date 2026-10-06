'use client';

/**
 * Owner private preview of the restaurant page (`/merchant/preview?merchant=<id>`): the same layout
 * visitors see, rendered from GET /api/merchant/preview for the signed-in Owner, even while the
 * restaurant is a draft, waiting for review or approved but hidden. Analytics are suppressed for
 * the whole preview (data-bs-analytics), so previews never count as visits or clicks.
 *
 * `&as=admin` previews any restaurant for the signed-in Admin (review before approval), through
 * GET /api/admin/merchants/[id]/preview with the Admin session token.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { layouts } from '@/app/layouts';
import { resolvePublicLayoutKey } from '@/lib/layout-registry.mjs';
import { analyticsSuppressedProps } from '@/lib/analytics';
import { DeliveryOrderButtons } from '@/components/sections/delivery-order-buttons';
import { merchantApiUrl, merchantPageUrl, selectedMerchantIdFromSearch } from '@/lib/merchant-context-url.mjs';
import type { Category, EventItem, LayoutProps, MerchantVideo, Product, PublicMerchant } from '@/types';

type PreviewData = {
  merchant: PublicMerchant;
  categories: Category[];
  products: Product[];
  videos: MerchantVideo[];
  events: EventItem[];
  deliveryLinks?: { link_type: string; url: string }[];
  footerText: string | null;
  status: { public: boolean; stateSource: string; reviewStatus: string; restriction: string };
};
type State = { kind: 'loading' } | { kind: 'error'; message: string; signedOut?: boolean } | { kind: 'ready'; data: PreviewData };

function statusText(status: PreviewData['status']) {
  if (status.restriction === 'suspended') return 'Suspended by BiteSite — not visible to visitors.';
  if (status.restriction === 'archived') return 'Archived — not visible to visitors.';
  if (status.public) return 'This page is live. Visitors see it like this.';
  if (status.stateSource !== 'managed') return 'Not visible to visitors yet.';
  if (status.reviewStatus === 'pending') return 'Waiting for review — not visible to visitors yet.';
  if (status.reviewStatus === 'approved') return 'Approved — publish it from your dashboard when you are ready.';
  return 'Draft — not visible to visitors yet.';
}

export default function MerchantPreviewPage() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [asAdmin, setAsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const selected = selectedMerchantIdFromSearch(window.location.search);
      const admin = new URLSearchParams(window.location.search).get('as') === 'admin';
      setMerchantId(selected);
      setAsAdmin(admin);
      let url: string;
      let headers: Record<string, string>;
      if (admin) {
        let adminToken: string | null = null;
        try { adminToken = localStorage.getItem('admin_token'); } catch { adminToken = null; }
        if (!adminToken || !selected) { if (!cancelled) setState({ kind: 'error', message: 'Sign in to Admin first, then open the preview again.', signedOut: true }); return; }
        url = `/api/admin/merchants/${encodeURIComponent(selected)}/preview`;
        headers = { 'x-admin-token': adminToken };
      } else {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) { if (!cancelled) setState({ kind: 'error', message: 'Sign in to preview your restaurant page.', signedOut: true }); return; }
        url = merchantApiUrl('/api/merchant/preview', selected);
        headers = { Authorization: `Bearer ${token}` };
      }
      try {
        const response = await fetch(url, { headers, cache: 'no-store' });
        const body = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !body?.data) {
          setState({ kind: 'error', message: body?.error?.message || 'The preview could not be loaded.', signedOut: response.status === 401 });
          return;
        }
        setState({ kind: 'ready', data: body.data as PreviewData });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'Could not reach BiteSite. Check your connection and try again.' });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const back = asAdmin ? '/admin' : merchantPageUrl('/merchant', merchantId);
  const backLabel = asAdmin ? 'Back to Admin' : 'Back to dashboard';

  if (state.kind !== 'ready') {
    return (
      <main className="min-h-screen bg-[#FAFBF7] px-4 py-16" {...analyticsSuppressedProps}>
        <div className="mx-auto max-w-xl rounded-2xl border border-[#DDE5DC] bg-white p-6 text-[#2C3E2D]">
          <h1 className="font-serif text-2xl">Page preview</h1>
          <p className="mt-3 text-sm text-[#6B6560]" role={state.kind === 'error' ? 'alert' : 'status'}>{state.kind === 'loading' ? 'Loading your preview…' : state.message}</p>
          {state.kind === 'error' && (
            <Link href={state.signedOut ? (asAdmin ? '/admin' : '/merchant/login') : back} className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-[#2C3E2D] px-4 text-sm font-medium text-white sm:w-auto">
              {state.signedOut ? 'Sign in' : backLabel}
            </Link>
          )}
        </div>
      </main>
    );
  }

  const { data } = state;
  const Layout = layouts[resolvePublicLayoutKey(data.merchant.layout).key as keyof typeof layouts] as (props: LayoutProps) => React.ReactElement;
  return (
    <div {...analyticsSuppressedProps}>
      <div className="sticky top-0 z-[70] border-b border-amber-300 bg-amber-50 px-4 py-2 text-amber-950" role="status">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p><span className="font-semibold">{asAdmin ? 'Admin preview.' : 'Preview — only you can see this.'}</span> {statusText(data.status)}</p>
            <p className="mt-1">Changes waiting for BiteSite review (links, name, address, cuisine) are not shown here until approved.</p>
          </div>
          <Link href={back} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-amber-800 px-4 text-sm font-medium">{backLabel}</Link>
        </div>
      </div>
      <Layout
        merchant={data.merchant}
        categories={data.categories}
        products={data.products}
        videos={data.videos}
        features={data.merchant.features ?? undefined}
        events={data.events}
        footerText={data.footerText ?? undefined}
      />
      {/* Same order bar as the public page; clicks are not counted (analytics suppressed above). */}
      <DeliveryOrderButtons links={data.deliveryLinks ?? []} slug={data.merchant.slug} />
    </div>
  );
}
