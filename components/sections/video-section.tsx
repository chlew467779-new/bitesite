import type { Merchant, MerchantVideo } from "@/types";
import type { StyleConfig } from "@/lib/styles";

interface VideoSectionProps {
  merchant: Merchant;
  videos?: MerchantVideo[];
  style: StyleConfig;
}

function getYouTubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return null;
}

export function VideoSection({ merchant, videos = [], style }: VideoSectionProps) {
  const allVideos: { url: string; type: "youtube" | "self_hosted"; caption?: string | null }[] = [];

  if (merchant.video_url && merchant.video_type !== "none") {
    allVideos.push({
      url: merchant.video_url,
      type: (merchant.video_type as "youtube" | "self_hosted") || "youtube",
      caption: merchant.video_caption,
    });
  }

  videos.forEach((v) => {
    allVideos.push({
      url: v.video_url,
      type: v.video_type,
      caption: v.caption,
    });
  });

  if (allVideos.length === 0) return null;

  return (
    <section className="px-4 py-12 md:py-16" style={{ backgroundColor: style.bg }}>
      <div className="mx-auto max-w-4xl space-y-12">
        {allVideos.map((video, index) => (
          <div key={index}>
            <div className="relative aspect-video overflow-hidden rounded-xl" style={{ backgroundColor: style.bg2 }}>
              {video.type === "youtube" ? (
                (() => {
                  const embedUrl = getYouTubeEmbedUrl(video.url);
                  return embedUrl ? (
                    <iframe
                      src={embedUrl}
                      title={`Video ${index + 1}`}
                      className="absolute inset-0 h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ color: style.muted }}>
                      Invalid YouTube URL
                    </div>
                  );
                })()
              ) : (
                <video src={video.url} controls className="h-full w-full" preload="metadata" />
              )}
            </div>
            {video.caption && (
              <p className="mt-3 text-center text-sm" style={{ color: style.muted }}>
                {video.caption}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
