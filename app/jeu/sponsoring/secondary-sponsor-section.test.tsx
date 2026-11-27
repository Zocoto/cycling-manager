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
  it("requires a primary sponsor covering the target season while preserving the current secondary contract", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "principal-required", targetGameYear: 6, targetSeasonName: "Saison 6",
      activeContract: { ...contract, status: "active" },
    }} />);

    expect(html).toContain("Sponsor principal à choisir d’abord");
    expect(html).toContain("Signez d’abord un sponsor principal couvrant Saison 6");
    expect(html).toContain('href="/jeu/sponsoring"');
    expect(html).toContain("Choisir le sponsor principal");
    expect(html).toContain("Sponsor secondaire actif");
    expect(html).not.toContain('name="offerId"');
  });

  it("shows the snapshotted 30 percent cap alongside the primary sponsor budget", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "offers", activeContract: null, countryCode: "CO", countryName: "Colombie",
      targetGameYear: 6, targetSeasonName: "Saison 6",
      offers: [{ id: "offer", sponsor, objectives: [{ ...objective, cashReward: 600_000 }], totalMaximumReward: 600_000, principalBudgetPerSeason: 2_000_000, maximumRewardBudget: 600_000 }],
    }} />);
    const euros = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

    expect(html).toContain(`Maximum : ${euros(600_000)}`);
    expect(html).toContain(`Plafond de primes : ${euros(600_000)} (30 % du budget principal de ${euros(2_000_000)}).`);
    expect(captured.targets).toEqual([{ slug: "tour-test", stageNumber: null, raceEditionId: S5_EDITION }]);
    expect(html).toContain('name="offerId" value="offer"');
  });

  it("shows roster objectives without a race link and spells out the financial and reputation terms", () => {
    const roster: SecondarySponsorObjective = {
      id: "roster", name: "3 coureurs colombiens", kind: "roster_nationality",
      raceLabel: null, raceSlug: null, raceEditionId: null, categoryCode: null, targetRank: null,
      cashReward: 150_000, status: "draft", bestRank: null, reputationPenalty: 20,
      nationalityCountryCode: "CO", nationalityCountryName: "Colombie", requiredRiderCount: 3, currentRiderCount: 1,
    };
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "offers", activeContract: null, countryCode: "CO", countryName: "Colombie",
      targetGameYear: 6, targetSeasonName: "Saison 6",
      offers: [{ id: "offer", sponsor, objectives: [roster], totalMaximumReward: 150_000 }],
    }} />);
    expect(captured.targets).toEqual([]);
    expect(html).toContain("3 coureurs (Colombie)");
    expect(html).toContain("1 / 3 coureurs · Colombie");
    expect(html).toContain("Prime versée dès que le contingent est atteint.");
    expect(html).toContain("En cas d’échec : −20 réputation");
    expect(html).not.toContain("Aperçu · course");
    expect(html).not.toContain("Trois partenaires de");
  });

  it("keeps the logo editor available for an active secondary contract", () => {
    const principal = {
      id: "primary", name: "Colombia", shortName: "Colombia", countryCode: "CO", sector: "Tourisme", description: "",
      prestige: 3 as const, minimumReputation: 30, budgetRange: { min: 1, max: 2 }, contractDurationRange: { min: 1, max: 1 },
      logoPath: "/test.png", jerseys: [{ id: "jersey", name: "Colombia", style: "classic" as const, imagePath: "/test-jersey.png" }],
      colors: { primary: "#176951", secondary: "#FFFFFF", accent: "#F2C94C", background: "#FFFFFF", text: "#193F38" },
    };
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "window-locked", currentDayNumber: 10, opensOnDay: 21, targetGameYear: 6, targetSeasonName: "Saison 6",
      activeContract: { ...contract, status: "active", baseJersey: { sponsor: principal, jersey: principal.jerseys[0], futureTeamName: "Colombia" } },
    }} />);
    expect(html).toContain("Sponsor secondaire actif");
    expect(html).toContain("Couleur du logo");
    expect(html).toContain("Nationalités de l’équipe");
    expect(html).toContain("Colombie");
    expect(html).toContain("France");
    expect(html).toContain('name="contractId" value="contract"');
  });

  it("uses the primary sponsor preview for unsigned offers and preserves their signature form", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{
      kind: "offers", activeContract: null, countryCode: "FR", countryName: "France",
      targetGameYear: 5, targetSeasonName: "Saison 5",
      offers: [{ id: "offer", sponsor, principalCountryCode: "CO", objectives: [objective], totalMaximumReward: 15_000 }],
    }} />);

    expect(captured.targets).toEqual([{ slug: "tour-test", stageNumber: null, raceEditionId: S5_EDITION }]);
    expect(html).toContain("Aperçu · course");
    expect(html).toContain("Top 5 sur Tour test");
    expect(html).toContain('href="/jeu/courses/tour-test"');
    expect(html).toContain('name="offerId" value="offer"');
    expect(html).toContain("Signer Partenaire test");
    expect(html).toContain("Nationalités de l’équipe");
    expect(html).toContain("Colombie");
    expect(html).toContain("France");
  });

  it("adds previews to a signed future contract without making nested links", () => {
    const html = renderToStaticMarkup(<SecondarySponsorSection state={{ kind: "signed", activeContract: null, contract }} />);

    expect(captured.targets).toEqual([{ slug: "tour-test", stageNumber: null, raceEditionId: S5_EDITION }]);
    expect(html.match(/<a\b/g)).toHaveLength(3);
    expect(html.match(/<\/a>/g)).toHaveLength(3);
    expect(html).toContain("Choisir le prochain maillot");
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
