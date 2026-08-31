import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NationalFederationView } from "@/components/game/national-federation-view";
import type { NationalFederationSnapshot } from "@/services/national-federations";

const snapshot: NationalFederationSnapshot = {
  season: {
    id: "season-2",
    name: "Saison 2",
    gameYear: 2,
    currentDayNumber: 12,
  },
  viewer: {
    teamId: "team-fr",
    isAffiliated: true,
  },
  presidency: {
    mode: "automatic",
    presidentName: null,
  },
  academies: {
    centers: [
      {
        teamId: "academy-owner",
        teamName: "Équipe formatrice",
        qualityLevel: 3,
        contributionPercentage: 30,
        completedAt: "2026-08-01T10:00:00.000Z",
      },
    ],
    totalImpactPercentage: 30,
  },
  champions: {
    professional: {
      road: {
        riderId: "rider-road",
        riderName: "Jeanne Peloton",
        category: "professional",
        discipline: "road",
        seasonName: "Saison 2",
        gameYear: 2,
      },
    },
    junior: {},
  },
  palmares: [],
};

describe("NationalFederationView", () => {
  it("opens a read-only Season 2 overview with real nation data", () => {
    const markup = renderToStaticMarkup(
      <NationalFederationView
        country={{ id: "country-fr", code: "FR", name: "France" }}
        snapshot={snapshot}
        nationRanking={{
          rank: 4,
          countryCode: "FR",
          countryName: "France",
          points: 1520,
          riderCount: 48,
        }}
        memberTeams={[]}
        memberTeamCount={0}
        selectedTab="overview"
      />,
    );

    expect(markup).toContain("Fédération de France");
    expect(markup).toContain("Votre fédération");
    expect(markup).toContain("gestion inchangée en Saison 2");
    expect(markup).toContain("Activation Saison 3");
    expect(markup).toContain("Jeanne Peloton");
    expect(markup).toContain("Impact académies");
    expect(markup).toContain("30 %");
    expect(markup).toContain("Objectifs fédéraux prévisionnels");
    expect(markup).toContain("Assistant fédéral");
    expect(markup).toContain("Rang de référence");
    expect(markup).not.toContain("<form");
  });

  it("previews the J1 selection workflow without exposing mutations", () => {
    const markup = renderToStaticMarkup(
      <NationalFederationView
        country={{ id: "country-fr", code: "FR", name: "France" }}
        snapshot={snapshot}
        nationRanking={null}
        memberTeams={[]}
        memberTeamCount={0}
        selectedTab="selections"
      />,
    );

    expect(markup).toContain("Dès J1");
    expect(markup).toContain("Championnats continentaux");
    expect(markup).toContain("Nations Cup");
    expect(markup).toContain("Championnats du monde");
    expect(markup).toContain("Consultation uniquement");
    expect(markup).not.toContain("<button");
    expect(markup).not.toContain("<form");
  });

  it("offers a local-only national jersey editor with movable flag artwork", () => {
    const markup = renderToStaticMarkup(
      <NationalFederationView
        country={{ id: "country-fr", code: "FR", name: "France" }}
        snapshot={snapshot}
        nationRanking={null}
        memberTeams={[]}
        memberTeamCount={0}
        selectedTab="governance"
      />,
    );

    expect(markup).toContain("Atelier du maillot national");
    expect(markup).toContain("/images/flags/4x3/fr.svg");
    expect(markup).toContain("Brouillon local");
    expect(markup).toContain("Motif central rond");
    expect(markup).toContain("Sauvegarder sur cet appareil");
    expect(markup).toContain("Aucune donnée envoyée au serveur");
    expect(markup).not.toContain("<form");
  });

  it("shows an interactive Season 3 finance forecast without a payment action", () => {
    const markup = renderToStaticMarkup(
      <NationalFederationView
        country={{ id: "country-fr", code: "FR", name: "France" }}
        snapshot={snapshot}
        nationRanking={{
          rank: 4,
          countryCode: "FR",
          countryName: "France",
          points: 1520,
          riderCount: 48,
        }}
        memberTeams={[]}
        memberTeamCount={3}
        selectedTab="finances"
      />,
    );

    expect(markup).toContain("Simulateur budgétaire S3");
    expect(markup).toContain("Prévision sans transaction");
    expect(markup).toContain("Classement UCI précédent");
    expect(markup).toContain("Courses du pays");
    expect(markup).toContain("Solidarité");
    expect(markup).not.toContain("Payer");
    expect(markup).not.toContain("Confirmer le don");
  });
});
