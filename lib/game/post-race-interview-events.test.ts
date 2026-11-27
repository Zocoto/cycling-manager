import { describe, expect, it } from "vitest";

import { concealZoneMixteEventOutcomes, type PostRaceInterviewContext } from "./post-race-interview";
import { buildRiderCommunicationOutcome } from "./post-race-interview-communication";
import {
  selectZoneMixteEvent,
  type ZoneMixtePersonalityRider,
  ZONE_MIXTE_EVENT_DEFINITIONS,
} from "./post-race-interview-events";
import { RIDER_INTERVIEW_SCENARIOS } from "./post-race-interview-rider-scenarios";
import { RIDER_PERSONALITIES, type RiderPersonalityKey } from "./rider-personalities";

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

  it("cible le leader concerné même si un équipier a terminé devant lui", () => {
    const leader = {
      riderId: "00000000-0000-4000-8000-000000000002",
      riderName: "Julien Leader",
      riderPersonalityKey: "franc_parleur",
      bestRank: 14,
      wasTeamLeader: true,
    } as const;
    const { seed } = findEventWithId("personality-franc-parleur-debrief", { ...CONTEXT, ...leader });
    const event = selectZoneMixteEvent({ context: CONTEXT, seed, personalityRiders: [leader] });
    expect(event?.riderId).toBe(leader.riderId);
    expect(event?.story).toContain("Julien Leader");
    expect(event?.story).not.toContain(CONTEXT.riderName);
    expect(selectZoneMixteEvent({ context: CONTEXT, seed })?.id).not.toBe(event?.id);
  });

  it("propose un débrief au Discret impliqué dans un incident même sans mention dans le résumé", () => {
    const rider = {
      riderId: "00000000-0000-4000-8000-000000000003",
      riderName: "Daniel Discret",
      riderPersonalityKey: "discret",
      bestRank: null,
      riderHadSetback: true,
    } as const;
    const { seed } = findEventWithId("personality-discret-debrief", { ...CONTEXT, ...rider });
    const event = selectZoneMixteEvent({ context: CONTEXT, seed, personalityRiders: [rider] });
    expect(event?.riderId).toBe(rider.riderId);
    expect(event?.story).toContain(rider.riderName);
    expect(selectZoneMixteEvent({
      context: CONTEXT, seed, personalityRiders: [{ ...rider, riderHadSetback: false }],
    })?.id).not.toBe(event?.id);
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

describe("communication du DS avec le coureur", () => {
  const scenarioIds = new Set(RIDER_INTERVIEW_SCENARIOS.map(({ id }) => id));
  const winner: ZoneMixtePersonalityRider = {
    riderId: CONTEXT.riderId,
    riderName: CONTEXT.riderName,
    bestRank: 1,
    riderResultStatus: "finished",
    riderPersonalityKey: "sociable",
    riderMorale: 64,
  };
  const teammate: ZoneMixtePersonalityRider = {
    riderId: "00000000-0000-4000-8000-000000000004",
    riderName: "Jules Test",
    bestRank: null,
    riderResultStatus: "did_not_finish",
    riderPersonalityKey: "discret",
    riderMorale: 32,
  };

  it("propose quatre réponses par situation et privilégie les événements de gestion dans les nouvelles interviews", () => {
    expect(scenarioIds.size).toBe(16);
    for (const scenario of RIDER_INTERVIEW_SCENARIOS) {
      expect(new Set(scenario.choices.map(({ id }) => id)).size).toBe(4);
      for (const choice of scenario.choices) {
        for (const personalityKey of Object.keys(RIDER_PERSONALITIES) as RiderPersonalityKey[]) {
          for (const morale of [0, 32, 60, 75, 100]) {
            const { riderMoraleDelta, riderPopularityDelta, weight } = buildRiderCommunicationOutcome({
              ...choice, personalityKey, morale,
            });
            expect(riderMoraleDelta).toBeGreaterThanOrEqual(-5);
            expect(riderMoraleDelta).toBeLessThanOrEqual(5);
            expect(riderPopularityDelta ?? 0).toBeLessThanOrEqual(1);
            expect(weight).toBe(100);
          }
        }
      }
    }

    const decisions = Array.from({ length: 1200 }, (_, index) =>
      selectZoneMixteEvent({ seed: `coaching-frequency-${index}`, context: CONTEXT, personalityRiders: [winner, teammate] }),
    ).filter((event) => event && scenarioIds.has(event.id));
    expect(decisions.length).toBeGreaterThan(475);
    expect(decisions.length).toBeLessThan(650);
  });

  it("cible le bon équipier et conditionne l’histoire à son résultat et à son moral", () => {
    const abandoned = findCoachingEvent("rider-abandon-return-to-bus", [winner, teammate]);
    expect(abandoned.event).toMatchObject({
      riderId: teammate.riderId, riderName: teammate.riderName, riderPersonalityKey: "discret", riderMorale: 32,
    });
    expect(abandoned.event.story).toContain(teammate.riderName);
    expect(abandoned.event.story).not.toContain(CONTEXT.riderName);
    expect(selectZoneMixteEvent({ context: CONTEXT, seed: abandoned.seed, personalityRiders: [winner] })?.id)
      .not.toBe(abandoned.event.id);
    expect(selectZoneMixteEvent({
      context: CONTEXT, seed: abandoned.seed, personalityRiders: [winner, teammate], usedEventIds: [abandoned.event.id],
    })?.id).not.toBe(abandoned.event.id);

    const low = findCoachingEvent("rider-low-morale-check-in", [winner, teammate]);
    expect(low.event.riderId).toBe(teammate.riderId);
    expect(selectZoneMixteEvent({
      context: CONTEXT, seed: low.seed, personalityRiders: [winner, { ...teammate, riderMorale: 65 }],
    })?.id).not.toBe(low.event.id);
  });

  it("fait réagir différemment deux caractères à la même mise en avant publique", () => {
    const { seed, event } = findCoachingEvent("rider-first-microphone-after-win", [winner]);
    const reserved = selectZoneMixteEvent({
      context: CONTEXT,
      seed,
      personalityRiders: [{ ...winner, riderPersonalityKey: "discret" }],
    });
    expect(reserved?.id).toBe(event.id);
    const praise = (candidate: typeof event | null) =>
      candidate?.choices.find(({ id }) => id === "spotlight-winner")?.outcomes[0];
    expect(praise(event)?.riderMoraleDelta).toBe(3);
    expect(praise(reserved)?.riderMoraleDelta).toBe(-1);
    expect(praise(reserved)?.summary).toContain(winner.riderName);

    const view = concealZoneMixteEventOutcomes({ ...CONTEXT, zoneMixteEvent: event });
    expect(view.zoneMixteEvent?.riderPersonalityKey).toBe("sociable");
    expect(view.zoneMixteEvent?.choices.every(({ outcomes }) => outcomes.length === 0)).toBe(true);
  });

  it("change l’effet d’un défi quand le même Ambitieux est fragilisé", () => {
    const choice = { approach: "challenge", baseMorale: -1, personalityKey: "ambitieux" } as const;
    expect(buildRiderCommunicationOutcome({ ...choice, morale: 34 }).riderMoraleDelta).toBe(-1);
    expect(buildRiderCommunicationOutcome({ ...choice, morale: 75 }).riderMoraleDelta).toBe(2);
  });

  it("distingue le vrai résultat du contre-la-montre par équipes d’un rang individuel", () => {
    const context: PostRaceInterviewContext = {
      ...CONTEXT,
      stageType: "team_time_trial",
      detailedRaceFacts: {
        starters: 6, finishers: 6, incidents: [], primes: [], work: [],
        teamTimeTrial: { rank: 1, timeMs: 120_000, gapMs: 0, winnerTeam: CONTEXT.teamName },
      },
    };
    const { event } = findCoachingEvent("rider-team-chrono-relays", [winner], context);
    expect(event.story).toContain(winner.riderName);
    const choices = Array.from({ length: 200 }, (_, index) =>
      selectZoneMixteEvent({ context, seed: `team-trial-coaching-${index}`, personalityRiders: [winner] })?.id,
    );
    expect(choices).not.toContain("rider-first-microphone-after-win");
  });
});

function findCoachingEvent(id: string, personalityRiders: readonly ZoneMixtePersonalityRider[], context = CONTEXT) {
  for (let index = 0; index < 500; index += 1) {
    const seed = `coaching-${id}-${index}`;
    const event = selectZoneMixteEvent({ context, seed, personalityRiders });
    if (event?.id === id) return { seed, event };
  }
  throw new Error(`Missing coaching event: ${id}`);
}

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
