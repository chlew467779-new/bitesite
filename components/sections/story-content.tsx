/* bitesite/components/sections/story-content.tsx */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { trackEvent } from '@/lib/analytics';

interface StoryContentProps {
  content: string;
  articleSlug: string;
  theme?: string;
}

const themeColors = {
  default: {
    heading: '#2C3E2D',
    body: '#6B6560',
    accent: '#5A8F6E',
    quoteBg: '#F0F4EC',
    border: '#DDE5DC',
    bodyLight: '#8A968B',
  },
  warm: {
    heading: '#4A3728',
    body: '#6B5B4F',
    accent: '#B87333',
    quoteBg: '#FDF5ED',
    border: '#E8DDD0',
    bodyLight: '#9A8B7D',
  },
  cool: {
    heading: '#2D3748',
    body: '#4A5568',
    accent: '#4A90A4',
    quoteBg: '#EDF2F7',
    border: '#E2E8F0',
    bodyLight: '#718096',
  },
  dark: {
    heading: '#E8E8E8',
    body: '#B0B0B0',
    accent: '#D4A853',
    quoteBg: '#2A2A2A',
    border: '#333333',
    bodyLight: '#888888',
  },
  nature: {
    heading: '#2C3E2D',
    body: '#5A6B5C',
    accent: '#5A8F6E',
    quoteBg: '#E8F0E5',
    border: '#D0DDC8',
    bodyLight: '#7A8F7B',
  },
  minimal: {
    heading: '#1A1A1A',
    body: '#666666',
    accent: '#1A1A1A',
    quoteBg: '#F5F5F5',
    border: '#E5E5E5',
    bodyLight: '#888888',
  },
};

export function StoryContent({ content, articleSlug, theme = 'default' }: StoryContentProps) {
  const colors = themeColors[(theme as keyof typeof themeColors) || 'default'] || themeColors.default;

  // Handle both real newlines and escaped backslash-n from database/storage
  const processedContent = content
    .replace(/\\n/g, '\n')  // escaped backslash-n → real newline
    .replace(/\n/g, '\n');     // literal backslash-n → real newline (fallback)

  const cssVars = {
    '--sc-heading': colors.heading,
    '--sc-body': colors.body,
    '--sc-accent': colors.accent,
    '--sc-quote-bg': colors.quoteBg,
    '--sc-border': colors.border,
    '--sc-body-light': colors.bodyLight,
  } as React.CSSProperties;

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="max-w-none" style={cssVars}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-6 mt-8 font-serif text-2xl font-medium sm:text-3xl" style={{ color: 'var(--sc-heading)' }}>
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-4 mt-8 font-serif text-xl font-medium sm:text-2xl" style={{ color: 'var(--sc-heading)' }}>
                  {children}
                </h2>
              ),
              p: ({ children }) => (
                <p className="mb-4 text-base leading-relaxed" style={{ color: 'var(--sc-body)' }}>
                  {children}
                </p>
              ),
              a: ({ href, children }) => {
                if (href?.startsWith("/store/")) {
                  const merchantSlug = href.replace("/store/", "");
                  return (
                    <a
                      href={href}
                      onClick={() => {
                        trackEvent('story_to_merchant', { 
                          pageType: 'story', 
                          slug: merchantSlug,
                          detail: articleSlug
                        });
                      }}
                      className="font-medium underline underline-offset-2 transition-colors hover:opacity-80"
                      style={{ color: 'var(--sc-accent)' }}
                    >
                      {children}
                    </a>
                  );
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2 transition-colors hover:opacity-80"
                    style={{ color: 'var(--sc-accent)' }}
                  >
                    {children}
                  </a>
                );
              },
              ul: ({ children }) => (
                <ul className="mb-4 ml-5 list-disc space-y-2" style={{ color: 'var(--sc-body)' }}>
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 ml-5 list-decimal space-y-2" style={{ color: 'var(--sc-body)' }}>
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-base leading-relaxed">{children}</li>
              ),
              img: ({ src, alt }) => (
                <div className="my-6 overflow-hidden rounded-xl">
                  <img
                    src={src}
                    alt={alt || ""}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                  {alt && alt !== "" && (
                    <p className="mt-2 text-center text-xs" style={{ color: 'var(--sc-body-light)' }}>
                      {alt}
                    </p>
                  )}
                </div>
              ),
              blockquote: ({ children }) => (
                <blockquote 
                  className="my-6 border-l-4 py-4 pl-4 pr-4 italic" 
                  style={{ backgroundColor: 'var(--sc-quote-bg)', borderLeftColor: 'var(--sc-accent)', color: 'var(--sc-body)' }}
                >
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-8" style={{ borderColor: 'var(--sc-border)' }} />,
              strong: ({ children }) => (
                <strong className="font-semibold" style={{ color: 'var(--sc-heading)' }}>
                  {children}
                </strong>
              ),
              table: ({ children }) => (
                <div className="my-6 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead style={{ backgroundColor: 'var(--sc-quote-bg)' }}>{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border px-4 py-2 text-left font-semibold" style={{ color: 'var(--sc-heading)', borderColor: 'var(--sc-border)' }}>
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border px-4 py-2" style={{ color: 'var(--sc-body)', borderColor: 'var(--sc-border)' }}>
                  {children}
                </td>
              ),
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
