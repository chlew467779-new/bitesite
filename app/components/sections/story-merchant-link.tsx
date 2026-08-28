/* bitesite/components/sections/story-content.tsx */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { trackEvent } from '@/lib/analytics';

interface StoryContentProps {
  content: string;
}

export function StoryContent({ content }: StoryContentProps) {
  const backslashN = String.fromCharCode(92, 110);
  const realNewline = String.fromCharCode(10);
  const processedContent = content.split(backslashN).join(realNewline);

  return (
    <section className="px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-6 mt-8 font-serif text-2xl font-medium text-[#2C3E2D] sm:text-3xl">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mb-4 mt-8 font-serif text-xl font-medium text-[#2C3E2D] sm:text-2xl">
                  {children}
                </h2>
              ),
              p: ({ children }) => (
                <p className="mb-4 text-base leading-relaxed text-[#6B6560]">
                  {children}
                </p>
              ),
              a: ({ href, children }) => {
                if (href?.startsWith("/store/")) {
                  const slug = href.replace("/store/", "");
                  return (
                    <Link
                      href={href}
                      onClick={() => {
                        trackEvent('story_to_merchant', { pageType: 'story', slug });
                      }}
                      className="font-medium text-[#5A8F6E] underline underline-offset-2 transition-colors hover:text-[#4A7A5E]"
                    >
                      {children}
                    </Link>
                  );
                }
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#5A8F6E] underline underline-offset-2 transition-colors hover:text-[#4A7A5E]"
                  >
                    {children}
                  </a>
                );
              },
              ul: ({ children }) => (
                <ul className="mb-4 ml-5 list-disc space-y-2 text-[#6B6560]">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="mb-4 ml-5 list-decimal space-y-2 text-[#6B6560]">
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
                    <p className="mt-2 text-center text-xs text-[#8A968B]">
                      {alt}
                    </p>
                  )}
                </div>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-6 border-l-4 border-[#5A8F6E] bg-[#F0F4EC] py-4 pl-4 pr-4 italic text-[#6B6560]">
                  {children}
                </blockquote>
              ),
              hr: () => <hr className="my-8 border-[#DDE5DC]" />,
              strong: ({ children }) => (
                <strong className="font-semibold text-[#2C3E2D]">
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
                <thead className="bg-[#F0F4EC]">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border border-[#DDE5DC] px-4 py-2 text-left font-semibold text-[#2C3E2D]">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-[#DDE5DC] px-4 py-2 text-[#6B6560]">
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
