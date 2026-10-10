import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { RaceCalendarStage, RaceFormat } from "@/lib/game/race-calendar";
import type { RaceRole } from "@/lib/game/race-simulation";
import { DEFAULT_RACE_TEAM_STRATEGY } from "@/lib/game/race-strategy";
import type { RacePreparationRider } from "@/services/race-calendar";
import {
  RacePreparationWorkspace,
  type RacePreparationWorkspaceEdition,
} from "./race-preparation-workspace";

function rider(riderId: string, generalRole: RaceRole): RacePreparationRider {
  return {
    riderId,
    generalRole,
    firstName: riderId,
    lastName: "Test",
    stageRoles: {},
    timeTrialPlans: {},
    ratings: {
      mountain: 70, hills: 70, flat: 70, timeTrial: 70, cobbles: 70,
      sprint: 70, acceleration: 70, downhill: 70, endurance: 70,
      resistance: 70, recovery: 70, breakaway: 70, prologue: 70,
    },
  };
}

function renderPreparation({
  stageType = "road",
  raceFormat = "one_day",
  riders,
  readOnly = false,
  saved = false,
  mode = "team",
}: {
  stageType?: RaceCalendarStage["stageType"];
  raceFormat?: RaceFormat;
  riders: RacePreparationRider[];
  readOnly?: boolean;
  saved?: boolean;
  mode?: "team" | "federation";
}) {
  const stage: RaceCalendarStage = {
    id: "stage", dayNumber: 2, stageNumber: 1, name: "Étape test",
    stageType, status: "planned", profileType: "flat", distanceKm: 50,
    daySlot: "early", departureAt: "2026-10-10T12:00:00Z", segments: [],
  };
  const edition: RacePreparationWorkspaceEdition = {
    id: "edition", slug: "course-test", name: "Course test", shortName: null,
    countryCode: "FR", categoryCode: "continental", categoryName: "Continental",
    raceFormat, competitionType: "standard", pendingWildcard: false,
    stages: [stage], equipmentPlanning: null,
    plan: {
      editionId: "edition", registrationId: "registration", teamId: "team", riders,
      stages: {
        stage: {
          ...DEFAULT_RACE_TEAM_STRATEGY, teamId: "team",
          updatedAt: saved ? "2026-10-09T10:00:00Z" : null,
          timeTrialUpdatedAt: saved ? "2026-10-09T10:00:00Z" : null,
        },
      },
    },
  };
  const action = async () => undefined;
  return renderToStaticMarkup(
    <RacePreparationWorkspace
      editions={[edition]} action={action} tacticalAction={action}
      timeTrialAction={action} gameYear={4} tacticalCenterLevel={0}
      tacticalBriefingsByStageId={{}} tacticalError={false}
      nowIso="2026-10-10T08:00:00Z" equipmentError={false}
      readOnly={readOnly} mode={mode}
    />,
  );
}

function roleSelect(html: string, riderId: string) {
  const select = [...html.matchAll(/<select\b[^>]*name="stageRoles"[^>]*>[\s\S]*?<\/select>/g)]
    .map(([markup]) => markup)
    .find((markup) => markup.includes(`value="${riderId}:`));
  expect(select, `Sélecteur de ${riderId}`).toBeDefined();
  return select!;
}

function roleOption(select: string, riderId: string, role: RaceRole) {
  const option = select.match(new RegExp(`<option\\b[^>]*value="${riderId}:${role}"[^>]*>`))?.[0];
  expect(option, `Option ${role} de ${riderId}`).toBeDefined();
  return option!;
}

function saveButton(html: string) {
  const button = html.match(/<button\b[^>]*>Enregistrer ce plan<\/button>/)?.[0];
  expect(button).toBeDefined();
  return button!;
}

describe.each(["road", "team_time_trial"] as const)("rôles de préparation — %s", (stageType) => {
  it("permet de désigner un leader après un leader / sprinteur", () => {
    const html = renderPreparation({ stageType, riders: [rider("sprint", "leader_sprinter"), rider("gc", "auto")] });
    expect(roleOption(roleSelect(html, "gc"), "gc", "leader")).not.toContain("disabled");
    expect(roleOption(roleSelect(html, "gc"), "gc", "leader_sprinter")).toContain("disabled");
    expect(roleOption(roleSelect(html, "gc"), "gc", "sprinter")).toContain("disabled");
  });

  it.each(["one_day", "stage_race"] as const)("permet un leader / sprinteur auprès du leader sur %s", (raceFormat) => {
    const html = renderPreparation({ stageType, raceFormat, riders: [rider("gc", "leader"), rider("sprint", "auto")] });
    expect(roleOption(roleSelect(html, "sprint"), "sprint", "leader_sprinter")).not.toContain("disabled");
    expect(roleOption(roleSelect(html, "sprint"), "sprint", "sprinter")).not.toContain("disabled");
    expect(roleOption(roleSelect(html, "sprint"), "sprint", "leader")).toContain("disabled");
  });

  it.each(["one_day", "stage_race"] as const)("autorise l’enregistrement du duo déjà inscrit sur %s", (raceFormat) => {
    const html = renderPreparation({ stageType, raceFormat, riders: [rider("gc", "leader"), rider("sprint", "leader_sprinter"), rider("helper", "domestique")] });
    expect(saveButton(html)).not.toMatch(/\sdisabled=/);
    expect(roleOption(roleSelect(html, "sprint"), "sprint", "leader_sprinter")).toContain("selected");
    expect(roleOption(roleSelect(html, "sprint"), "sprint", "leader_sprinter")).not.toContain("disabled");
    expect(roleOption(roleSelect(html, "helper"), "helper", "leader")).toContain("disabled");
    expect(roleOption(roleSelect(html, "helper"), "helper", "leader_sprinter")).toContain("disabled");
  });

  it("accepte le duo défini par les rôles d’étape, y compris en réédition", () => {
    const gc = rider("gc", "auto");
    const sprint = rider("sprint", "auto");
    gc.stageRoles.stage = "leader";
    sprint.stageRoles.stage = "leader_sprinter";
    for (const saved of [false, true]) {
      const html = renderPreparation({ stageType, riders: [gc, sprint], saved });
      expect(saveButton(html)).not.toMatch(/\sdisabled=/);
      expect(roleOption(roleSelect(html, "gc"), "gc", "leader")).toContain("selected");
      expect(roleOption(roleSelect(html, "sprint"), "sprint", "leader_sprinter")).toContain("selected");
    }
  });

  it("préserve le verrouillage du leader déclaré du tour", () => {
    const html = renderPreparation({ stageType, raceFormat: "stage_race", riders: [rider("gc", "leader"), rider("sprint", "leader_sprinter")] });
    expect(roleSelect(html, "gc").split(">")[0]).toMatch(/\sdisabled=/);
    expect(html).toContain('type="hidden" name="stageRoles" value="gc:leader"');
    expect(roleSelect(html, "sprint").split(">")[0]).not.toMatch(/\sdisabled=/);
  });

  it.each([
    ["leader", "leader"],
    ["sprinter", "leader_sprinter"],
    ["leader_sprinter", "leader_sprinter"],
    ["protected_rider", "protected_rider"],
  ] as const)("refuse toujours les doublons %s / %s", (first, second) => {
    const html = renderPreparation({ stageType, riders: [rider("a", first), rider("b", second)] });
    expect(saveButton(html)).toMatch(/\sdisabled=/);
  });

  it("conserve le coureur protégé et les rôles équipiers avec le duo", () => {
    const html = renderPreparation({ stageType, riders: [rider("gc", "leader"), rider("sprint", "leader_sprinter"), rider("protected", "protected_rider"), rider("a", "domestique"), rider("b", "domestique")] });
    expect(saveButton(html)).not.toMatch(/\sdisabled=/);
    expect(roleOption(roleSelect(html, "a"), "a", "protected_rider")).toContain("disabled");
    expect(roleOption(roleSelect(html, "a"), "a", "domestique")).not.toContain("disabled");
  });

  it("applique la même règle à la préparation fédérale", () => {
    expect(saveButton(renderPreparation({ stageType, mode: "federation", riders: [rider("gc", "leader"), rider("sprint", "leader_sprinter")] }))).not.toMatch(/\sdisabled=/);
  });

  it("n’ouvre pas les modifications dans une consultation en lecture seule", () => {
    const html = renderPreparation({ stageType, readOnly: true, riders: [rider("gc", "leader"), rider("sprint", "leader_sprinter")] });
    expect(roleSelect(html, "sprint").split(">")[0]).toMatch(/\sdisabled=/);
    expect(html).not.toContain(">Enregistrer ce plan</button>");
  });
});
