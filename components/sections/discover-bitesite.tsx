import type { StyleConfig } from "@/lib/styles";

interface DiscoverBiteSiteProps {
  style: StyleConfig;
}

export function DiscoverBiteSite({ style }: DiscoverBiteSiteProps) {
  return (
    <section className="py-16 text-center">
      <div className="mx-auto max-w-2xl px-4">
        <p>
          Discover more at{ " "}
          <a
            href="/"
            className="underline font-medium transition-colors hover:opacity-80"
            style={{ color: style.accent }}
          >
            BiteSite
          </a>
        </p>
      </div>
    </section>
  );
}
