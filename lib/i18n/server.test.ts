import { beforeEach, describe, expect, it, vi } from "vitest";

import { LOCALE_COOKIE_NAME } from "./config";
import { PUBLIC_LOCALE_HEADER } from "./public-routes";
import { getRequestLocale } from "./server";

const dependencies = vi.hoisted(() => ({ headers: vi.fn(), cookies: vi.fn() }));
vi.mock("next/headers", () => dependencies);

beforeEach(() => {
  vi.resetAllMocks();
  dependencies.headers.mockResolvedValue(new Headers());
  dependencies.cookies.mockResolvedValue(new Map([[LOCALE_COOKIE_NAME, { value: "en" }]]));
});

describe("server locale", () => {
  it.each(["fr", "en"])("uses the proxy's public %s locale without consulting account cookies", async (locale) => {
    dependencies.headers.mockResolvedValue(new Headers({ [PUBLIC_LOCALE_HEADER]: locale }));
    expect(await getRequestLocale()).toBe(locale);
    expect(dependencies.cookies).not.toHaveBeenCalled();
  });

  it("preserves the existing cookie locale outside public routes", async () => {
    expect(await getRequestLocale()).toBe("en");
    dependencies.cookies.mockResolvedValue(new Map());
    expect(await getRequestLocale()).toBe("fr");
  });

  it("ignores an invalid public override", async () => {
    dependencies.headers.mockResolvedValue(new Headers({ [PUBLIC_LOCALE_HEADER]: "de" }));
    expect(await getRequestLocale()).toBe("en");
  });
});
