import { describe, expect, it } from "vitest";

import { isAuthorizedCronRequest } from "./cron-authorization";

const validSecret = "a-secure-cron-secret-with-enough-entropy";

describe("cron authorization", () => {
  it("rejects requests when the secret is missing or too short", () => {
    const spoofedVercelRequest = new Request("https://example.com/api/cron", {
      headers: {
        authorization: "Bearer short",
        "user-agent": "vercel-cron/1.0",
      },
    });

    expect(isAuthorizedCronRequest(spoofedVercelRequest, undefined)).toBe(false);
    expect(isAuthorizedCronRequest(spoofedVercelRequest, "short")).toBe(false);
  });

  it("rejects a spoofed Vercel user agent without the bearer secret", () => {
    const request = new Request("https://example.com/api/cron", {
      headers: {
        "user-agent": "vercel-cron/1.0",
      },
    });

    expect(isAuthorizedCronRequest(request, validSecret)).toBe(false);
  });

  it("accepts only the configured bearer secret", () => {
    const invalidRequest = new Request("https://example.com/api/cron", {
      headers: {
        authorization: "Bearer another-secure-secret-value",
      },
    });
    const validRequest = new Request("https://example.com/api/cron", {
      headers: {
        authorization: `Bearer ${validSecret}`,
      },
    });

    expect(isAuthorizedCronRequest(invalidRequest, validSecret)).toBe(false);
    expect(isAuthorizedCronRequest(validRequest, validSecret)).toBe(true);
  });
});
