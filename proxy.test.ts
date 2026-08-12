import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "./proxy";

describe("proxy route coverage", () => {
  it.each(["/guide", "/guide/debuter"])(
    "keeps the public guide route %s outside the session proxy",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(false);
    },
  );

  it.each(["/jeu", "/jeu/effectif", "/connexion", "/inscription"])(
    "refreshes the session on protected or authentication route %s",
    (url) => {
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url,
        }),
      ).toBe(true);
    },
  );

  it("leaves unrelated public pages outside the session proxy", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig: {},
        url: "/a-propos",
      }),
    ).toBe(false);
  });
});