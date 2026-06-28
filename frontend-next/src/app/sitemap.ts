import type { MetadataRoute } from "next";

const siteUrl = "https://www.alt-text.pro";

const routes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/ai-alt-text-generator-for-wordpress", changeFrequency: "weekly", priority: 0.9 },
  { path: "/woocommerce-product-image-alt-text", changeFrequency: "weekly", priority: 0.85 },
  { path: "/bulk-generate-alt-text-wordpress", changeFrequency: "weekly", priority: 0.85 },
  { path: "/docs", changeFrequency: "monthly", priority: 0.7 },
  { path: "/alt-text-simulator", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
] satisfies Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}>;

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
