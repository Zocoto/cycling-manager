import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("nation ranking jersey loading", () => {
  const source = readFileSync("app/jeu/classements/page.tsx", "utf8");
  it("only requests jersey data on the UCI nations view", () => {
    expect(source).toContain('circuit === "uci" && view === "nations" && rankings');
  });
  it("renders published kits only, without loading another flag image for every uncustomized country", () => {
    expect(source).toContain('jerseys.has(entry.countryCode) ? <NationalFederationJersey');
    expect(source).toContain('aria-hidden="true" className="h-14 w-12 shrink-0"');
  });
});
