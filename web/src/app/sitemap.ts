import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://setu-web-504310368574.asia-south1.run.app";

// Public, indexable routes only. The authenticated app is intentionally omitted.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/", priority: 1.0, freq: "weekly" },
    { path: "/login", priority: 0.6, freq: "monthly" },
    { path: "/signup", priority: 0.7, freq: "monthly" },
    { path: "/contact", priority: 0.5, freq: "monthly" },
    { path: "/privacy", priority: 0.3, freq: "yearly" },
    { path: "/terms", priority: 0.3, freq: "yearly" },
  ];
  return routes.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
