import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://setu-web-504310368574.asia-south1.run.app";

// Allow general crawlers and the major answer/generative engines to index the
// public marketing pages, while keeping the authenticated app out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/contact", "/privacy", "/terms", "/login", "/signup"],
        disallow: ["/dashboard", "/admin", "/cases", "/case/", "/intake", "/map"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
