import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  RaceIncident,
  RiderSimulationInput,
} from "@/lib/game/race-simulation";

import { RaceIncidentOverlay } from "./race-live-lab";

function buildRider(id: string, name: string, teamName: string): RiderSimulationInput {
  return {
    id,
    name,
    teamId: `team-${id}`,
    teamName,
    teamPrimaryColor: "#173F5F",
    teamSecondaryColor: "#F2C94C",
    age: 24,
    form: 82,
    role: "leader",
    ratings: {
      flat: 68,
      mountain: 64,
      hills: 70,
      cobbles: 61,
      downhill: 66,
      sprint: 63,
      acceleration: 65,
      timeTrial: 67,
      prologue: 66,
      endurance: 71,
      resistance: 69,
      recovery: 68,
      breakaway: 65,
    },
  };
}

function buildIncident(overrides: Partial<RaceIncident> = {}): RaceIncident {
  return {
    id: "incident-1",
    type: "crash_individual",
    riderIds: ["navarro"],
    abandonedRiderIds: [],
    label: "Chute de Jhonny Navarro",
    ...overrides,
  };
}

function renderIncident(incident: RaceIncident, riders: RiderSimulationInput[]) {
  const markup = renderToStaticMarkup(
    <RaceIncidentOverlay
      incidents={[incident]}
      riderById={new Map(riders.map((rider) => [rider.id, rider]))}
    />,
  );
  // Inspect visible paragraphs, not tooltip attributes which may repeat text.
  const paragraphs = Array.from(
    markup.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g),
    (match) => match[1].replace(/<[^>]+>/g, ""),
  );
  return { markup, paragraphs };
}

describe("RaceIncidentOverlay", () => {
  it.each([
    ["crash_individual", "Chute de Jhonny Navarro"],
    ["puncture", "Crevaison de Jhonny Navarro"],
  ] as const)(
    "shows the rider once and the real team beneath a named %s incident",
    (type, label) => {
      const rider = buildRider("navarro", "Jhonny Navarro", "SamuRodri Cycling");
      const { markup, paragraphs } = renderIncident(
        buildIncident({ type, label }),
        [rider],
      );

      expect(paragraphs).toEqual([label, "SamuRodri Cycling"]);
      expect(paragraphs.join(" ").match(/Jhonny Navarro/g)).toHaveLength(1);
      expect(markup).toContain('role="status"');
      expect(markup).toContain('aria-live="polite"');
    },
  );

  it("keeps rider identities and teams for a collective crash, capped at three participants", () => {
    const riders = [
      buildRider("navarro", "Jhonny Navarro", "SamuRodri Cycling"),
      buildRider("torres", "Diego Torres", "Ardennes Outillage"),
      buildRider("mirza", "Amir Mirza", "Kigali SafeRide"),
      buildRider("tolosa", "Pablo Tolosa", "Team Cochonou"),
    ];
    const { markup, paragraphs } = renderIncident(
      buildIncident({
        type: "crash_mass",
        label: "Chute collective dans le peloton",
        riderIds: riders.map((rider) => rider.id),
      }),
      riders,
    );

    expect(paragraphs).toEqual([
      "Chute collective dans le peloton",
      "Jhonny Navarro · SamuRodri Cycling, Diego Torres · Ardennes Outillage, Amir Mirza · Kigali SafeRide",
    ]);
    expect(markup).not.toContain("Pablo Tolosa");
    expect(markup).not.toContain("Team Cochonou");
  });

  it.each([
    ["crash_individual", "Chute individuelle"],
    ["puncture", "Crevaison"],
  ] as const)(
    "preserves rider identity and team for historical generic %s labels",
    (type, label) => {
      const { paragraphs } = renderIncident(
        buildIncident({ type, label }),
        [buildRider("navarro", "Jhonny Navarro", "SamuRodri Cycling")],
      );

      expect(paragraphs).toEqual([
        label,
        "Jhonny Navarro · SamuRodri Cycling",
      ]);
    },
  );

  it("renders an incident with unavailable riders without an undefined identity", () => {
    const { markup, paragraphs } = renderIncident(
      buildIncident({ riderIds: ["missing-rider"], label: "Chute individuelle" }),
      [],
    );

    expect(paragraphs).toEqual(["Chute individuelle"]);
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("null");
  });

  it("keeps known participants when a collective incident also references a missing rider", () => {
    const { markup, paragraphs } = renderIncident(
      buildIncident({
        type: "crash_mass",
        riderIds: ["missing-rider", "navarro"],
        label: "Chute collective",
      }),
      [buildRider("navarro", "Jhonny Navarro", "SamuRodri Cycling")],
    );

    expect(paragraphs).toEqual([
      "Chute collective",
      "Jhonny Navarro · SamuRodri Cycling",
    ]);
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("missing-rider");
  });

  it("renders nothing when there is no incident", () => {
    expect(
      renderToStaticMarkup(
        <RaceIncidentOverlay incidents={[]} riderById={new Map()} />,
      ),
    ).toBe("");
  });
});
