import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RiderRatings } from "@/lib/game/rider-profile";
import { FREE_AGENT_RIDER_JERSEY } from "@/lib/rider-jersey";
import type { PublicRiderProfile } from "@/services/public-rider-profile";
import { RiderComparisonView } from "./rider-comparison-view";

const baseRatings: RiderRatings = {
  mountain: 78,
  hills: 76,
  recovery: 72,
  endurance: 80,
  resistance: 77,
  breakaway: 70,
  downhill: 74,
  acceleration: 75,
  sprint: 68,
  flat: 73,
  cobbles: 65,
  prologue: 71,
  timeTrial: 79,
};

describe("RiderComparisonView", () => {
  it("renders both identities, overlaid radars and stronger-value arrows", () => {
    const left = createProfile({
      id: "11111111-1111-4111-8111-111111111111",
      firstName: "Léo",
      lastName: "Bleu",
      ratings: baseRatings,
    });
    const right = createProfile({
      id: "22222222-2222-4222-8222-222222222222",
      firstName: "Émile",
      lastName: "Vert",
      ratings: { ...baseRatings, mountain: 70, sprint: 82 },
    });
    const markup = renderToStaticMarkup(
      <RiderComparisonView
        left={left}
        right={right}
        leftJersey={FREE_AGENT_RIDER_JERSEY}
        rightJersey={FREE_AGENT_RIDER_JERSEY}
      />,
    );

    expect(markup).toContain("Léo Bleu");
    expect(markup).toContain("Émile Vert");
    expect(markup).toContain("Stats bleues");
    expect(markup).toContain("Stats vertes");
    expect(markup).toContain('data-radar-layer="left-rider"');
    expect(markup).toContain('data-radar-layer="right-rider"');
    expect(markup).toContain("←");
    expect(markup).toContain("→");
    expect(markup).toContain("Expérience de course");
  });
});

function createProfile({
  id,
  firstName,
  lastName,
  ratings,
}: {
  id: string;
  firstName: string;
  lastName: string;
  ratings: RiderRatings;
}): PublicRiderProfile {
  return {
    id,
    firstName,
    lastName,
    status: "active",
    country: { id: `${id}-country`, name: "France", code: "FR" },
    avatarProfileKey: `avatar-${id}`,
    avatarSeed: id,
    activeSeason: { id: "season", name: "Saison 2", gameYear: 2 },
    age: 26,
    careerRaceDays: 125,
    potentialSteps: 6,
    ratings,
    scoutingReport: null,
    condition: { form: 81, dayNumber: 22, events: [] },
    medical: null,
    currentTeam: {
      id: `team-${id}`,
      displayName: `Équipe ${firstName}`,
      shortName: null,
      divisionCode: "D1",
      divisionName: "Division 1",
    },
    nationalTitles: [],
    worldTitles: [],
    continentalTitles: [],
    history: [],
    specialAbilities: [],
    equipment: {},
    privateContract: null,
    canManage: false,
    archive: null,
  };
}
