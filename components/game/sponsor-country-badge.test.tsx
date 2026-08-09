import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getSponsorCountryName,
  SponsorCountryBadge,
} from "@/components/game/sponsor-country-badge";

describe("nationalité visible du sponsor", () => {
  it("affiche le drapeau et le nom français du pays", () => {
    const markup = renderToStaticMarkup(
      <SponsorCountryBadge countryCode="FR" />,
    );

    expect(markup).toContain("fi-fr");
    expect(markup).toContain("France");
    expect(markup).toContain("Nationalité du sponsor");
  });

  it("normalise le code pays avant de résoudre son nom", () => {
    expect(getSponsorCountryName(" be ")).toBe("Belgique");
  });
});
