import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RaceCalendarStage } from "@/lib/game/race-calendar";
import { DEFAULT_RACE_TEAM_STRATEGY } from "@/lib/game/race-strategy";
import type { RacePreparationRider } from "@/services/race-calendar";
import { RacePreparationWorkspace, type RacePreparationWorkspaceEdition } from "./race-preparation-workspace";

const stage: RaceCalendarStage = {
  id: "stage", dayNumber: 23, stageNumber: 1, name: "Flandres",
  stageType: "road", status: "planned", profileType: "cobbles", distanceKm: 22,
  daySlot: "early", departureAt: "2026-11-29T13:00:00Z",
  segments: [
    { segmentNumber: 3, distanceKm: 10, terrain: "flat", surface: "cobbles", averageGradientPct: 0, prime: null },
    { segmentNumber: 7, distanceKm: 5, terrain: "climb", surface: "cobbles", averageGradientPct: 6, prime: null },
    { segmentNumber: 12, distanceKm: 7, terrain: "descent", surface: "cobbles", averageGradientPct: -4, prime: null },
  ],
};
const rider: RacePreparationRider = {
  riderId: "rider", generalRole: "auto", firstName: "Test", lastName: "Coureur", stageRoles: {}, timeTrialPlans: {},
  ratings: { mountain: 70, hills: 70, flat: 70, timeTrial: 70, cobbles: 70, sprint: 70, acceleration: 70, downhill: 70, endurance: 70, resistance: 70, recovery: 70, breakaway: 70, prologue: 70 },
};
function render(mode: "team" | "federation", overrides: Partial<RaceCalendarStage> = {}) {
  const edition: RacePreparationWorkspaceEdition = {
    id: "edition", slug: "flandres", name: "Flandres", shortName: null, countryCode: "BE",
    categoryCode: "elite", categoryName: "Elite", raceFormat: "one_day", competitionType: "standard",
    pendingWildcard: false, stages: [{ ...stage, ...overrides }], equipmentPlanning: null,
    plan: {
      editionId: "edition", registrationId: "registration", teamId: "team", riders: [rider],
      stages: { stage: { ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "team", updatedAt: null, timeTrialUpdatedAt: null,
        attackOrders: [{ riderId: "rider", segmentNumber: 7, intensity: "strong", condition: "always" }],
      } },
    },
  };
  const action = async () => undefined;
  return renderToStaticMarkup(<RacePreparationWorkspace editions={[edition]} action={action} tacticalAction={action}
    timeTrialAction={action} gameYear={5} tacticalCenterLevel={0} tacticalBriefingsByStageId={{}} tacticalError={false}
    nowIso="2026-11-28T09:00:00Z" equipmentError={false} mode={mode} />);
}

describe.each(["team", "federation"] as const)("attack segment choices in %s preparation", mode => {
  it.each([
    ["hilly", "selective_cobbles", "Pavés"],
    ["hilly", "hilly_cobbles", "Pavé / Vallonné"],
    ["cobbles", "hilly_cobbles", "Pavé / Vallonné"],
  ] as const)("uses the calendar's %s/%s label in the preparation headings", (profileType, profileVariant, label) => {
    const html = render(mode, { profileType, profileVariant });
    expect(html).toContain(`Course en ligne · ${label}`);
    expect(html).toContain(`22 km · ${label} ·`);
  });

  it("shows paved climbs and descents without changing stored option IDs or the selected attack", () => {
    const original = structuredClone(stage);
    const html = render(mode);
    const options = html.match(/>Tronçon<select\b[^>]*>([\s\S]*?)<\/select>/)?.[1];
    expect(options).toBeDefined();
    expect([...options!.matchAll(/<option\b[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g)].map(match => [match[1], match[2]])).toEqual([
      ["3", "T3 · Plat pavé · 10 km"], ["7", "T7 · Montée pavée +6 % · 5 km"], ["12", "T12 · Descente pavée -4 % · 7 km"],
    ]);
    expect(options).toContain('value="7" selected=""');
    expect(html).toContain('title="T7 · Montée pavée +6 % · 5 km"');
    expect(stage).toEqual(original);
  });
});
