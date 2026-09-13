import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getNationsCupDivisionView,
  NationsCupStandings,
} from "./nations-cup-standings";

const events = [
  { id: "sprint", slug: "nations-cup-sprint", name: "Sprint" },
  { id: "clm", slug: "nations-cup-clm", name: "Contre-la-montre" },
];

const standings = [
  standing("fr", "FR", "France", 1, null, 1, 1, 1),
  standing("be", "BE", "Belgique", 2, "A", 2, 1, 1),
  standing("nl", "NL", "Pays-Bas", 2, "B", 3, 2, 1),
  standing("it", "IT", "Italie", 3, "A", 4, 1, 1),
  standing("es", "ES", "Espagne", 4, "C", 5, 1, 1),
];

describe("NationsCupStandings", () => {
  it("présente quatre onglets de division sans mélanger les classements", () => {
    const markup = renderToStaticMarkup(
      <NationsCupStandings events={events} standings={standings} />,
    );

    expect(markup.match(/role="tab"/g)).toHaveLength(7);
    expect(markup.indexOf("Général")).toBeLessThan(markup.indexOf("Sprint"));
    expect(markup).toContain("détermine seul les montées et descentes");
    expect(markup).toContain("Division 1");
    expect(markup).toContain("Division 4");
    expect(markup).toContain("France");
    expect(markup).not.toContain("Belgique");
  });

  it("partitionne les divisions 2 à 4 par groupe", () => {
    const divisionTwo = getNationsCupDivisionView(standings, 2, null);
    expect(divisionTwo.groups).toEqual(["A", "B"]);
    expect(divisionTwo.activeGroup).toBe("A");
    expect(divisionTwo.visibleStandings.map((standing) => standing.countryName)).toEqual([
      "Belgique",
    ]);

    const groupB = getNationsCupDivisionView(standings, 2, "B");
    expect(groupB.visibleStandings.map((standing) => standing.countryName)).toEqual([
      "Pays-Bas",
    ]);
  });

  it("isole chaque sous-classement d’épreuve", () => {
    const withResults = standings.map((item, index) => ({
      ...item,
      eventRanks: {
        "nations-cup-sprint": index < 2 ? index + 1 : null,
      },
    }));

    const sprintDivisionTwo = getNationsCupDivisionView(
      withResults,
      2,
      "A",
      "nations-cup-sprint",
    );
    expect(sprintDivisionTwo.visibleStandings.map((standing) => standing.countryName)).toEqual([
      "Belgique",
    ]);
  });
});

function standing(
  countryId: string,
  countryCode: string,
  countryName: string,
  division: number,
  groupCode: string | null,
  overallRank: number,
  divisionRank: number,
  groupRank: number,
) {
  return {
    countryId,
    countryCode,
    countryName,
    division,
    groupCode,
    points: 0,
    eventsCount: 0,
    overallRank,
    divisionRank,
    groupRank,
    projectedDivision: division,
    movementZone: "safe" as const,
    eventRanks: {},
  };
}
