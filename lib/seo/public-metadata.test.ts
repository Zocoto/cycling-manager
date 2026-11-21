import { describe, expect, it } from "vitest";
import { buildPublicMetadata } from "./public-metadata";

describe("public localized metadata", () => {
  it.each([
    ["/", "/en"],
    ["/guide", "/en/guide"],
    ["/a-propos", "/en/about"],
    ["/presse", "/en/press"],
    ["/guide/premieres-courses", "/en/guide/premieres-courses"],
  ])("keeps self-canonicals and reciprocal alternatives for %s", (fr, en) => {
    for (const locale of ["fr", "en"] as const) {
      const metadata = buildPublicMetadata({ path: fr, locale, title: "Example", description: "Example description" });
      expect(metadata.alternates).toEqual({
        canonical: `https://cyclostratege.fr${locale === "en" ? en : fr}`,
        languages: { fr: `https://cyclostratege.fr${fr}`, en: `https://cyclostratege.fr${en}`, "x-default": `https://cyclostratege.fr${fr}` },
      });
      expect(metadata.openGraph).toMatchObject({
        locale: locale === "en" ? "en_GB" : "fr_FR",
        alternateLocale: [locale === "en" ? "fr_FR" : "en_GB"],
        title: "Example", description: "Example description",
      });
    }
  });

  it("does not advertise untranslated news as an English version", () => {
    const metadata = buildPublicMetadata({ path: "/nouveautes", locale: "fr", title: "News", description: "News description" });
    expect(metadata.alternates).toEqual({ canonical: "https://cyclostratege.fr/nouveautes" });
    expect(metadata.openGraph).not.toHaveProperty("alternateLocale");
  });
});
