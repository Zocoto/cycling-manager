import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("LanguageSwitcher integration", () => {
  it("is visible in both the public and game headers", () => {
    const publicHeader = readFileSync(
      resolve(process.cwd(), "components/layout/public-header.tsx"),
      "utf8",
    );
    const gameHeader = readFileSync(
      resolve(process.cwd(), "components/game/game-header.tsx"),
      "utf8",
    );

    expect(publicHeader).toContain("<LanguageSwitcher compact />");
    expect(gameHeader).toContain("<LanguageSwitcher compact />");
  });

  it("persists the selected locale for the whole site", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/i18n/language-switcher.tsx"),
      "utf8",
    );

    expect(source).toContain("Path=/");
    expect(source).toContain("Max-Age=31536000");
    expect(source).toContain("router.refresh()");
  });
});
