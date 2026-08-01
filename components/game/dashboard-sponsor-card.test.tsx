import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { Sponsor } from "@/types/sponsor";

import { DashboardSponsorCard } from "./dashboard-sponsor-card";

const sponsor: Sponsor = {
  id: "graphicool",
  name: "Graphicool Mobilités",
  shortName: "Graphicool",
  countryCode: "FR",
  sector: "mobilité",
  description: "Un partenaire graphique.",
  prestige: 3,
  minimumReputation: 30,
  budgetRange: { min: 400_000, max: 600_000 },
  contractDurationRange: { min: 1, max: 2 },
  logoPath: "/images/sponsors/graphicool/logo.png",
  jerseys: [
    {
      id: "graphicool-modern",
      name: "Graphicool moderne",
      style: "modern",
      imagePath: "/images/sponsors/graphicool/jersey-modern.png",
    },
  ],
  colors: {
    primary: "#145DA0",
    secondary: "#42B99A",
    accent: "#F2C94C",
    background: "#F8FBFD",
    text: "#102A43",
  },
};

describe("dashboard sponsor card", () => {
  it("shows the sponsor logo, selected jersey and commercial details", () => {
    const markup = renderToStaticMarkup(
      <DashboardSponsorCard
        sponsor={sponsor}
        jersey={sponsor.jerseys[0]}
        budgetLabel="510 000 €"
        objectiveSummary={{ completed: 2, total: 7 }}
      />,
    );

    expect(markup).toContain("Graphicool Mobilités");
    expect(markup).toContain("510 000");
    expect(markup).toContain("Maillot officiel");
    expect(markup).toContain("Objectifs 2/7");
    expect(markup).toContain("2 objectifs accomplis sur 7");
    expect(markup).toContain(encodeURIComponent(sponsor.logoPath));
    expect(markup).toContain(
      encodeURIComponent(sponsor.jerseys[0].imagePath),
    );
  });

  it("uses the sponsor palette as the team identity of the tile", () => {
    const markup = renderToStaticMarkup(
      <DashboardSponsorCard
        sponsor={sponsor}
        jersey={sponsor.jerseys[0]}
        budgetLabel="510 000 €"
      />,
    );

    expect(markup).toContain("--dashboard-sponsor-primary:#145DA0");
    expect(markup).toContain("--dashboard-sponsor-secondary:#42B99A");
    expect(markup).toContain("--dashboard-sponsor-accent:#F2C94C");
    expect(markup).toContain('href="/jeu/sponsoring"');
    expect(markup).toContain('data-tutorial-id="dashboard-sponsoring"');
  });
});
