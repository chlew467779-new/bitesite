/* bitesite/components/sections/story-hero.tsx */

import { StoryBackLabel, StoryDate } from "./story-detail-text";
import { SafeImage } from "@/app/components/safe-image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PublicArticle } from "@/types";

interface StoryHeroProps {
  article: PublicArticle;
  theme?: string;
}

const themeColors = {
  // Site palette (docs/DESIGN.md): ink, ink-2, brand, line, brand-soft, muted.
  default: {
    heading: '#17201B',
    body: '#3D4741',
    accent: '#1F4D3A',
    border: '#E3E7DF',
    tagBg: '#EAF2EC',
    tagText: '#1F4D3A',
    bodyLight: '#5B655E',
    tagBorder: '#E3E7DF',
    tagBgWhite: '#FFFFFF',
  },
  warm: {
    heading: '#4A3728',
    body: '#6B5B4F',
    accent: '#B87333',
    border: '#E8DDD0',
    tagBg: 'rgba(184, 115, 51, 0.1)',
    tagText: '#B87333',
    bodyLight: '#9A8B7D',
    tagBorder: '#E8DDD0',
    tagBgWhite: '#FFFFFF',
  },
  cool: {
    heading: '#2D3748',
    body: '#4A5568',
    accent: '#4A90A4',
    border: '#E2E8F0',
    tagBg: 'rgba(74, 144, 164, 0.1)',
    tagText: '#4A90A4',
    bodyLight: '#718096',
    tagBorder: '#E2E8F0',
    tagBgWhite: '#FFFFFF',
  },
  dark: {
    heading: '#E8E8E8',
    body: '#B0B0B0',
    accent: '#D4A853',
    border: '#333333',
    tagBg: 'rgba(212, 168, 83, 0.2)',
    tagText: '#D4A853',
    bodyLight: '#888888',
    tagBorder: '#333333',
    tagBgWhite: '#1A1A1A',
  },
  nature: {
    heading: '#2C3E2D',
    body: '#5A6B5C',
    accent: '#5A8F6E',
    border: '#D0DDC8',
    tagBg: 'rgba(90, 143, 110, 0.1)',
    tagText: '#5A8F6E',
    bodyLight: '#7A8F7B',
    tagBorder: '#D0DDC8',
    tagBgWhite: '#FFFFFF',
  },
  minimal: {
    heading: '#1A1A1A',
    body: '#666666',
    accent: '#1A1A1A',
    border: '#E5E5E5',
    tagBg: 'rgba(26, 26, 26, 0.1)',
    tagText: '#1A1A1A',
    bodyLight: '#888888',
    tagBorder: '#E5E5E5',
    tagBgWhite: '#FFFFFF',
  },
};

export function StoryHero({ article, theme = 'default' }: StoryHeroProps) {
  const colors = themeColors[(theme as keyof typeof themeColors) || 'default'] || themeColors.default;
  


  return (
    <section className="px-4 pt-6 pb-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Back button */}
        <Link
          href="/stories"
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: colors.bodyLight }}
        >
          <ArrowLeft className="h-4 w-4" />
          <StoryBackLabel />
        </Link>

        {/* Category & Tags */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span 
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{ backgroundColor: colors.tagBg, color: colors.tagText }}
          >
            {article.category}
          </span>
          {article.tags?.map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={{ borderColor: colors.tagBorder, backgroundColor: colors.tagBgWhite, color: colors.bodyLight }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Title */}
        <h1 
          className="mb-4 text-[30px] font-extrabold leading-[1.1] tracking-[-0.03em] [text-wrap:balance] sm:text-4xl md:text-5xl"
          style={{ color: colors.heading }}
        >
          {article.title}
        </h1>

        {/* Meta */}
        <div className="mb-8 flex flex-wrap items-center gap-3 text-sm" style={{ color: colors.bodyLight }}>
          <span className="font-medium" style={{ color: colors.body }}>{article.author}</span>
          <span>·</span>
          <StoryDate value={article.created_at} />
        </div>

        {/* Cover Image */}
        {article.cover_image && (
          <div className="relative aspect-[16/9] overflow-hidden rounded-[20px] bg-surface">
            <SafeImage
              src={article.cover_image}
              alt={article.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}
      </div>
    </section>
  );
}
