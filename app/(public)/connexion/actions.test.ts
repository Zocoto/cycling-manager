import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { loginAccount } from "./actions";
import { initialLoginState } from "./login-state";

function loginForm(returnTo?: string) {
  const form = new FormData();
  form.set("email", " Preview@Example.test ");
  form.set("password", "fixture-password");
  if (returnTo) form.set("returnTo", returnTo);
  return form;
}

beforeEach(() => {
  mocks.signInWithPassword.mockReset().mockResolvedValue({ error: null });
  mocks.redirect.mockReset().mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
});

describe("login destination", () => {
  it.each([
    [undefined, "/jeu"],
    ["/apercus/noel/index.html", "/apercus/noel/index.html"],
    ["/apercus/noel/index.html#tournee", "/apercus/noel/index.html#tournee"],
    ["https://example.test", "/jeu"],
    ["//example.test", "/jeu"],
    ["/apercus/noel/tournee.html", "/jeu"],
  ])("redirects after successful login with returnTo=%s", async (returnTo, destination) => {
    await expect(loginAccount(initialLoginState, loginForm(returnTo)))
      .rejects.toThrow(`redirect:${destination}`);
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(destination);
    expect(mocks.signInWithPassword).toHaveBeenCalledExactlyOnceWith({
      email: "preview@example.test", password: "fixture-password",
    });
  });

  it("keeps a failed login on the form without redirecting", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials" } });
    const result = await loginAccount(initialLoginState, loginForm("/apercus/noel/index.html#tournee"));
    expect(result).toMatchObject({ status: "error", fieldErrors: {} });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("validates credentials before any redirect or authentication", async () => {
    const form = loginForm("/apercus/noel/index.html");
    form.set("email", "invalid");
    expect(await loginAccount(initialLoginState, form)).toMatchObject({ status: "error" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
