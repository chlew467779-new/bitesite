/* bitesite/app/robots.ts */

import { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bitesite-pied.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
