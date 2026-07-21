import { describe, expect, it } from "vitest";

import { getEmailCallbackCredentials } from "./email-callback";

describe("getEmailCallbackCredentials", () => {
  it("accepte un code PKCE", () => {
    const searchParams = new URLSearchParams({ code: "auth-code" });

    expect(
      getEmailCallbackCredentials(searchParams, "recovery")
    ).toEqual({ strategy: "code", code: "auth-code" });
  });

  it("accepte un token hash du type attendu", () => {
    const searchParams = new URLSearchParams({
      token_hash: "hashed-token",
      type: "recovery",
    });

    expect(
      getEmailCallbackCredentials(searchParams, "recovery")
    ).toEqual({
      strategy: "token-hash",
      tokenHash: "hashed-token",
      type: "recovery",
    });
  });

  it("refuse un token hash d’un autre parcours", () => {
    const searchParams = new URLSearchParams({
      token_hash: "hashed-token",
      type: "email",
    });

    expect(
      getEmailCallbackCredentials(searchParams, "recovery")
    ).toBeNull();
  });

  it("refuse une URL incomplète", () => {
    expect(
      getEmailCallbackCredentials(new URLSearchParams(), "email")
    ).toBeNull();
  });
});
