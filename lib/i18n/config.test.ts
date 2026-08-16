import { describe, expect, it } from "vitest";

import { getIntlLocale, normalizeLocale } from "@/lib/i18n/config";

describe("i18n config", () => {
  it("normalizes supported locale values and falls back to French", () => {
    expect(normalizeLocale("en-GB")).toBe("en");
    expect(normalizeLocale("FR_fr")).toBe("fr");
    expect(normalizeLocale("de")).toBe("fr");
    expect(normalizeLocale(null)).toBe("fr");
  });

  it("uses stable regional formats", () => {
    expect(getIntlLocale("fr")).toBe("fr-FR");
    expect(getIntlLocale("en")).toBe("en-GB");
  });
});
