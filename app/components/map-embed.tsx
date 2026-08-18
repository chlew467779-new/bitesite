/* bitesite/app/components/map-embed.tsx */

"use client";

interface MapEmbedProps {
  address: string | null | undefined;
  borderColor?: string;
}

export function MapEmbed({ address, borderColor = "#DDE5DC" }: MapEmbedProps) {
  if (!address) return null;

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  return (
    <div
      className="w-full rounded-xl overflow-hidden mt-5"
      style={{ border: `1px solid ${borderColor}` }}
    >
      <iframe
        src={embedUrl}
        width="100%"
        height="260"
        style={{ border: 0, display: "block" }}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Location map"
        className="grayscale-[20%] hover:grayscale-0 transition-all duration-500"
      />
    </div>
  );
}
