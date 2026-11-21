import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ locale: vi.fn(), notFound: vi.fn(() => { throw new Error("not-found"); }) }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: mocks.locale }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/public/public-link", () => ({ default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} /> }));

import Page, { generateMetadata } from "./page";
import { EnglishGameGuide } from "@/components/public/english-game-guide";
import { EnglishAbout } from "@/components/public/english-about";
import { getPublicGuide, PUBLIC_GUIDE_SLUGS } from "@/lib/seo/public-guides";

beforeEach(() => { vi.clearAllMocks(); mocks.locale.mockResolvedValue("fr"); });

describe("public practical guides", () => {
  it.each(PUBLIC_GUIDE_SLUGS)("renders useful FR and EN content without login for %s", async topic => {
    for (const locale of ["fr", "en"] as const) {
      mocks.locale.mockResolvedValue(locale);
      const params = Promise.resolve({ topic });
      const html = renderToStaticMarkup(await Page({ params }));
      const copy = getPublicGuide(topic, locale);
      expect(html).toContain(copy.title);
      expect(html.match(/<h1\b/g)).toHaveLength(1);
      expect(html.match(/id="etape-/g)).toHaveLength(4);
      expect(html).toContain(copy.sections[0].paragraphs[0]);
      expect(html).toContain('href="/inscription"');
      expect(html).not.toContain('href="/jeu');
      expect(html.match(/href="\/guide\//g)).toHaveLength(2);
      expect((await generateMetadata({ params })).alternates?.canonical).toBe(`https://cyclostratege.fr${locale === "en" ? "/en" : ""}/guide/${topic}`);
    }
  });

  it("rejects unknown guide paths before rendering a page or metadata", async () => {
    const props = { params: Promise.resolve({ topic: "unknown" }) };
    await expect(Page(props)).rejects.toThrow("not-found");
    await expect(generateMetadata(props)).rejects.toThrow("not-found");
    expect(mocks.locale).not.toHaveBeenCalled();
  });

  it("provides English guide and about text before client translation", () => {
    const guide = renderToStaticMarkup(<EnglishGameGuide />);
    const about = renderToStaticMarkup(<EnglishAbout />);
    expect(guide).toContain("Your first steps in Cyclo Stratège.");
    expect(guide).toContain("Physical form and morale");
    expect(guide).toContain('id="courses"');
    expect(guide).toContain('id="equipe"');
    expect(guide).toContain('id="progression"');
    expect(guide).not.toContain("Le guide complet du");
    expect(about).toContain("A cycling game built around sporting decisions.");
    expect(about).not.toContain("Un jeu pensé par");
  });
});
