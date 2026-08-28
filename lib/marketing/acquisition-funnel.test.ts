import { describe, expect, it } from "vitest";

import {
  buildAcquisitionOverview,
  parseAcquisitionPeriod,
  type AcquisitionAccount,
} from "./acquisition-funnel";

const NOW = new Date("2026-08-28T12:00:00.000Z");

describe("acquisition funnel", () => {
  it("normalise la période demandée", () => {
    expect(parseAcquisitionPeriod("7")).toBe(7);
    expect(parseAcquisitionPeriod(["90", "7"])).toBe(90);
    expect(parseAcquisitionPeriod("all")).toBe("all");
    expect(parseAcquisitionPeriod("unexpected")).toBe(30);
  });

  it("mesure une cohorte d'inscription sans requête de suivi côté client", () => {
    const overview = buildAcquisitionOverview(
      [
        account({
          authUserId: "recent-team",
          createdAt: "2026-08-24T08:00:00.000Z",
          emailConfirmedAt: "2026-08-24T08:05:00.000Z",
          source: "reddit",
          medium: "community",
          campaign: "sprint-aout",
          hasDirector: true,
          hasTeam: true,
          onboardingCompleted: true,
          lastActivityOn: "2026-08-27",
        }),
        account({
          authUserId: "recent-unconfirmed",
          createdAt: "2026-08-26T08:00:00.000Z",
        }),
        account({
          authUserId: "old-account",
          createdAt: "2026-06-01T08:00:00.000Z",
          hasTeam: true,
        }),
      ],
      30,
      NOW,
    );

    expect(overview).toMatchObject({
      registrations: 2,
      confirmed: 1,
      directorProfiles: 1,
      teamsCreated: 1,
      onboardingCompleted: 1,
      activeLastSevenDays: 1,
      confirmationRate: 50,
      teamConversionRate: 50,
    });
    expect(overview.sources).toEqual([
      {
        label: "Accès direct / non attribué",
        registrations: 1,
        confirmed: 0,
        teamsCreated: 0,
        teamConversionRate: 0,
      },
      {
        label: "reddit · community",
        registrations: 1,
        confirmed: 1,
        teamsCreated: 1,
        teamConversionRate: 100,
      },
    ]);
    expect(overview.campaigns[0]?.label).toBe("sprint-aout");
  });

  it("renvoie des taux nuls lorsque la période ne contient aucune inscription", () => {
    const overview = buildAcquisitionOverview(
      [account({ createdAt: "2026-01-01T00:00:00.000Z" })],
      7,
      NOW,
    );

    expect(overview.registrations).toBe(0);
    expect(overview.confirmationRate).toBe(0);
    expect(overview.teamConversionRate).toBe(0);
    expect(overview.sources).toEqual([]);
  });
});

function account(
  overrides: Partial<AcquisitionAccount>,
): AcquisitionAccount {
  return {
    authUserId: "account",
    createdAt: "2026-08-20T00:00:00.000Z",
    emailConfirmedAt: null,
    source: null,
    medium: null,
    campaign: null,
    hasDirector: false,
    hasTeam: false,
    onboardingCompleted: false,
    lastActivityOn: null,
    ...overrides,
  };
}
