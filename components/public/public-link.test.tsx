import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PublicLink from "./public-link";

const state = vi.hoisted(() => ({ locale: "en" }));
vi.mock("@/components/i18n/locale-provider", () => ({ useLocale: () => ({ locale: state.locale }) }));

beforeEach(() => { state.locale = "en"; });

describe("public links", () => {
  it("renders the translated pathname while preserving its query and anchor", () => {
    const html = renderToStaticMarkup(<PublicLink href="/guide?from=home#courses">Guide</PublicLink>);
    expect(html).toContain('href="/en/guide?from=home#courses"');
  });

  it("supports URL objects without changing query or hash", () => {
    const html = renderToStaticMarkup(<PublicLink href={{ pathname: "/a-propos", query: { from: "guide" }, hash: "team" }}>About</PublicLink>);
    expect(html).toContain('href="/en/about?from=guide#team"');
  });

  it("maps an English public URL back to French", () => {
    state.locale = "fr";
    expect(renderToStaticMarkup(<PublicLink href="/en/about">About</PublicLink>)).toContain('href="/a-propos"');
  });

  it.each(["/jeu", "/logo.png", "https://example.com/guide"])(
    "keeps unrelated hrefs intact: %s", (href) => {
      const html = renderToStaticMarkup(<PublicLink href={href}>Link</PublicLink>);
      expect(html).toContain(`href="${href}"`);
      expect(html).not.toContain('data-navigation-mode="document"');
    },
  );

  it.each(["/connexion", "/inscription"])("keeps the auth pathname and carries language across document navigation: %s", (href) => {
    const html = renderToStaticMarkup(<PublicLink href={href}>Account</PublicLink>);
    expect(html).toContain(`href="${href}?lang=en"`);
    expect(html).toContain('data-navigation-mode="document"');
  });

  it("renders an account language query with the French public locale", () => {
    state.locale = "fr";
    const html = renderToStaticMarkup(<PublicLink href="/inscription?from=guide#team">Join</PublicLink>);
    expect(html).toContain('href="/inscription?from=guide&amp;lang=fr#team"');
  });

  it("carries account language through URL-object queries and explicit searches", () => {
    expect(renderToStaticMarkup(<PublicLink href={{ pathname: "/connexion", query: { returnTo: "/jeu", lang: "fr" }, hash: "form" }}>Login</PublicLink>))
      .toContain('href="/connexion?returnTo=%2Fjeu&amp;lang=en#form"');
    expect(renderToStaticMarkup(<PublicLink href={{ pathname: "/inscription", search: "?from=home%20page&lang=fr", hash: "form" }}>Join</PublicLink>))
      .toContain('href="/inscription?from=home%20page&amp;lang=en#form"');
    expect(renderToStaticMarkup(<PublicLink href={{ pathname: "/inscription", search: "from=home%20page", hash: "form" }}>Join</PublicLink>))
      .toContain('href="/inscription?from=home%20page&amp;lang=en#form"');
  });

  it("uses document navigation when English visitors follow French-only content", () => {
    const html = renderToStaticMarkup(<PublicLink href="/nouveautes/news-id">News</PublicLink>);
    expect(html).toContain('href="/nouveautes/news-id"');
    expect(html).toContain('data-navigation-mode="document"');
  });
});
