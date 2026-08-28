/* bitesite/components/sections/story-content.tsx */

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trackEvent } from '@/lib/analytics';

interface StoryContentProps {
  content: string;
  articleSlug: string;  // ← 新增
}

export function StoryContent({ content, articleSlug }: StoryContentProps) {  // ← 解构新增
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
              // ... 其他组件不变 ...
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
                          detail: articleSlug  // ← 新增：带上文章 slug
                        });
                      }}
                      className="font-medium text-[#5A8F6E] underline underline-offset-2 transition-colors hover:text-[#4A7A5E]"
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
                    className="font-medium text-[#5A8F6E] underline underline-offset-2 transition-colors hover:text-[#4A7A5E]"
                  >
                    {children}
                  </a>
                );
              },
              // ... 其他组件不变 ...
            }}
          >
            {processedContent}
          </ReactMarkdown>
        </div>
      </div>
    </section>
  );
}
