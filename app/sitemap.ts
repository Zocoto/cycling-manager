import type { MetadataRoute } from "next";

import { getAbsoluteUrl } from "@/lib/app-config";

const launchDate = new Date("2026-08-16T00:00:00+02:00");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: getAbsoluteUrl("/"),
      lastModified: launchDate,
      changeFrequency: "weekly",
      priority: 1,
      images: [getAbsoluteUrl("/images/marketing/season-2-beta-editorial.png")],
    },
    {
      url: getAbsoluteUrl("/beta-saison-2"),
      lastModified: launchDate,
      changeFrequency: "weekly",
      priority: 0.95,
      images: [getAbsoluteUrl("/images/marketing/season-2-beta-editorial.png")],
    },
    {
      url: getAbsoluteUrl("/guide"),
      lastModified: launchDate,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: getAbsoluteUrl("/nouveautes"),
      lastModified: launchDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl("/a-propos"),
      lastModified: launchDate,
      changeFrequency: "monthly",
      priority: 0.65,
    },
    {
      url: getAbsoluteUrl("/inscription"),
      lastModified: launchDate,
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
