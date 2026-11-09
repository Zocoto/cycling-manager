import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RiderSeasonPlanning } from "@/components/game/rider-season-planning";
import type { TeamRiderSeasonPlanning } from "@/lib/game/rider-season-planning";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";

const planning: TeamRiderSeasonPlanning = {
  teamId: "team-1",
  teamName: "Equipe test",
  seasonId: "season-1",
  seasonName: "Saison 1",
  currentDayNumber: 5,
  days: [
    {
      id: "day-5",
      dayNumber: 5,
      calendarDate: "2026-08-05",
    },
  ],
  riders: [
    {
      id: "rider-1",
      firstName: "Luc",
      lastName: "Martin",
      countryName: "France",
      countryCode: "FR",
      avatarProfileKey: null,
      avatarSeed: 42,
      age: 25,
      events: [
        {
          id: "event-1",
          riderId: "rider-1",
          type: "race",
          title: "Course test",
          detail: "Etape vallonnee",
          startDay: 5,
          endDay: 5,
          status: "active",
          href: null,
          raceCategoryCode: "national",
        },
      ],
    },
  ],
};

describe("planning compact de la fiche coureur", () => {
  it("affiche les JDC et leur avertissement dans la ligne du coureur en S5", () => {
    const markup = renderToStaticMarkup(
      <RiderSeasonPlanning
        planning={{ ...planning, riders: [{ ...planning.riders[0], raceLoad: { raceDays: 31, projectedRaceDays: 35, warning: "overloaded" } }] }}
        jersey={FREE_AGENT_RIDER_JERSEY}
      />,
    );
    expect(markup).toContain("31 / 30 JDC disputés");
    expect(markup).toContain("Prévision : 35 JDC");
    expect(markup).toContain("Calendrier surchargé");
    expect(markup).toContain("−1 de moral par JDC au-delà de 30.");
  });

  it("affiche la frise sans dupliquer les evenements en cartes", () => {
    const markup = renderToStaticMarkup(
      <RiderSeasonPlanning
        planning={planning}
        jersey={FREE_AGENT_RIDER_JERSEY}
        variant="rider"
      />,
    );

    expect(markup).toContain("Course test");
    expect(markup).not.toContain("D\u00e9tail du programme");
    expect(markup).not.toContain("1 \u00e9v\u00e9nement cette saison");
  });

  it("affiche le bonus de moral pour un Étapovore au-delà de 30 JDC", () => {
    const markup = renderToStaticMarkup(
      <RiderSeasonPlanning
        planning={{ ...planning, riders: [{ ...planning.riders[0], raceLoad: { raceDays: 31, projectedRaceDays: 35, warning: null, hasEtapovore: true } }] }}
        jersey={FREE_AGENT_RIDER_JERSEY}
      />,
    );
    expect(markup).toContain("Étapovore · +0,5 de moral par JDC au-delà de 30.");
    expect(markup).not.toContain("Calendrier surchargé");
  });
});
