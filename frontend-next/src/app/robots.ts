import type { MetadataRoute } from "next";

const siteUrl = "https://www.alt-text.pro";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/connect",
        "/dashboard",
        "/email-confirmed",
        "/payment-cancelled",
        "/payment-success",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
