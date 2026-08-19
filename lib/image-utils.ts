/* bitesite/lib/image-utils.ts */

/**
 * 自动给图片 URL 加上压缩参数
 * - Unsplash: 原生支持 w/q/auto=format
 * - Supabase Storage: 支持 width/quality 参数
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width: number = 800
): string {
  if (!url) return "";

  // 本地图片或 data URI 不处理
  if (url.startsWith("data:") || url.startsWith("/")) return url;

  try {
    const urlObj = new URL(url);

    // Unsplash 图片优化
    if (urlObj.hostname.includes("images.unsplash.com")) {
      urlObj.searchParams.set("w", String(width));
      urlObj.searchParams.set("q", "80");
      urlObj.searchParams.set("auto", "format");
      urlObj.searchParams.set("fit", "crop");
      return urlObj.toString();
    }

    // Supabase Storage 图片优化
    if (
      urlObj.hostname.includes("supabase.co") &&
      urlObj.pathname.includes("/object/public/")
    ) {
      urlObj.searchParams.set("width", String(width));
      urlObj.searchParams.set("quality", "80");
      return urlObj.toString();
    }

    return url;
  } catch {
    return url;
  }
}
