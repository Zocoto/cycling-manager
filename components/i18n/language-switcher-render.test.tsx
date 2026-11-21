import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LanguageSwitcher } from "./language-switcher";

const state = vi.hoisted(() => ({ pathname: "/", locale: "fr", setLocale: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname, useRouter: () => ({ refresh: state.refresh }) }));
vi.mock("./locale-provider", () => ({ useLocale: () => ({ locale: state.locale, setLocale: state.setLocale }) }));

beforeEach(() => {
  state.pathname = "/";
  state.locale = "fr";
});

describe("language switcher navigation", () => {
  it.each([["/", "/en"], ["/guide", "/en/guide"], ["/a-propos", "/en/about"]])(
    "renders crawlable native locale anchors at %s", (pathname, englishPath) => {
      state.pathname = pathname;
      const html = renderToStaticMarkup(<LanguageSwitcher compact />);
      expect(html).toContain(`href="${pathname}"`);
      expect(html).toContain(`href="${englishPath}"`);
      expect(html).toContain('hrefLang="en"');
      expect(html).toContain('data-navigation-mode="document"');
      expect(html).not.toContain("<button");
    },
  );

  it("links English URLs back to the existing French pathname", () => {
    state.pathname = "/en/about";
    state.locale = "en";
    const html = renderToStaticMarkup(<LanguageSwitcher />);
    expect(html).toContain('href="/a-propos"');
    expect(html).toContain('href="/en/about"');
  });

  it("offers the English home page for untranslated public news", () => {
    state.pathname = "/nouveautes/news-id";
    const html = renderToStaticMarkup(<LanguageSwitcher />);
    expect(html).toContain('href="/nouveautes/news-id"');
    expect(html).toContain('href="/en"');
    expect(html).not.toContain("/en/nouveautes");
  });

  it.each(["/jeu", "/jeu/guide", "/connexion", "/inscription"])(
    "preserves cookie-based language buttons at %s", (pathname) => {
      state.pathname = pathname;
      const html = renderToStaticMarkup(<LanguageSwitcher />);
      expect(html.match(/<button/g)).toHaveLength(2);
      expect(html).not.toContain("<a ");
    },
  );
});
