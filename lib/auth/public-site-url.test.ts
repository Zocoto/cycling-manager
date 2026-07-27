import { afterEach, describe, expect, it } from "vitest";

import { getPublicSiteUrl } from "@/lib/auth/public-site-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("getPublicSiteUrl", () => {
  it("normalizes the configured site URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "https://cyclostratege.fr///";

    expect(getPublicSiteUrl()).toBe(
      "https://cyclostratege.fr",
    );
  });

  it("accepts localhost for the local email flow", () => {
    process.env.NEXT_PUBLIC_SITE_URL =
      "http://localhost:3000";

    expect(getPublicSiteUrl()).toBe(
      "http://localhost:3000",
    );
  });

  it("rejects missing and unsafe protocols", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getPublicSiteUrl()).toBeNull();

    process.env.NEXT_PUBLIC_SITE_URL =
      "javascript:alert(1)";
    expect(getPublicSiteUrl()).toBeNull();
  });
});
