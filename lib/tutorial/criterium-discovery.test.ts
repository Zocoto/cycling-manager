import { describe, expect, it } from "vitest";

import {
  CRITERIUM_DISCOVERY_ROSTER_SIZE,
  CRITERIUM_DISCOVERY_SLUG,
  appendCriteriumDiscoveryEdition,
  createCriteriumDiscoveryPreviewEdition,
  isValidCriteriumDiscoveryRoster,
} from "@/lib/tutorial/criterium-discovery";
import type { RaceCalendarEdition } from "@/lib/game/race-calendar";

describe("Critérium de la découverte", () => {
  it("reprend une édition de course standard de 120 km", () => {
    const edition =
      createCriteriumDiscoveryPreviewEdition({
        dayNumber: 4,
      });

    expect(edition.slug).toBe(
      CRITERIUM_DISCOVERY_SLUG,
    );
    expect(edition.competitionType).toBe(
      "standard",
    );
    expect(edition.raceFormat).toBe(
      "one_day",
    );
    expect(edition.stages).toHaveLength(1);
    expect(
      edition.stages[0]?.segments.reduce(
        (total, segment) =>
          total + segment.distanceKm,
        0,
      ),
    ).toBeCloseTo(120, 5);
  });

  it("exige exactement cinq coureurs différents", () => {
    const roster = Array.from(
      {
        length:
          CRITERIUM_DISCOVERY_ROSTER_SIZE,
      },
      (_, index) => ({
        riderId: `rider-${index}`,
        role:
          index === 0
            ? ("leader" as const)
            : ("auto" as const),
      }),
    );

    expect(
      isValidCriteriumDiscoveryRoster(
        roster,
      ),
    ).toBe(true);

    expect(
      isValidCriteriumDiscoveryRoster(
        roster.slice(0, 4),
      ),
    ).toBe(false);

    expect(
      isValidCriteriumDiscoveryRoster([
        ...roster.slice(0, 4),
        roster[0]!,
      ]),
    ).toBe(false);
  });

  it("refuse deux leaders ou deux sprinteurs", () => {
    const roster = Array.from(
      { length: 5 },
      (_, index) => ({
        riderId: `rider-${index}`,
        role:
          index < 2
            ? ("leader" as const)
            : ("auto" as const),
      }),
    );

    expect(
      isValidCriteriumDiscoveryRoster(
        roster,
      ),
    ).toBe(false);
  });


  it("remplace une précédente occurrence dans le calendrier", () => {
    const edition =
      createCriteriumDiscoveryPreviewEdition({
        dayNumber: 7,
      });

    const existing = {
      ...edition,
      id: "existing-criterion",
    };

    const other = {
      ...edition,
      id: "other-race",
      slug: "autre-course",
    };

    const result =
      appendCriteriumDiscoveryEdition({
        editions: [
          existing,
          other,
        ] as RaceCalendarEdition[],
        edition,
      });

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe(
      edition.id,
    );
    expect(result[1]?.slug).toBe(
      "autre-course",
    );
  });
});
