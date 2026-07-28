import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import { config } from "./proxy";

describe("proxy route coverage", () => {
  it.each(["/guide", "/guide/debuter"])(
    "refreshes the session on the public guide route %s",
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