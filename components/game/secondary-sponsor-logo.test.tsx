import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SecondarySponsorIdentity } from "@/lib/game/secondary-sponsor";
import { SecondarySponsorLogo } from "./secondary-sponsor-logo";

const sponsor: SecondarySponsorIdentity = {
  id: "contrast", name: "Colombia partenaire", countryCode: "CO", countryName: "Colombie",
  prestige: 3, primaryColor: "#123456", accentColor: "#FEDCBA", logoVariant: "badge",
};

describe("secondary sponsor logo contrast variants", () => {
  it.each(["badge", "monogram", "orbit", "stripe", "wordmark"] as const)("recolors the complete %s mark and lettering in both contrast variants", logoVariant => {
    for (const colorMode of ["black", "white"] as const) {
      const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={{ ...sponsor, logoVariant }} colorMode={colorMode} />);
      expect(html).toContain(`data-secondary-logo-color="${colorMode}"`);
      expect(html).toMatch(/(?:fill|stroke)="#111111"/);
      expect(html).toMatch(/(?:fill|stroke)="#FFFFFF"/);
      expect(html).not.toContain(sponsor.primaryColor);
      expect(html).not.toContain(sponsor.accentColor);
      expect(html).toContain("COLOMBIA PARTENAIRE");
    }
  });

  it("preserves the existing brand appearance when no mode is selected", () => {
    const html = renderToStaticMarkup(<SecondarySponsorLogo sponsor={sponsor} />);
    expect(html).toContain(sponsor.primaryColor);
    expect(html).toContain(sponsor.accentColor);
    expect(html).toContain('data-secondary-logo-color="original"');
  });
});
