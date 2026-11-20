import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({ authenticated: true, createClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => runtime.createClient(...args),
}));

import { updateSession } from "./proxy";

beforeEach(() => {
  runtime.authenticated = true;
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-key");
  runtime.createClient.mockReset().mockImplementation((
    _url: string,
    _key: string,
    options: { cookies: { setAll: (cookies: Array<{ name: string; value: string; options: { path: string; httpOnly: boolean } }>) => void } },
  ) => ({
    auth: {
      getClaims: async () => {
        options.cookies.setAll([{ name: "fixture-session", value: "refreshed", options: { path: "/", httpOnly: true } }]);
        return { data: { claims: runtime.authenticated ? { sub: "fixture-user" } : null }, error: null };
      },
    },
  }));
});
afterEach(() => vi.unstubAllEnvs());

describe("authenticated login redirects", () => {
  it.each([
    [undefined, "/jeu"],
    ["/apercus/noel/index.html", "/apercus/noel/index.html"],
    ["/apercus/noel/index.html#tournee", "/apercus/noel/index.html#tournee"],
    ["https://example.test", "/jeu"],
    ["//example.test", "/jeu"],
  ])("preserves a safe returnTo and refreshed cookies (%s)", async (returnTo, expectedPath) => {
    const url = new URL("https://cyclostratege.fr/connexion");
    if (returnTo) url.searchParams.set("returnTo", returnTo);
    const response = await updateSession(new NextRequest(url));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://cyclostratege.fr${expectedPath}`);
    expect(response.cookies.get("fixture-session")).toMatchObject({ value: "refreshed", httpOnly: true, path: "/" });
  });

  it("keeps the registration redirect on the game", async () => {
    const response = await updateSession(new NextRequest(
      "https://cyclostratege.fr/inscription?returnTo=%2Fapercus%2Fnoel%2Findex.html",
    ));
    expect(response.headers.get("location")).toBe("https://cyclostratege.fr/jeu");
  });

  it("lets an anonymous visitor use the login form", async () => {
    runtime.authenticated = false;
    const response = await updateSession(new NextRequest(
      "https://cyclostratege.fr/connexion?returnTo=%2Fapercus%2Fnoel%2Findex.html",
    ));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("fixture-session")?.value).toBe("refreshed");
  });

  it("preserves the existing protected game redirect and refreshed cookie", async () => {
    runtime.authenticated = false;
    const response = await updateSession(new NextRequest("https://cyclostratege.fr/jeu/effectif?tri=age"));
    expect(response.headers.get("location")).toBe("https://cyclostratege.fr/connexion");
    expect(response.cookies.get("fixture-session")?.value).toBe("refreshed");
  });
});
