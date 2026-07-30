import { describe, expect, it } from "vitest";

import {
  buildRaceFavorites,
  getFrozenRaceFavoriteRiders,
  getRaceFavoriteScore,
} from "@/lib/game/race-favorites";
import type {
  RaceCalendarEdition,
  RaceCalendarStage,
  RaceProfileType,
} from "@/lib/game/race-calendar";
import type {
  RiderSimulationInput,
  RiderSimulationRatings,
} from "@/lib/game/race-simulation";

const BASE_RATINGS: RiderSimulationRatings = {
  flat: 60,
  mountain: 60,
  hills: 60,
  downhill: 60,
  cobbles: 60,
  timeTrial: 60,
  prologue: 60,
  sprint: 60,
  acceleration: 60,
  endurance: 60,
  resistance: 60,
  recovery: 60,
  breakaway: 60,
};

describe("buildRaceFavorites", () => {
  it("place un sprinteur devant un grimpeur sur une course plate", () => {
    const sprinter = createRider("sprinter", {
      sprint: 90,
      acceleration: 86,
      flat: 78,
    });
    const climber = createRider("climber", {
      mountain: 92,
      hills: 80,
      sprint: 45,
      acceleration: 52,
    });
    const edition = createEdition("one_day", [
      createStage("flat", [
        createSegment(1, "flat", 80),
        createSegment(2, "flat", 80),
      ]),
    ], [climber, sprinter]);

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("sprinter");
  });

  it("fait primer les vrais sprinteurs sur les rouleurs lors du Circuit de Mazurie", () => {
    const julioRodrigues = createRider("julio-rodrigues", {
      mountain: 43,
      hills: 54,
      recovery: 55,
      endurance: 67,
      resistance: 68,
      breakaway: 59,
      downhill: 46,
      acceleration: 65,
      sprint: 53,
      flat: 68,
      cobbles: 66,
      prologue: 54,
      timeTrial: 48,
    });
    const sprinter = createRider("sprinter-mazurie", {
      sprint: 64,
      acceleration: 61,
      flat: 56,
      endurance: 55,
      resistance: 56,
    });
    const edition = createEdition(
      "one_day",
      [
        createStage("sprint", [
          createSegment(1, "flat", 62),
          createSegment(2, "flat", 62),
          createSegment(3, "flat", 62),
        ]),
      ],
      [julioRodrigues, sprinter],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(
      "sprinter-mazurie",
    );
    const scoreGap =
      getRaceFavoriteScore(edition, sprinter) -
      getRaceFavoriteScore(edition, julioRodrigues);
    expect(scoreGap).toBeGreaterThan(4);
  });

  it("conserve les spécialistes de chaque profil en tête des classiques", () => {
    const generalist = createRider("generalist", {
      flat: 72,
      endurance: 72,
      resistance: 72,
    });
    const specialists = {
      flat: createRider("sprinter-flat", {
        sprint: 68,
        acceleration: 65,
        flat: 58,
      }),
      sprint: createRider("sprinter-sprint", {
        sprint: 68,
        acceleration: 65,
        flat: 58,
      }),
      hilly: createRider("puncheur", {
        hills: 69,
        acceleration: 66,
      }),
      mountain: createRider("grimpeur", {
        mountain: 72,
        hills: 66,
      }),
      cobbles: createRider("flandrien", {
        cobbles: 72,
        flat: 64,
        resistance: 66,
      }),
      time_trial: createRider("rouleur-chrono", {
        timeTrial: 72,
        flat: 64,
      }),
    } satisfies Record<
      | "flat"
      | "sprint"
      | "hilly"
      | "mountain"
      | "cobbles"
      | "time_trial",
      RiderSimulationInput
    >;
    const segmentsByProfile: Record<
      keyof typeof specialists,
      RaceCalendarStage["segments"]
    > = {
      flat: [createSegment(1, "flat", 180)],
      sprint: [createSegment(1, "flat", 180)],
      hilly: [createSegment(1, "climb", 180, 4.5)],
      mountain: [createSegment(1, "climb", 180, 7.5)],
      cobbles: [
        {
          ...createSegment(1, "flat", 180),
          surface: "cobbles",
        },
      ],
      time_trial: [createSegment(1, "flat", 42)],
    };

    for (const profile of Object.keys(specialists) as Array<
      keyof typeof specialists
    >) {
      const edition = createEdition(
        "one_day",
        [createStage(profile, segmentsByProfile[profile])],
        [generalist, specialists[profile]],
      );

      expect(
        buildRaceFavorites({ edition })[0].rider.id,
        `profil ${profile}`,
      ).toBe(specialists[profile].id);
    }
  });

  it("place un grimpeur devant un sprinteur lors d'une arrivée en montagne", () => {
    const sprinter = createRider("sprinter", {
      sprint: 92,
      acceleration: 88,
      mountain: 50,
    });
    const climber = createRider("climber", {
      mountain: 91,
      hills: 82,
      endurance: 84,
      resistance: 82,
    });
    const edition = createEdition("one_day", [
      createStage("mountain", [
        createSegment(1, "flat", 70),
        createSegment(2, "climb", 18, 7.5),
      ]),
    ], [sprinter, climber]);

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("climber");
  });

  it("évalue une course par étapes pour le général et limite la liste à vingt", () => {
    const allRounder = createRider("all-rounder", {
      mountain: 83,
      hills: 81,
      timeTrial: 82,
      endurance: 84,
      resistance: 82,
      recovery: 86,
    });
    const pureSprinter = createRider("pure-sprinter", {
      flat: 84,
      sprint: 95,
      acceleration: 92,
      mountain: 45,
      timeTrial: 52,
      recovery: 58,
    });
    const field = [
      pureSprinter,
      ...Array.from({ length: 23 }, (_, index) =>
        createRider(`rider-${index + 1}`, {
          mountain: 62 + index,
          hills: 61 + index,
        }),
      ),
      allRounder,
    ];
    const edition = createEdition(
      "stage_race",
      [
        createStage("flat", [createSegment(1, "flat", 150)], 1),
        createStage(
          "mountain",
          [
            createSegment(1, "flat", 90),
            createSegment(2, "climb", 24, 8),
          ],
          2,
        ),
        createStage(
          "time_trial",
          [createSegment(1, "flat", 32)],
          3,
          "individual_time_trial",
        ),
      ],
      field,
    );

    const favorites = buildRaceFavorites({ edition });

    expect(favorites).toHaveLength(20);
    expect(favorites[0].rider.id).toBe("all-rounder");
    expect(favorites.slice(0, 3).every((favorite) => favorite.stars === 3)).toBe(true);
    expect(favorites.slice(3, 10).every((favorite) => favorite.stars === 2)).toBe(true);
    expect(favorites.slice(10).every((favorite) => favorite.stars === 1)).toBe(true);
  });

  it("recalcule immédiatement le pronostic quand un favori rejoint la startlist", () => {
    const initialRiders = [
      createRider("rider-a", { sprint: 68 }),
      createRider("rider-b", { sprint: 70 }),
    ];
    const superstar = createRider("superstar", {
      sprint: 96,
      acceleration: 94,
      flat: 90,
    });
    const edition = createEdition(
      "one_day",
      [createStage("sprint", [createSegment(1, "flat", 180)])],
      initialRiders,
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("rider-b");
    expect(
      buildRaceFavorites({
        edition,
        riders: [...initialRiders, superstar],
      })[0].rider.id,
    ).toBe("superstar");
  });

  it("base le favori du general sur l'etape vallonnee qui cree les ecarts", () => {
    const flatAllRounder = createRider("flat-all-rounder", {
      flat: 62,
      mountain: 48,
      hills: 48,
      downhill: 59,
      cobbles: 57,
      timeTrial: 54,
      prologue: 52,
      sprint: 54,
      acceleration: 51,
      endurance: 62,
      resistance: 66,
      recovery: 57,
      breakaway: 54,
    });
    const puncher = createRider("puncher", {
      flat: 55,
      mountain: 57,
      hills: 66,
      downhill: 58,
      sprint: 56,
      acceleration: 66,
      endurance: 58,
      resistance: 59,
      recovery: 58,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage("sprint", [createSegment(1, "flat", 112)], 1),
        createStage("flat", [createSegment(1, "flat", 118)], 2),
        createStage(
          "hilly",
          [
            createSegment(1, "flat", 20),
            createSegment(2, "climb", 10, 5.5),
            createSegment(3, "climb", 10, 5),
            createSegment(4, "descent", 10, -4),
            createSegment(5, "flat", 20),
            createSegment(6, "climb", 10, 4.5),
            createSegment(7, "descent", 10, -4),
            createSegment(8, "climb", 10, 4),
            createSegment(9, "climb", 10, 3.5),
            createSegment(10, "flat", 4),
          ],
          3,
        ),
        createStage("sprint", [createSegment(1, "flat", 130)], 4),
      ],
      [flatAllRounder, puncher],
    );

    const favorites = buildRaceFavorites({ edition });

    expect(favorites[0].rider.id).toBe("puncher");
  });

  it("fait de l'etape de montagne la reference du classement general", () => {
    const flatAllRounder = createRider("flat-rider", {
      flat: 68,
      mountain: 49,
      hills: 55,
      endurance: 65,
      resistance: 66,
      recovery: 62,
    });
    const climber = createRider("climber", {
      flat: 54,
      mountain: 72,
      hills: 66,
      endurance: 64,
      resistance: 62,
      recovery: 64,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage("sprint", [createSegment(1, "flat", 130)], 1),
        createStage("flat", [createSegment(1, "flat", 145)], 2),
        createStage(
          "mountain",
          [
            createSegment(1, "flat", 70),
            createSegment(2, "climb", 20, 7),
            createSegment(3, "descent", 15, -6),
            createSegment(4, "climb", 25, 8),
          ],
          3,
        ),
        createStage("sprint", [createSegment(1, "flat", 125)], 4),
      ],
      [flatAllRounder, climber],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("climber");
  });

  it("considere les paves comme un terrain majeur pour les ecarts", () => {
    const flatAllRounder = createRider("flat-rider", {
      flat: 68,
      cobbles: 48,
      endurance: 65,
      resistance: 66,
      recovery: 62,
    });
    const cobblesSpecialist = createRider("cobbles-specialist", {
      flat: 58,
      cobbles: 72,
      endurance: 63,
      resistance: 66,
      recovery: 61,
    });
    const cobblesStage = createStage(
      "cobbles",
      [
        createSegment(1, "flat", 30),
        {
          ...createSegment(2, "flat", 70),
          surface: "cobbles",
        },
        createSegment(3, "flat", 30),
      ],
      3,
    );
    const edition = createEdition(
      "stage_race",
      [
        createStage("sprint", [createSegment(1, "flat", 120)], 1),
        createStage("flat", [createSegment(1, "flat", 130)], 2),
        cobblesStage,
        createStage("sprint", [createSegment(1, "flat", 125)], 4),
      ],
      [flatAllRounder, cobblesSpecialist],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(
      "cobbles-specialist",
    );
  });

  it("amplifie l'impact d'un CLM long et montagneux sur le general", () => {
    const chronoClimber = createRider("chrono-climber", {
      flat: 58,
      mountain: 78,
      hills: 74,
      timeTrial: 78,
      endurance: 70,
      resistance: 68,
      recovery: 66,
    });
    const ordinaryRider = createRider("ordinary-rider", {
      flat: 60,
      mountain: 58,
      hills: 58,
      timeTrial: 60,
      endurance: 62,
      resistance: 62,
      recovery: 62,
    });
    const commonStages = [
      createStage("sprint", [createSegment(1, "flat", 120)], 1),
      createStage("flat", [createSegment(1, "flat", 130)], 2),
      createStage("sprint", [createSegment(1, "flat", 125)], 3),
    ];
    const shortFlatTimeTrial = createStage(
      "time_trial",
      [createSegment(1, "flat", 12)],
      4,
      "individual_time_trial",
    );
    const longMountainTimeTrial = createStage(
      "mountain",
      [
        createSegment(1, "flat", 10),
        createSegment(2, "climb", 20, 6.5),
        createSegment(3, "descent", 10, -5),
        createSegment(4, "climb", 20, 7),
      ],
      4,
      "individual_time_trial",
    );
    const shortEdition = createEdition(
      "stage_race",
      [...commonStages, shortFlatTimeTrial],
      [chronoClimber, ordinaryRider],
    );
    const longMountainEdition = createEdition(
      "stage_race",
      [...commonStages, longMountainTimeTrial],
      [chronoClimber, ordinaryRider],
    );
    const shortGap =
      getRaceFavoriteScore(shortEdition, chronoClimber) -
      getRaceFavoriteScore(shortEdition, ordinaryRider);
    const longMountainGap =
      getRaceFavoriteScore(longMountainEdition, chronoClimber) -
      getRaceFavoriteScore(longMountainEdition, ordinaryRider);

    expect(longMountainGap).toBeGreaterThan(shortGap + 1.5);
  });

  it("corrige le classement reel de Zanzibar a partir des profils intrinseques", () => {
    const kubat = {
      ...createRider("kubat", {
        mountain: 53,
        hills: 70,
        flat: 46,
        timeTrial: 48,
        cobbles: 65,
        sprint: 68,
        acceleration: 47,
        downhill: 68,
        endurance: 62,
        resistance: 64,
        recovery: 54,
        breakaway: 70,
        prologue: 58,
      }),
      form: 74,
      careerRaceDays: 7,
    } satisfies RiderSimulationInput;
    const sylvain = createRider("sylvain", {
      mountain: 63,
      hills: 70,
      acceleration: 62,
      endurance: 58,
      resistance: 63,
      recovery: 55,
    });
    const claudiu = {
      ...createRider("claudiu", {
        mountain: 54,
        hills: 70,
        flat: 51,
        timeTrial: 68,
        cobbles: 59,
        sprint: 49,
        acceleration: 52,
        downhill: 44,
        endurance: 67,
        resistance: 68,
        recovery: 45,
        breakaway: 52,
        prologue: 61,
      }),
      form: 55,
      careerRaceDays: 3,
    } satisfies RiderSimulationInput;
    const cedric = {
      ...createRider("cedric", {
        mountain: 62,
        hills: 68,
        flat: 44,
        timeTrial: 42,
        cobbles: 48,
        sprint: 60,
        acceleration: 59,
        downhill: 56,
        endurance: 59,
        resistance: 51,
        recovery: 51,
        breakaway: 56,
        prologue: 47,
      }),
      form: 100,
    } satisfies RiderSimulationInput;
    const leo = {
      ...createRider("leo", {
        mountain: 47,
        hills: 58,
        flat: 58,
        timeTrial: 50,
        cobbles: 53,
        sprint: 48,
        acceleration: 52,
        downhill: 56,
        endurance: 58,
        resistance: 61,
        recovery: 60,
        breakaway: 50,
        prologue: 48,
      }),
      form: 100,
      careerRaceDays: 500,
      localRaceBonus: 3,
      reconnaissanceBonus: 5,
      equipmentEffects: {
        ratingBonuses: { hills: 50, mountain: 50 },
        timeTrialRatingBonuses: { timeTrial: 50 },
        injuryRiskReductionPct: 0,
        breakawayReputationBonus: 0,
        victoryReputationBonus: 0,
      },
    } satisfies RiderSimulationInput;
    const edition = createEdition(
      "stage_race",
      createZanzibarStages(),
      [leo, cedric, kubat, claudiu, sylvain],
    );

    expect(
      buildRaceFavorites({ edition }).map((favorite) => favorite.rider.id),
    ).toEqual([
      "sylvain",
      "claudiu",
      "kubat",
      "cedric",
      "leo",
    ]);
  });

  it("ignore forme equipement et bonus contextuels sur tous les pronostics", () => {
    const baseRider = createRider("base-profile", {
      mountain: 64,
      hills: 72,
      timeTrial: 68,
      endurance: 66,
      resistance: 65,
      recovery: 63,
    });
    const boostedContext = {
      ...baseRider,
      id: "boosted-context",
      name: "boosted-context",
      form: 100,
      careerRaceDays: 500,
      localRaceBonus: 5,
      reconnaissanceBonus: 8,
      equipmentEffects: {
        ratingBonuses: { hills: 40, mountain: 40 },
        timeTrialRatingBonuses: { timeTrial: 40 },
        injuryRiskReductionPct: 25,
        breakawayReputationBonus: 5,
        victoryReputationBonus: 5,
      },
    } satisfies RiderSimulationInput;
    const lowContext = {
      ...baseRider,
      id: "low-context",
      name: "low-context",
      form: 1,
      careerRaceDays: 0,
      localRaceBonus: 0,
      reconnaissanceBonus: 0,
    } satisfies RiderSimulationInput;
    const classic = createEdition(
      "one_day",
      [createStage("hilly", [createSegment(1, "climb", 180, 4.5)])],
      [boostedContext, lowContext],
    );
    const tour = createEdition(
      "stage_race",
      [
        createStage("sprint", [createSegment(1, "flat", 120)], 1),
        createStage(
          "time_trial",
          [createSegment(1, "flat", 35)],
          2,
          "individual_time_trial",
        ),
      ],
      [boostedContext, lowContext],
    );

    expect(getRaceFavoriteScore(classic, boostedContext)).toBe(
      getRaceFavoriteScore(classic, lowContext),
    );
    expect(getRaceFavoriteScore(tour, boostedContext)).toBe(
      getRaceFavoriteScore(tour, lowContext),
    );
  });

  it("ne dilue pas une etape decisive avec des etapes promises au meme temps", () => {
    const specialist = createRider("specialist", {
      hills: 70,
      mountain: 63,
      flat: 44,
      sprint: 45,
      endurance: 64,
      resistance: 63,
    });
    const flatRider = createRider("flat-rider", {
      hills: 58,
      mountain: 52,
      flat: 78,
      sprint: 76,
      endurance: 68,
      resistance: 69,
    });
    const zanzibarStages = createZanzibarStages();
    const queenStageOnly = createEdition(
      "stage_race",
      [zanzibarStages[2]],
      [specialist, flatRider],
    );
    const fullTour = createEdition(
      "stage_race",
      zanzibarStages,
      [specialist, flatRider],
    );

    expect(getRaceFavoriteScore(fullTour, specialist)).toBeCloseTo(
      getRaceFavoriteScore(queenStageOnly, specialist),
      10,
    );
    expect(getRaceFavoriteScore(fullTour, flatRider)).toBeCloseTo(
      getRaceFavoriteScore(queenStageOnly, flatRider),
      10,
    );
    expect(buildRaceFavorites({ edition: fullTour })[0].rider.id).toBe(
      "specialist",
    );
  });

  it("isole la difficulte decisive d'une longue etape mixte", () => {
    const selectiveRider = createRider("selective-rider", {
      hills: 76,
      mountain: 72,
      flat: 45,
      endurance: 66,
      resistance: 64,
    });
    const flatRider = createRider("mixed-flat-rider", {
      hills: 50,
      mountain: 50,
      flat: 85,
      endurance: 70,
      resistance: 70,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage("sprint", [createSegment(1, "flat", 120)], 1),
        createStage(
          "mixed",
          [
            createSegment(1, "flat", 100),
            createSegment(2, "climb", 20, 7),
          ],
          2,
        ),
      ],
      [flatRider, selectiveRider],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(
      "selective-rider",
    );
  });

  it("utilise un profil GC dedie pour une etape mixte sans troncons", () => {
    const gcRider = createRider("mixed-gc-rider", {
      hills: 70,
      mountain: 70,
      cobbles: 65,
      flat: 60,
      endurance: 65,
      resistance: 65,
      sprint: 40,
      breakaway: 40,
      prologue: 40,
    });
    const irrelevantSpecialist = createRider("irrelevant-specialist", {
      hills: 50,
      mountain: 50,
      cobbles: 50,
      flat: 55,
      endurance: 55,
      resistance: 55,
      sprint: 99,
      breakaway: 99,
      prologue: 99,
    });
    const edition = createEdition(
      "stage_race",
      [createStage("mixed", [], 1)],
      [irrelevantSpecialist, gcRider],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(
      "mixed-gc-rider",
    );
  });

  it("pondere deux profils selectifs selon leur difficulte reelle", () => {
    const puncher = createRider("hard-hilly-puncher", {
      hills: 80,
      mountain: 52,
      acceleration: 65,
      endurance: 65,
      resistance: 65,
      recovery: 60,
    });
    const climber = createRider("short-climb-specialist", {
      hills: 58,
      mountain: 78,
      acceleration: 55,
      downhill: 65,
      endurance: 65,
      resistance: 65,
      recovery: 60,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage(
          "hilly",
          [
            createSegment(1, "flat", 60),
            createSegment(2, "climb", 60, 5),
          ],
          1,
        ),
        createStage(
          "mountain",
          [
            createSegment(1, "flat", 118),
            createSegment(2, "climb", 2, 2),
          ],
          2,
        ),
      ],
      [climber, puncher],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe(
      "hard-hilly-puncher",
    );
  });

  it("n'utilise pas le sprint pour departager un tour entierement plat", () => {
    const rouleur = createRider("flat-gc-rider", {
      flat: 72,
      endurance: 72,
      resistance: 70,
      sprint: 45,
    });
    const sprinter = createRider("flat-tour-sprinter", {
      flat: 48,
      endurance: 50,
      resistance: 48,
      sprint: 96,
      acceleration: 94,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage("flat", [createSegment(1, "flat", 140)], 1),
        createStage("sprint", [createSegment(1, "flat", 150)], 2),
      ],
      [sprinter, rouleur],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("flat-gc-rider");
  });

  it("laisse l'etape reine primer sur un prologue", () => {
    const prologueSpecialist = createRider("prologue-specialist", {
      prologue: 92,
      timeTrial: 82,
      acceleration: 80,
      hills: 48,
      mountain: 50,
    });
    const gcPuncher = createRider("gc-puncher", {
      prologue: 48,
      timeTrial: 50,
      hills: 76,
      mountain: 68,
      acceleration: 68,
      endurance: 66,
      resistance: 64,
    });
    const edition = createEdition(
      "stage_race",
      [
        createStage(
          "time_trial",
          [createSegment(1, "flat", 7)],
          1,
          "prologue",
        ),
        createStage(
          "hilly",
          [
            createSegment(1, "flat", 60),
            createSegment(2, "climb", 60, 5),
          ],
          2,
        ),
      ],
      [prologueSpecialist, gcPuncher],
    );

    expect(buildRaceFavorites({ edition })[0].rider.id).toBe("gc-puncher");
  });

  it("reste deterministe pour une edition sans etape", () => {
    const rider = createRider("empty-edition-rider", {
      hills: 72,
      mountain: 68,
    });
    const contextualClone = {
      ...rider,
      id: "empty-edition-context",
      name: "empty-edition-context",
      form: 100,
      localRaceBonus: 5,
      equipmentEffects: {
        ratingBonuses: { hills: 50 },
        timeTrialRatingBonuses: { timeTrial: 50 },
        injuryRiskReductionPct: 0,
        breakawayReputationBonus: 0,
        victoryReputationBonus: 0,
      },
    } satisfies RiderSimulationInput;
    const edition = createEdition(
      "stage_race",
      [],
      [rider, contextualClone],
    );

    expect(getRaceFavoriteScore(edition, rider)).toBe(
      getRaceFavoriteScore(edition, contextualClone),
    );
    expect(Number.isFinite(getRaceFavoriteScore(edition, rider))).toBe(true);
  });
});

describe("getFrozenRaceFavoriteRiders", () => {
  it("conserve la startlist de la première étape d'un tour", () => {
    const original = createRider("original");
    const lateEditionRider = createRider("late-edition");
    const stageOne = createStage("flat", [createSegment(1, "flat", 120)], 1);
    const stageTwo = createStage("hilly", [createSegment(1, "climb", 120, 4)], 2);
    const edition = createEdition(
      "stage_race",
      [stageTwo, stageOne],
      [lateEditionRider],
    );

    const riders = getFrozenRaceFavoriteRiders(edition, [
      {
        stageId: stageTwo.id,
        input: { riders: [lateEditionRider] },
      },
      {
        stageId: stageOne.id,
        input: { riders: [original] },
      },
    ]);

    expect(riders.map((rider) => rider.id)).toEqual(["original"]);
  });

  it("utilise la startlist de l’étape demandée et retire les indisponibles", () => {
    const original = createRider("original");
    const climber = createRider("climber", { mountain: 90 });
    const withdrawn = createRider("withdrawn", { mountain: 95 });
    const stageOne = createStage(
      "flat",
      [createSegment(1, "flat", 120)],
      1,
    );
    const stageSix = createStage(
      "mountain",
      [createSegment(1, "climb", 152, 7)],
      6,
    );
    const edition = createEdition(
      "stage_race",
      [stageOne, stageSix],
      [original, climber, withdrawn],
    );

    const riders = getFrozenRaceFavoriteRiders(
      edition,
      [
        {
          stageId: stageOne.id,
          input: { riders: [original, climber, withdrawn] },
        },
        {
          stageId: stageSix.id,
          input: {
            riders: [original, climber, withdrawn],
            unavailableRiderIds: [withdrawn.id],
          },
        },
      ],
      stageSix.id,
    );

    expect(riders.map((rider) => rider.id)).toEqual([
      "original",
      "climber",
    ]);
  });
});

function createEdition(
  raceFormat: RaceCalendarEdition["raceFormat"],
  stages: RaceCalendarStage[],
  engagedRiders: RiderSimulationInput[],
): RaceCalendarEdition {
  return {
    id: "edition-1",
    raceId: "race-1",
    slug: "course-test",
    name: "Course test",
    shortName: null,
    countryName: "France",
    countryCode: "FR",
    categoryCode: "national",
    categoryName: "Nationale",
    prestigeRank: 1,
    raceFormat,
    competitionType: "standard",
    registrationClosesAt: null,
    wildcardClosesAt: null,
    withdrawalClosesAt: null,
    registrationPolicy: "open",
    minimumReputation: null,
    minimumRosterSize: 1,
    maximumRosterSize: 8,
    engagedRiderCount: engagedRiders.length,
    engagedRiders,
    currentTeamRegistration: null,
    stages,
  };
}

function createStage(
  profileType: RaceProfileType,
  segments: RaceCalendarStage["segments"],
  stageNumber = 1,
  stageType: RaceCalendarStage["stageType"] = "road",
): RaceCalendarStage {
  return {
    id: `stage-${stageNumber}`,
    dayNumber: stageNumber,
    stageNumber,
    name: `Étape ${stageNumber}`,
    stageType,
    status: "planned",
    profileType,
    distanceKm: segments.reduce(
      (total, segment) => total + segment.distanceKm,
      0,
    ),
    daySlot: "early",
    departureAt: null,
    segments,
  };
}

function createZanzibarStages(): RaceCalendarStage[] {
  return [
    createStage("sprint", [createSegment(1, "flat", 112)], 1),
    createStage("flat", [createSegment(1, "flat", 118)], 2),
    createStage(
      "hilly",
      [
        createSegment(1, "flat", 10),
        createSegment(2, "climb", 10, 6.2),
        createSegment(3, "climb", 10, 5.9),
        createSegment(4, "descent", 10, -4.6),
        createSegment(5, "flat", 10),
        createSegment(6, "climb", 10, 5),
        createSegment(7, "descent", 10, -3.7),
        createSegment(8, "flat", 10),
        createSegment(9, "climb", 10, 4.1),
        createSegment(10, "climb", 10, 3.8),
        createSegment(11, "descent", 10, -5.7),
        createSegment(12, "flat", 10),
        createSegment(13, "climb", 4, 2.9),
      ],
      3,
    ),
    createStage("sprint", [createSegment(1, "flat", 112)], 4),
  ];
}

function createSegment(
  segmentNumber: number,
  terrain: RaceCalendarStage["segments"][number]["terrain"],
  distanceKm: number,
  averageGradientPct = 0,
): RaceCalendarStage["segments"][number] {
  return {
    segmentNumber,
    terrain,
    distanceKm,
    averageGradientPct,
    surface: "asphalt",
    prime: null,
  };
}

function createRider(
  id: string,
  ratings: Partial<RiderSimulationRatings> = {},
): RiderSimulationInput {
  return {
    id,
    name: id,
    teamId: `team-${id}`,
    teamName: `Équipe ${id}`,
    teamPrimaryColor: "#176951",
    teamSecondaryColor: "#FFFDF4",
    avatarProfileKey: null,
    avatarSeed: id,
    age: 27,
    form: 75,
    careerRaceDays: 80,
    role: "leader",
    ratings: {
      ...BASE_RATINGS,
      ...ratings,
    },
  };
}
