import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SPONSORS } from "@/data/sponsors";
import { DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT } from "@/lib/game/secondary-sponsor";
import { SecondarySponsorJerseyEditor } from "./secondary-sponsor-jersey-editor";

vi.mock("./actions", () => ({ updateSecondarySponsorLogoAction: vi.fn() }));
vi.mock("@/components/game/sponsor-jersey-preview", () => ({
  SponsorJerseyPreview: ({ secondaryLogoPlacement }: { secondaryLogoPlacement: { colorMode?: string } }) => <div data-preview-color={secondaryLogoPlacement.colorMode} />,
}));
const sponsor = {
  id: "contrast", name: "Colombia partenaire", countryCode: "CO", countryName: "Colombie",
  prestige: 3 as const, primaryColor: "#123456", accentColor: "#FEDCBA", logoVariant: "badge" as const,
};

describe("secondary sponsor jersey editor", () => {
  it("offers distinct black and white previews and restores the persisted selection", () => {
    const html = renderToStaticMarkup(<SecondarySponsorJerseyEditor contractId="contract" principalSponsor={SPONSORS[0]} jersey={SPONSORS[0].jerseys[0]} secondarySponsor={sponsor} initialPlacement={{ ...DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT, colorMode: "white" }} />);
    expect(html).toContain('data-preview-color="white"');
    expect(html).toContain('name="contractId" value="contract"');
    const radios = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    expect(radios).toHaveLength(3);
    expect(radios.find(radio => radio.includes('value="white"'))).toContain('checked=""');
    expect(radios.find(radio => radio.includes('value="black"'))).not.toContain('checked=""');
    expect(html).toContain("Noir");
    expect(html).toContain("Blanc");
    expect(html).toContain('data-secondary-logo-color="black"');
    expect(html).toContain('data-secondary-logo-color="white"');
  });
});
