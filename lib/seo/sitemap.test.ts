import { describe, expect, it } from "vitest";

import { getAbsoluteUrl } from "@/lib/app-config";
import { PUBLIC_LOCALIZED_ROUTES } from "@/lib/i18n/public-routes";
import { buildPublicSitemap } from "./sitemap";

describe("public sitemap", () => {
  it("pairs every translated public page with reciprocal language alternates", () => {
    const entries = buildPublicSitemap([]);
    for (const { fr, en } of PUBLIC_LOCALIZED_ROUTES) {
      const alternates = { languages: { fr: getAbsoluteUrl(fr), en: getAbsoluteUrl(en), "x-default": getAbsoluteUrl(fr) } };
      expect(entries.find((entry) => entry.url === getAbsoluteUrl(fr))).toEqual({ url: getAbsoluteUrl(fr), alternates });
      expect(entries.find((entry) => entry.url === getAbsoluteUrl(en))).toEqual({ url: getAbsoluteUrl(en), alternates });
    }
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);
  });

  it("uses published snapshot dates only for article pages and never invents static dates", () => {
    const article = { id: "00000000-0000-4000-8000-000000000001", publishedAt: "2026-10-22T08:00:00Z", updatedAt: "2026-11-20T09:00:00Z" };
    const entries = buildPublicSitemap([article]);
    expect(entries.filter((entry) => entry.lastModified)).toEqual([
      { url: getAbsoluteUrl(`/nouveautes/${article.id}`), lastModified: article.updatedAt },
    ]);
  });

  it("keeps untranslated news, registration and legal pages in French without English aliases", () => {
    const entries = buildPublicSitemap([]);
    for (const path of ["/nouveautes", "/inscription", "/mentions-legales", "/confidentialite", "/conditions-utilisation"]) {
      expect(entries).toContainEqual({ url: getAbsoluteUrl(path) });
      expect(entries.some((entry) => entry.url === getAbsoluteUrl(`/en${path}`))).toBe(false);
    }
    expect(entries.some((entry) => entry.url.includes("/jeu") || entry.url.includes("/connexion") || entry.url.includes("/apercus"))).toBe(false);
  });
});
