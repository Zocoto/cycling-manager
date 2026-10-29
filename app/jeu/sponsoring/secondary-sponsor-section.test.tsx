import type { AnchorHTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RaceQuickPreviewTarget } from "@/lib/game/race-quick-preview";
import { DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT } from "@/lib/game/secondary-sponsor";
import type { SecondarySponsorObjective } from "@/lib/game/secondary-sponsor";
import type { SecondarySponsorContract } from "@/services/secondary-sponsors";
import { SecondarySponsorSection } from "./secondary-sponsor-section";

const captured = vi.hoisted(() => ({ targets: [] as RaceQuickPreviewTarget[] }));
vi.mock("@/components/game/race-preview-link", () => ({
  RacePreviewLink: ({ previewTarget, children, ...props }: {
    previewTarget: RaceQuickPreviewTarget;
    children: ReactNode;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => {
    captured.targets.push(previewTarget);
    return <a {...props} data-race-preview-trigger="">{children}</a>;
  },
}));
vi.mock("./actions", () => ({
  signSecondarySponsorOfferAction: vi.fn(),
  updateSecondarySponsorLogoAction: vi.fn(),
}));

const S4_EDITION = "11111111-1111-4111-8111-111111111111";
const S5_EDITION = "22222222-2222-4222-8222-222222222222";
const sponsor = {
  id: "sponsor", name: "Partenaire test", countryCode: "FR", countryName: "France",
  prestige: 2 as const, primaryColor: "#176951", accentColor: "#F2C94C", logoVariant: "wordmark" as const,
};
const objective: SecondarySponsorObjective = {
  id: "objective", name: "Top 5 sur Tour test", raceLabel: "Tour test",
  raceSlug: "tour-test", raceEditionId: S5_EDITION, categoryCode: "national",
  targetRank: 5, cashReward: 15_000, status: "draft", bestRank: null,
};
const contract: SecondarySponsorContract = {
  id: "contract", status: "planned", seasonId: "s5", targetGameYear: 5,
  targetSeasonName: "Saison 5", sponsor, objectives: [objective],
  logoPlacement: DEFAULT_SECONDARY_SPONSOR_LOGO_PLACEMENT, baseJersey: null,
};

beforeEach(() => { captured.targets.length = 0; });

describe("secondary sponsor course previews", () => {
  it("uses the primary sponsor preview for unsigned offers and preserves their signature form", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "offers", activeContract: null, countryCode: "FR", countryName: "France",
      targetGameYear: 5, targetSeasonName: "Saison 5",
      offers: [{ id: "offer", sponsor, objectives: [objective], totalMaximumReward: 15_000 }],
    }} />);

    expect(captured.targets).toEqual([{ slug: "tour-test", stageNumber: null, raceEditionId: S5_EDITION }]);
    expect(html).toContain("Aperçu · course");
    expect(html).toContain("Top 5 sur Tour test");
    expect(html).toContain('href="/jeu/courses/tour-test"');
    expect(html).toContain('name="offerId" value="offer"');
    expect(html).toContain("Signer Partenaire test");
  });

  it("adds previews to a signed future contract without making nested links", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{ kind: "signed", activeContract: null, contract }} />);

    expect(captured.targets).toEqual([{ slug: "tour-test", stageNumber: null, raceEditionId: S5_EDITION }]);
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html.match(/<\/a>/g)).toHaveLength(1);
    expect(html).toContain("Aperçu · course");
    expect(html).toContain("Maillot principal à choisir d’abord");
    expect(html).not.toContain('name="offerId"');
  });

  it("keeps current and future contracts on their own editions and preserves achieved objectives", () => {
    const activeContract: SecondarySponsorContract = {
      ...contract, id: "active", status: "active", seasonId: "s4", targetGameYear: 4,
      targetSeasonName: "Saison 4", objectives: [{ ...objective, raceEditionId: S4_EDITION, status: "achieved", bestRank: 3 }],
    };
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{ kind: "signed", activeContract, contract }} />);

    expect(captured.targets.map((target) => target.raceEditionId)).toEqual([S4_EDITION, S5_EDITION]);
    expect(html).toContain("Atteint · 3e");
    expect(html.match(/Aperçu · course/g)).toHaveLength(2);
  });
});
