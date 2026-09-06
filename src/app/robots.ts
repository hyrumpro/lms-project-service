import type { MetadataRoute } from "next";

const BASE = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/api/", "/learn/"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
