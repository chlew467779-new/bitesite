import { cn } from "@/lib/utils";
import type { StyleConfig } from "@/lib/styles";

interface TextImageBlockProps {
  title: string;
  description: string;
  imageUrl: string;
  imageAlt: string;
  reversed?: boolean;
  style: StyleConfig;
}

export function TextImageBlock({
  title,
  description,
  imageUrl,
  imageAlt,
  reversed = false,
  style,
}: TextImageBlockProps) {
  return (
    <section className="px-4 py-12 md:py-16" style={{ backgroundColor: style.bg }}>
      <div className="mx-auto max-w-6xl">
        <div
          className={cn(
            "flex flex-col gap-8 md:flex-row md:items-center",
            reversed && "md:flex-row-reverse"
          )}
        >
          <div className="md:w-1/2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
              <img
                src={imageUrl}
                alt={imageAlt}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="md:w-1/2">
            <h3
              className="mb-4 text-2xl font-medium md:text-3xl"
              style={{ fontFamily: style.fontSerif, color: style.text }}
            >
              {title}
            </h3>
            <p className="text-base leading-relaxed md:text-lg" style={{ color: style.text2 }}>
              {description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
