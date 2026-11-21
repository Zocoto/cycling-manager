import { getRewrittenUrl, unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME } from "./lib/i18n/config";
import { PUBLIC_LOCALIZED_ROUTES, PUBLIC_LOCALE_HEADER } from "./lib/i18n/public-routes";
import { config, proxy } from "./proxy";

const session = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("./lib/supabase/proxy", () => ({ updateSession: session.update }));

beforeEach(() => {
  session.update.mockReset();
  session.update.mockImplementation(async () => NextResponse.next());
});

function request(path: string, locale = "en") {
  return new NextRequest(`https://cyclostratege.com${path}`, {
    headers: { cookie: `${LOCALE_COOKIE_NAME}=${locale}`, [PUBLIC_LOCALE_HEADER]: "en" },
  });
}

describe("public locale proxy", () => {
  it.each(PUBLIC_LOCALIZED_ROUTES)("forwards the English locale to the native public route $en", async ({ en }) => {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: en })).toBe(true);
    const response = await proxy(request(`${en}?from=search`, "fr"));
    expect(getRewrittenUrl(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get(`x-middleware-request-${PUBLIC_LOCALE_HEADER}`)).toBe("en");
    expect(response.cookies.getAll()).toEqual([]);
    expect(session.update).not.toHaveBeenCalled();
  });

  it("keeps loopback hosts on their native route instead of creating an external rewrite", async () => {
    const response = await proxy(new NextRequest("http://127.0.0.1:3423/en?from=search", {
      headers: { cookie: `${LOCALE_COOKIE_NAME}=fr` },
    }));
    expect(getRewrittenUrl(response)).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get(`x-middleware-request-${PUBLIC_LOCALE_HEADER}`)).toBe("en");
    expect(session.update).not.toHaveBeenCalled();
  });

  it.each(["/", "/guide", "/a-propos", "/presse", "/nouveautes", "/nouveautes/news-id", "/mentions-legales", "/confidentialite", "/conditions-utilisation"])(
    "keeps %s French despite an English cookie or forged header", async (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
      const response = await proxy(request(path));
      expect(getRewrittenUrl(response)).toBeNull();
      expect(response.headers.get(`x-middleware-request-${PUBLIC_LOCALE_HEADER}`)).toBe("fr");
      expect(session.update).not.toHaveBeenCalled();
    },
  );

  it.each(["/en/jeu", "/en/jeu/effectif", "/en/api/game/news", "/en/connexion", "/en/nouveautes", "/en/guide/debuter", "/en/unknown"])(
    "returns 404 for unlisted English paths without rewriting or session work: %s", async (path) => {
      const response = await proxy(request(path));
      expect(response.status).toBe(404);
      expect(getRewrittenUrl(response)).toBeNull();
      expect(session.update).not.toHaveBeenCalled();
    },
  );
});

describe("session proxy coverage", () => {
  it.each([
    ["/connexion", "en", "fr"], ["/inscription", "en", "fr"],
    ["/connexion", "fr", "en"], ["/inscription", "fr", "en"],
  ])("applies a validated account language before session handling: %s?lang=%s", async (pathname, locale, cookie) => {
    const incoming = request(`${pathname}?lang=${locale}`, cookie);
    const response = await proxy(incoming);
    expect(session.update).toHaveBeenCalledExactlyOnceWith(incoming);
    expect(incoming.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe(locale);
    expect(response.cookies.get(LOCALE_COOKIE_NAME)).toMatchObject({ value: locale, path: "/", maxAge: 31536000, sameSite: "lax", secure: true });
  });

  it.each(["/jeu?lang=en", "/jeu/effectif?lang=en", "/connexion?lang=de", "/inscription?lang=EN"])(
    "ignores language changes outside the validated account boundary: %s", async (pathname) => {
      const incoming = request(pathname, "fr");
      const response = await proxy(incoming);
      expect(incoming.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe("fr");
      expect(response.cookies.get(LOCALE_COOKIE_NAME)).toBeUndefined();
    },
  );

  it("keeps session cookies when adding the account language preference", async () => {
    session.update.mockImplementation(async () => {
      const response = NextResponse.next();
      response.cookies.set("session-fixture", "preserved", { httpOnly: true });
      return response;
    });
    const response = await proxy(request("/connexion?lang=en", "fr"));
    expect(response.cookies.get("session-fixture")?.value).toBe("preserved");
    expect(response.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe("en");
  });

  it.each(["/jeu", "/jeu/effectif", "/connexion", "/inscription"])(
    "retains the existing session flow for %s and removes public locale overrides", async (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(true);
      const incoming = request(path);
      await proxy(incoming);
      expect(session.update).toHaveBeenCalledExactlyOnceWith(incoming);
      expect(incoming.headers.has(PUBLIC_LOCALE_HEADER)).toBe(false);
      expect(incoming.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe("en");
    },
  );

  it.each(["/api/game/news", "/logo.png", "/_next/static/app.js", "/mot-de-passe-oublie"])(
    "does not expand proxy coverage to %s", (path) => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: path })).toBe(false);
    },
  );

  it("does not start session work on an unknown French guide", async () => {
    const response = await proxy(request("/guide/debuter"));
    expect(response.status).toBe(200);
    expect(getRewrittenUrl(response)).toBeNull();
    expect(session.update).not.toHaveBeenCalled();
  });
});
