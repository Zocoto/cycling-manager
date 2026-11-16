import { describe, expect, it } from "vitest";

import { concealZoneMixteEventOutcomes, type PostRaceInterviewContext } from "./post-race-interview";
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
  it("contient les 44 événements validés, avec la bonne répartition", () => {
    expect(ZONE_MIXTE_EVENT_DEFINITIONS).toHaveLength(44);
    expect(
      new Set(ZONE_MIXTE_EVENT_DEFINITIONS.map(({ id }) => id)).size,
    ).toBe(44);
    expect(
      ZONE_MIXTE_EVENT_DEFINITIONS.filter(({ rarity }) => rarity === "common"),
    ).toHaveLength(21);
    expect(
      ZONE_MIXTE_EVENT_DEFINITIONS.filter(({ rarity }) => rarity === "notable"),
    ).toHaveLength(17);
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

    expect(moraleEvents).toHaveLength(16);
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
    const { event } = findEventWithId("local-specialty");
    expect(event.story).toContain("tiramisu");
    expect(event.story).not.toContain("{{");
  });

  it("propose la réponse du Franc-parleur uniquement pour un leader qui termine hors du top 10", () => {
    const context = { ...CONTEXT, riderPersonalityKey: "franc_parleur", wasTeamLeader: true, bestRank: 13 } as const;
    const { event, seed } = findEventWithId("personality-franc-parleur-debrief", context);
    expect(event.choices.map(({ outcomes }) => outcomes[0].riderMoraleDelta)).toEqual([2, -2]);
    for (const ineligible of [
      { ...context, riderPersonalityKey: "sociable" as const },
      { ...context, bestRank: 8 },
      { ...context, wasTeamLeader: false },
    ]) {
      expect(selectZoneMixteEvent({ context: ineligible, seed })?.id).not.toBe(event.id);
    }
    const hidden = concealZoneMixteEventOutcomes({ ...context, zoneMixteEvent: event });
    expect(hidden.zoneMixteEvent?.choices.every(({ outcomes }) => outcomes.length === 0)).toBe(true);
  });

  it("réserve le débrief du Discret au coureur concerné et l’utilise une fois", () => {
    const context: PostRaceInterviewContext = {
      ...CONTEXT,
      riderPersonalityKey: "discret",
      detailedRaceFacts: {
        starters: 5,
        finishers: 5,
        incidents: [],
        primes: [],
        work: [],
        lostContact: { riderId: CONTEXT.riderId!, name: CONTEXT.riderName, km: 38 },
      },
    };
    const { event, seed } = findEventWithId("personality-discret-debrief", context);
    expect(event.choices.map(({ outcomes }) => outcomes[0].riderMoraleDelta)).toEqual([2, -2]);
    expect(selectZoneMixteEvent({ seed, context: { ...CONTEXT, riderPersonalityKey: "discret" } })?.id).not.toBe(event.id);
    expect(selectZoneMixteEvent({
      seed, context, usedEventIds: [event.id],
    })?.id).not.toBe(event.id);
  });

  it("propose un pari de réputation au Chambreur en présence d’un rival", () => {
    const context = { ...CONTEXT, riderPersonalityKey: "chambreur" } as const;
    const { event, seed } = findEventWithId("personality-chambreur-rivalry", context);
    expect(event.story).toContain("Rivale");
    expect(event.choices[1].outcomes.map(({ reputationDelta }) => reputationDelta)).toEqual([3, -2]);
    expect(selectZoneMixteEvent({ seed, context: { ...context, rivalry: null } })?.id).not.toBe(event.id);
  });

  it("réserve le débriefing de chute au coureur impliqué qui a terminé", () => {
    const detailedRaceFacts = {
      starters: 5,
      finishers: 5,
      incidents: [{ riderId: CONTEXT.riderId!, name: CONTEXT.riderName, km: 38.4, type: "crash_individual" as const, finished: true, abandoned: false }],
      primes: [],
      work: [],
    };
    const { seed, event } = findEventWithId("verified-crash-debrief", { ...CONTEXT, detailedRaceFacts });
    expect(event.story).toContain("Marco Test est tombé au km 38,4");
    expect(selectZoneMixteEvent({ context: CONTEXT, seed })?.id).not.toBe(event.id);
    expect(selectZoneMixteEvent({
      context: { ...CONTEXT, riderId: "same-name-other-rider", detailedRaceFacts },
      seed,
    })?.id).not.toBe(event.id);

    const confidence = findEventWithId("crash-confidence", { ...CONTEXT, detailedRaceFacts });
    expect(selectZoneMixteEvent({
      context: { ...CONTEXT, detailedRaceFacts: { ...detailedRaceFacts, incidents: [] } },
      seed: confidence.seed,
    })?.id).not.toBe("crash-confidence");
  });

  it("attribue la vidéo de poursuite au bon coureur", () => {
    const detailedRaceFacts = {
      starters: 5,
      finishers: 5,
      incidents: [],
      primes: [],
      work: [],
      pursuit: { riderId: CONTEXT.riderId!, name: CONTEXT.riderName, km: 72 },
    };
    const { seed, event } = findEventWithId("chase-potato-meme", { ...CONTEXT, detailedRaceFacts });
    expect(event.story).toContain("Marco Test était dans le groupe de poursuite au km 72");
    expect(selectZoneMixteEvent({
      context: { ...CONTEXT, riderId: "another-rider", detailedRaceFacts },
      seed,
    })?.id).not.toBe(event.id);
  });

  it("réserve la polémique du sprint aux coureurs arrivés dans le même groupe", () => {
    const context: PostRaceInterviewContext = {
      ...CONTEXT,
      detailedRaceFacts: {
        starters: 5, finishers: 5, finishMode: "mass_sprint", winnerGapMs: 0,
        incidents: [], primes: [], work: [],
      },
      editorialFacts: {
        opponent: {
          teamId: "rival-1", teamName: "Rivale", riderName: "Rival Coureur",
          rank: 2, ownRiderRank: 1, sameTimeAsOwn: true,
        },
      },
    };
    const { seed, event } = findEventWithId("dangerous-sprint-claim", context);
    expect(event.story).toContain("Après le sprint");
    expect(selectZoneMixteEvent({
      context: { ...context, stageType: "individual_time_trial" },
      seed,
    })?.id).not.toBe(event.id);
    expect(selectZoneMixteEvent({
      context: { ...context, detailedRaceFacts: { ...context.detailedRaceFacts!, winnerGapMs: 7000 } },
      seed,
    })?.id).not.toBe(event.id);
  });

  it("pose la question de remplacement après une vente confirmée", () => {
    const recentDeparture = { riderName: "Milo Test", gameDay: 4, isSale: true };
    const { seed, event } = findEventWithId("confirmed-sale-place-in-squad", {
      ...CONTEXT,
      editorialFacts: { recentDeparture },
    });
    expect(event.story).toContain("Milo Test a quitté Dolci Test à J4 après un transfert payant");
    expect(selectZoneMixteEvent({
      context: { ...CONTEXT, editorialFacts: { recentDeparture: { ...recentDeparture, isSale: false } } },
      seed,
    })?.id).not.toBe(event.id);
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

function findEventWithId(id: string, context: PostRaceInterviewContext = CONTEXT) {
  for (let index = 0; index < 20_000; index += 1) {
    const seed = `event-${id}-${index}`;
    const event = selectZoneMixteEvent({
      context,
      seed,
    });
    if (event?.id === id) return { seed, event };
  }
  throw new Error(`Aucune graine n’a produit l’événement ${id}.`);
}
