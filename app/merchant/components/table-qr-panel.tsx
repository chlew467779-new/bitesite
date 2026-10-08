'use client';

import { useT } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Printer } from 'lucide-react';
import { Button, buttonClasses } from '@/components/ui/button';
import { getSiteUrl } from '@/lib/site-url';
import { pageColour } from '@/lib/page-colours';
import { tableCardHtml } from '@/lib/table-qr-card.mjs';

/**
 * Table QR code (R4): made in the Owner's browser from the public page address, so nothing is
 * stored or sent. Download a picture, or print a ready-made table card (design: QR).
 */
export function TableQrPanel({ slug, name, layoutKey, isPublic }: { slug: string; name: string; layoutKey: string | null; isPublic: boolean }) {
  const t = useT();
  const url = `${getSiteUrl()}/store/${slug}`;
  const [svg, setSvg] = useState('');
  // The printable card as a blob: link, so it opens from a normal tap (no pop-up to block).
  const [cardUrl, setCardUrl] = useState('');
  const accent = pageColour(layoutKey).colour;
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    let blobUrl = '';
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#17201B', light: '#FFFFFF' } })
      .then((value) => {
        if (!live) return;
        blobUrl = URL.createObjectURL(new Blob([tableCardHtml({ name, url, accent, qrSvg: value })], { type: 'text/html' }));
        setSvg(value);
        setCardUrl(blobUrl);
      })
      .catch(() => { if (live) setMessage(t('owner.tableQr.couldNotMakeTheQrCode')); });
    return () => { live = false; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [url, name, accent, t]);

  const download = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 1200, margin: 2, errorCorrectionLevel: 'M' });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${slug}-menu-qr.png`;
      link.click();
    } catch {
      setMessage(t('owner.tableQr.couldNotMakeThePictureTry'));
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-[20px] bg-surface p-4 sm:flex-row sm:items-center">
      <div
        aria-hidden
        className="size-28 shrink-0 rounded-2xl bg-white p-2.5 [&_svg]:size-full"
        // SVG from the qrcode package, made from our own page address.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="min-w-0 space-y-2">
        <h3 className="text-base font-extrabold text-ink">{t('owner.tableQr.tableQrCode')}</h3>
        <p className="text-sm text-muted">
          {isPublic
            ? t('owner.tableQr.printItAndPutItOn')
            : t('owner.tableQr.yourQrCodeWorksOnceYour')}
        </p>
        <p className="break-all text-xs text-muted">{url}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {cardUrl && (
            <a href={cardUrl} target="_blank" rel="noopener" className={buttonClasses({ size: 'md' })}>
              <Printer size={16} aria-hidden />{t('owner.tableQr.printTableCard')}
            </a>
          )}
          <Button size="md" variant="secondary" onClick={() => void download()}><Download size={16} aria-hidden />{t('owner.tableQr.downloadPicture')}</Button>
        </div>
        {message && <p role="status" className="text-sm text-soldout">{message}</p>}
      </div>
    </div>
  );
}
