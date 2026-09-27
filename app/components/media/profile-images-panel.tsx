/* bitesite/app/components/media/profile-images-panel.tsx */
'use client';

/**
 * Cover photo + logo (M6b) for one restaurant: loads the current values from the media endpoint
 * (not from a possibly stale list row) and shows one ProfileImageField per slot. Used by the Admin
 * editor and the Merchant dashboard; the caller supplies the endpoint and the auth headers.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ProfileImageField } from './profile-image-field';
import type { MediaSlot } from '@/lib/merchant-media-core.mjs';

type Props = {
  apiBase: string;
  getHeaders: () => Promise<Record<string, string> | null>;
  disabled?: boolean;
  onChanged?: (slot: MediaSlot, value: string | null) => void;
};

export function ProfileImagesPanel({ apiBase, getHeaders, disabled, onChanged }: Props) {
  const [media, setMedia] = useState<{ logo: string | null; cover: string | null } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const headers = await getHeaders();
      if (!headers) { setError('Your session has ended. Sign in again.'); return; }
      const response = await fetch(apiBase, { headers, cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.data) { setError(data?.error?.message || 'Could not load the photos.'); return; }
      setMedia({ logo: data.data.logo ?? null, cover: data.data.cover ?? null });
    } catch {
      setError('Could not reach BiteSite. Check your connection.');
    }
  }, [apiBase, getHeaders]);

  useEffect(() => { void load(); }, [load]);

  const changed = (slot: MediaSlot) => (value: string | null) => {
    setMedia((current) => (current ? { ...current, [slot]: value } : current));
    onChanged?.(slot, value);
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error} <button type="button" className="ml-1 min-h-11 underline" onClick={() => void load()}>Try again</button></p>;
  if (!media) return <Loader2 className="h-5 w-5 animate-spin text-[#2C3E2D]" />;
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <ProfileImageField slot="cover" label="Cover photo" value={media.cover} apiBase={apiBase} getHeaders={getHeaders} onChanged={changed('cover')} disabled={disabled} />
      <ProfileImageField slot="logo" label="Logo" value={media.logo} apiBase={apiBase} getHeaders={getHeaders} onChanged={changed('logo')} disabled={disabled} />
    </div>
  );
}
