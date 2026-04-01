import type { MetadataRoute } from "next";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const isProduction = BASE_URL === "https://devfesttoulouse.fr";

export default function robots(): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
