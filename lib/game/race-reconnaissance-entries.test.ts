import { describe, expect, it } from "vitest";

import {
  getPreparatoryRaceEntriesByRider,
  isRaceEditionRegisteredForEveryRider,
} from "./race-reconnaissance-entries";

const editionNamesById = new Map([
  ["a", "Critérium de Namur"],
  ["b", "Tour des Volcans"],
]);
const stageDaysByEditionId = new Map([
  ["a", [8]],
  ["b", [11, 12, 13]],
]);

describe("courses éligibles à une reconnaissance", () => {
  it("ne retient que les coureurs inscrits sur une liste acceptée et une course future", () => {
    const entries = getPreparatoryRaceEntriesByRider({
      registrations: [
        { id: "accepted-a", race_edition_id: "a", status: "accepted", entry_method: "requested" },
        { id: "accepted-b", race_edition_id: "b", status: "accepted", entry_method: "requested" },
        { id: "pending", race_edition_id: "b", status: "pending", entry_method: "requested" },
      ],
      eliteEditionIds: new Set<string>(),
      rosters: [
        { rider_id: "one", race_registration_id: "accepted-a", status: "selected" },
        { rider_id: "one", race_registration_id: "accepted-b", status: "confirmed" },
        { rider_id: "two", race_registration_id: "accepted-b", status: "selected" },
        { rider_id: "three", race_registration_id: "pending", status: "selected" },
        { rider_id: "four", race_registration_id: "accepted-a", status: "withdrawn" },
      ],
      editionNamesById,
      stageDaysByEditionId,
      currentDayNumber: 6,
    });

    expect(entries.get("one")?.map((entry) => entry.editionId)).toEqual([
      "a",
      "b",
    ]);
    expect(entries.get("two")?.[0]).toMatchObject({
      raceName: "Tour des Volcans",
      startDayNumber: 11,
      endDayNumber: 13,
    });
    expect(entries.has("three")).toBe(false);
    expect(entries.has("four")).toBe(false);
  });

  it("autorise uniquement la liste d'une WildCard Élite réellement en attente", () => {
    const entries = getPreparatoryRaceEntriesByRider({
      registrations: [
        { id: "elite-pending", race_edition_id: "b", status: "pending", entry_method: "requested" },
        { id: "elite-rejected", race_edition_id: "b", status: "rejected", entry_method: "requested" },
        { id: "non-elite-pending", race_edition_id: "a", status: "pending", entry_method: "requested" },
        { id: "elite-invited", race_edition_id: "b", status: "pending", entry_method: "invited" },
      ],
      rosters: [
        { rider_id: "eligible", race_registration_id: "elite-pending", status: "selected" },
        { rider_id: "rejected", race_registration_id: "elite-rejected", status: "selected" },
        { rider_id: "non-elite", race_registration_id: "non-elite-pending", status: "selected" },
        { rider_id: "invited", race_registration_id: "elite-invited", status: "selected" },
      ],
      eliteEditionIds: new Set(["b"]),
      editionNamesById,
      stageDaysByEditionId,
      currentDayNumber: 6,
    });

    expect(entries.get("eligible")?.[0]).toMatchObject({
      editionId: "b",
      pendingWildcard: true,
    });
    expect(entries.has("rejected")).toBe(false);
    expect(entries.has("non-elite")).toBe(false);
    expect(entries.has("invited")).toBe(false);
  });

  it("masque une course dès qu'un des coureurs sélectionnés n'y figure pas", () => {
    const riders = [
      { registeredRaces: [{ editionId: "a", raceName: "A", startDayNumber: 8, endDayNumber: 8 }] },
      { registeredRaces: [{ editionId: "b", raceName: "B", startDayNumber: 9, endDayNumber: 9 }] },
    ];
    expect(isRaceEditionRegisteredForEveryRider("a", riders)).toBe(false);
    expect(isRaceEditionRegisteredForEveryRider("b", riders)).toBe(false);
    expect(isRaceEditionRegisteredForEveryRider("a", riders.slice(0, 1))).toBe(true);
    expect(isRaceEditionRegisteredForEveryRider("a", [])).toBe(false);
  });

  it("écarte les courses terminées", () => {
    const entries = getPreparatoryRaceEntriesByRider({
      registrations: [
        { id: "accepted-a", race_edition_id: "a", status: "accepted", entry_method: "requested" },
      ],
      eliteEditionIds: new Set<string>(),
      rosters: [{ rider_id: "one", race_registration_id: "accepted-a", status: "selected" }],
      editionNamesById,
      stageDaysByEditionId,
      currentDayNumber: 8,
    });
    expect(entries.has("one")).toBe(false);
  });
});
