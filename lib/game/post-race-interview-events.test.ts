import { describe, expect, it } from "vitest";

import type { PostRaceInterviewContext } from "./post-race-interview";
import {
  selectZoneMixteEvent,
  ZONE_MIXTE_EVENT_DEFINITIONS,
} from "./post-race-interview-events";

const CONTEXT: PostRaceInterviewContext = {
  questionVersion: 3,
  raceName: "Tour de test",
  stageName: "Étape test",
  stageType: "road",
  weatherLabel: "Soleil",
  teamId: "team-1",
  teamName: "Dolci Test",
  directorName: "Max Test",
  directorAvatarKey: null,
  riderName: "Marco Test",
  riderId: "00000000-0000-4000-8000-000000000001",
  sponsorName: "Tiramisu Corse",
  raceCountryCode: "IT",
  bestRank: 1,
  gapLabel: null,
  uciRank: 1,
  divisionLabel: "Élite",
  tookBreakaway: true,
  tookChase: true,
  raceFacts: {
    breakawayOccurred: true,
    crashOccurred: true,
    crosswindOccurred: false,
  },
  rivalry: {
    kind: "opinion",
    teamId: "rival-1",
    teamName: "Rivale",
    directorName: "Rival Test",
    riderName: "Rival Coureur",
    achievement: "runner_up",
  },
};

describe("événements de zone mixte", () => {
  it("contient les 34 événements validés, avec la bonne répartition", () => {
    expect(ZONE_MIXTE_EVENT_DEFINITIONS).toHaveLength(34);
    expect(
      new Set(ZONE_MIXTE_EVENT_DEFINITIONS.map(({ id }) => id)).size,
    ).toBe(34);
    expect(
      ZONE_MIXTE_EVENT_DEFINITIONS.filter(({ rarity }) => rarity === "common"),
    ).toHaveLength(16);
    expect(
      ZONE_MIXTE_EVENT_DEFINITIONS.filter(({ rarity }) => rarity === "notable"),
    ).toHaveLength(12);
    expect(
      ZONE_MIXTE_EVENT_DEFINITIONS.filter(({ rarity }) => rarity === "rare"),
    ).toHaveLength(6);
  });

  it("déclenche environ un événement général sur six et une question relationnelle sur six", () => {
    const events = Array.from({ length: 1_200 }, (_, index) =>
      selectZoneMixteEvent({ context: CONTEXT, seed: `frequency-${index}` }),
    ).filter(Boolean);
    const relationshipEvents = events.filter((event) =>
      event!.choices.some((choice) =>
        choice.outcomes.some((outcome) => outcome.riderMoraleDelta !== undefined),
      ),
    );
    const generalEvents = events.length - relationshipEvents.length;

    expect(events.length).toBeGreaterThan(340);
    expect(events.length).toBeLessThan(460);
    expect(relationshipEvents.length).toBeGreaterThan(160);
    expect(relationshipEvents.length).toBeLessThan(240);
    expect(generalEvents).toBeGreaterThan(160);
    expect(generalEvents).toBeLessThan(240);
  });

  it("reste déterministe et remplace un événement déjà vu", () => {
    const selection = findEvent("stable");
    expect(
      selectZoneMixteEvent({ context: CONTEXT, seed: selection.seed }),
    ).toEqual(selection.event);

    const replacement = selectZoneMixteEvent({
      context: CONTEXT,
      seed: selection.seed,
      usedEventIds: [selection.event.id],
    });
    expect(replacement?.id).not.toBe(selection.event.id);
  });

  it("borne toutes les conséquences et limite strictement les objets", () => {
    for (const event of ZONE_MIXTE_EVENT_DEFINITIONS) {
      expect(event.choices).toHaveLength(2);
      for (const choice of event.choices) {
        expect(
          choice.outcomes.reduce((total, outcome) => total + outcome.weight, 0),
        ).toBe(100);
        for (const outcome of choice.outcomes) {
          expect(outcome.reputationDelta ?? 0).toBeGreaterThanOrEqual(-4);
          expect(outcome.reputationDelta ?? 0).toBeLessThanOrEqual(4);
          expect(outcome.cashDelta ?? 0).toBeGreaterThanOrEqual(-6_000);
          expect(outcome.cashDelta ?? 0).toBeLessThanOrEqual(5_000);
          expect(outcome.riderPopularityDelta ?? 0).toBeGreaterThanOrEqual(-3);
          expect(outcome.riderPopularityDelta ?? 0).toBeLessThanOrEqual(5);
          expect(outcome.riderMoraleDelta ?? 0).toBeGreaterThanOrEqual(-5);
          expect(outcome.riderMoraleDelta ?? 0).toBeLessThanOrEqual(5);
          if (outcome.inventoryItemKey) {
            expect(outcome.inventoryItemKey).toBe("acceleration-focus");
          }
        }
      }
    }
  });

  it("propose un vrai panel de décisions cachées qui touchent le moral", () => {
    const moraleEvents = ZONE_MIXTE_EVENT_DEFINITIONS.filter((event) =>
      event.choices.some((choice) =>
        choice.outcomes.some((outcome) => outcome.riderMoraleDelta !== undefined),
      ),
    );

    expect(moraleEvents).toHaveLength(10);
    expect(
      moraleEvents.every((event) =>
        event.choices.every((choice) => choice.impactPreview === "Conséquence cachée"),
      ),
    ).toBe(true);
    expect(
      moraleEvents.some((event) =>
        event.choices.some((choice) =>
          choice.outcomes.some((outcome) => (outcome.riderMoraleDelta ?? 0) < 0),
        ),
      ),
    ).toBe(true);
  });

  it("injecte le contexte de la course dans le texte", () => {
    const event = findEventWithId("local-specialty");
    expect(event.story).toContain("tiramisu");
    expect(event.story).not.toContain("{{");
  });
});

function findEvent(prefix: string) {
  for (let index = 0; index < 2_000; index += 1) {
    const seed = `${prefix}-${index}`;
    const event = selectZoneMixteEvent({ context: CONTEXT, seed });
    if (event) return { seed, event };
  }
  throw new Error("Aucune graine n’a déclenché d’événement.");
}

function findEventWithId(id: string) {
  for (let index = 0; index < 20_000; index += 1) {
    const event = selectZoneMixteEvent({
      context: CONTEXT,
      seed: `event-${id}-${index}`,
    });
    if (event?.id === id) return event;
  }
  throw new Error(`Aucune graine n’a produit l’événement ${id}.`);
}
