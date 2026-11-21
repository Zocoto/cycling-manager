import { describe, expect, it } from "vitest";

import { getAuthenticationLocaleHref, getLocalizedPublicHref, getPublicRouteInfo, PUBLIC_LOCALIZED_ROUTES } from "./public-routes";

describe("public locale routes", () => {
  it.each(PUBLIC_LOCALIZED_ROUTES)("maps only the translated pair $fr and $en", ({ fr, en }) => {
    expect(getLocalizedPublicHref(fr, "en")).toBe(en);
    expect(getLocalizedPublicHref(en, "fr")).toBe(fr);
    expect(getPublicRouteInfo(fr)).toEqual({ locale: "fr", canonicalPath: fr, localizedPath: fr, availableLocales: ["fr", "en"] });
    expect(getPublicRouteInfo(en)).toEqual({ locale: "en", canonicalPath: fr, localizedPath: en, availableLocales: ["fr", "en"] });
  });

  it("preserves queries and fragments byte for byte", () => {
    expect(getLocalizedPublicHref("/guide?from=home%20page#calendrier", "en")).toBe("/en/guide?from=home%20page#calendrier");
    expect(getLocalizedPublicHref("/en/about#faq?keep=this", "fr")).toBe("/a-propos#faq?keep=this");
  });

  it.each([
    "/jeu", "/jeu/courses/tour#inscription", "/api/game/news", "/connexion",
    "/inscription", "/guide/debuter", "/guide/unknown", "/en/jeu", "/en/api/game/news",
    "/en/nouveautes", "/logo.png", "/en/about/team", "/en/a-propos",
    "https://example.com/guide?from=home#intro", "//example.com/guide", "guide", "#guide", "?guide=1",
  ])("leaves an unlisted href untouched: %s", (href) => {
    expect(getLocalizedPublicHref(href, "en")).toBe(href);
    expect(getLocalizedPublicHref(href, "fr")).toBe(href);
    expect(getPublicRouteInfo(href)).toBeNull();
  });

  it.each(["/nouveautes", "/nouveautes/news-id", "/mentions-legales", "/confidentialite", "/conditions-utilisation"])(
    "keeps untranslated public content French at %s", (path) => {
      expect(getPublicRouteInfo(path)).toEqual({ locale: "fr", canonicalPath: path, localizedPath: path, availableLocales: ["fr"] });
      expect(getLocalizedPublicHref(path, "en")).toBe(path);
    },
  );
});

describe("account link language", () => {
  it.each(["/connexion", "/inscription"])("carries the chosen language in %s before JavaScript runs", (pathname) => {
    expect(getAuthenticationLocaleHref(pathname, "en")).toBe(`${pathname}?lang=en`);
    expect(getAuthenticationLocaleHref(pathname, "fr")).toBe(`${pathname}?lang=fr`);
  });

  it("preserves other query values, their encoding and the fragment", () => {
    expect(getAuthenticationLocaleHref("/inscription?from=home%20page&returnTo=%2Fjeu#team", "en"))
      .toBe("/inscription?from=home%20page&returnTo=%2Fjeu&lang=en#team");
  });

  it("replaces conflicting or duplicate language parameters only", () => {
    expect(getAuthenticationLocaleHref("/connexion?lang=fr&from=a%20b&l%61ng=invalid#login", "en"))
      .toBe("/connexion?from=a%20b&lang=en#login");
  });

  it.each(["/jeu?from=home#team", "/en/connexion", "https://example.com/connexion", "//example.com/inscription", "/api/connexion"])(
    "leaves unrelated destinations untouched: %s", (href) => {
      expect(getAuthenticationLocaleHref(href, "en")).toBe(href);
    },
  );
});
