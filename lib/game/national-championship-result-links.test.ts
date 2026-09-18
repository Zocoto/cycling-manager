import { describe, expect, it } from "vitest";

import {
  getNationalChampionshipResultHref,
  getNationalChampionshipRiderResultLabel,
} from "./national-championship-result-links";

describe("accès aux résultats des CN", () => {
  const edition = {
    slug: "cn-france-clm-s3",
    status: "completed" as const,
    stages: [{ stageNumber: 1 }],
  };

  it("ouvre le classement officiel uniquement une fois le championnat terminé", () => {
    expect(getNationalChampionshipResultHref(edition)).toBe(
      "/jeu/resultats/cn-france-clm-s3/1",
    );
    expect(
      getNationalChampionshipResultHref({
        ...edition,
        status: "registration_open",
      }),
    ).toBeNull();
    expect(
      getNationalChampionshipResultHref({
        ...edition,
        status: "cancelled",
      }),
    ).toBeNull();
  });

  it("distingue classé, non classé, non partant, à venir et annulé", () => {
    expect(
      getNationalChampionshipRiderResultLabel(
        { status: "entered", finalRank: 7 },
        "completed",
      ),
    ).toBe("7e");
    expect(
      getNationalChampionshipRiderResultLabel(
        { status: "entered", finalRank: null },
        "completed",
      ),
    ).toBe("Non classé");
    expect(
      getNationalChampionshipRiderResultLabel(
        { status: "did_not_start", finalRank: null },
        "completed",
      ),
    ).toBe("Non partant");
    expect(
      getNationalChampionshipRiderResultLabel(
        { status: "entered", finalRank: null },
        "registration_open",
      ),
    ).toBe("En attente");
    expect(
      getNationalChampionshipRiderResultLabel(
        { status: "entered", finalRank: null },
        "cancelled",
      ),
    ).toBe("Annulé");
  });
});
