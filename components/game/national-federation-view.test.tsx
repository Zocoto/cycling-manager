import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NationalFederationView } from "@/components/game/national-federation-view";
import type { NationalFederationSnapshot } from "@/services/national-federations";
import type { FederationFinanceBaseline } from "@/services/federation-finances";

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

const financeBaseline: FederationFinanceBaseline = {
  source: "season-data",
  seasonName: "Saison 2",
  gameYear: 2,
  observedThroughDay: 12,
  completedRaceDays: 8,
  completedRaceEditions: 5,
  acceptedTeamEntries: 45,
  averageStarters: 54,
  teamProfiles: [
    { teamId: "team-fr", teamName: "Équipe formatrice", reputationPoints: 42 },
  ],
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
        publishedJersey={null}
        federationChat={null}
        financeBaseline={null}
        selectionRiders={[]}
        internationalResults={{
          world: {
            competitionType: "world_championship",
            editionName: "Mondial sur route",
            seasonName: "Saison 2",
            gameYear: 2,
            riderName: "Jeanne Peloton",
            rank: 4,
          },
          continental: null,
          nationsCup: null,
        }}
        governanceOverview={null}
        selectionState={null}
        treasuryState={null}
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
    expect(markup).toContain("Derniers classements de la nation");
    expect(markup).toContain("Mondial sur route");
    expect(markup).not.toContain("Assistant fédéral");
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
        publishedJersey={null}
        federationChat={null}
        financeBaseline={null}
        selectionRiders={[]}
        internationalResults={null}
        governanceOverview={null}
        selectionState={null}
        treasuryState={null}
      />,
    );

    expect(markup).toContain("Dès J1");
    expect(markup).toContain("Championnats continentaux");
    expect(markup).toContain("Nations Cup");
    expect(markup).toContain("Championnats du monde");
    expect(markup).toContain("Nationalité verrouillée");
    expect(markup).toContain("Enregistrer en S3");
    expect(markup).toContain("confirmée par chaque DS");
    expect(markup).not.toContain("<form");
  });

  it("offers a layered national jersey editor without altering production before validation", () => {
    const markup = renderToStaticMarkup(
      <NationalFederationView
        country={{ id: "country-be", code: "BE", name: "Belgique" }}
        snapshot={snapshot}
        nationRanking={null}
        memberTeams={[]}
        memberTeamCount={0}
        selectedTab="governance"
        publishedJersey={null}
        federationChat={null}
        financeBaseline={null}
        selectionRiders={[]}
        internationalResults={null}
        governanceOverview={{
          phase: "scheduled",
          termStartGameYear: 3,
          termEndGameYear: 4,
          eligibleTeamCount: 0,
          voteCount: 0,
          viewerIsEligible: false,
          viewerCandidateId: null,
          viewerVotedCandidateId: null,
          canApply: false,
          canVote: false,
          presidentName: null,
          candidates: [],
          journal: [],
        }}
        selectionState={null}
        treasuryState={null}
      />,
    );

    expect(markup).toContain("Atelier du maillot national");
    expect(markup).toContain("Composez librement");
    expect(markup).toContain("Bande");
    expect(markup).toContain("Forme");
    expect(markup).toContain("Nouveau maillot blanc");
    expect(markup).toContain("Valider et publier");
    expect(markup).toContain("Prochaine élection programmée");
    expect(markup).toContain("J21–J24");
    expect(markup).toContain("Filet de sécurité automatique");
    expect(markup).toContain("Votre brouillon n’affecte pas le maillot publié");
    expect(markup).toContain("<form");
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
        publishedJersey={null}
        federationChat={null}
        financeBaseline={financeBaseline}
        selectionRiders={[]}
        internationalResults={null}
        governanceOverview={null}
        selectionState={null}
        treasuryState={null}
      />,
    );

    expect(markup).toContain("Projection officielle Saison 3");
    expect(markup).toContain("situation J12");
    expect(markup).toContain("Retour réel de la Saison 2");
    expect(markup).toContain("Courses du pays");
    expect(markup).toContain("Deux jauges");
    expect(markup).toContain("Historique des gains et dépenses");
    expect(markup).not.toContain("Aide exceptionnelle");
    expect(markup).not.toContain("Payer");
    expect(markup).not.toContain("Confirmer le don");
  });
});
