export type ReconnaissanceRaceEntry = {
  editionId: string;
  raceName: string;
  startDayNumber: number;
  endDayNumber: number;
};

export function getAcceptedRaceEntriesByRider({
  registrations,
  rosters,
  editionNamesById,
  stageDaysByEditionId,
  currentDayNumber,
}: {
  registrations: Array<{
    id: string;
    race_edition_id: string;
    status: string;
  }>;
  rosters: Array<{
    rider_id: string;
    race_registration_id: string;
    status: string;
  }>;
  editionNamesById: Map<string, string>;
  stageDaysByEditionId: Map<string, number[]>;
  currentDayNumber: number;
}) {
  const acceptedById = new Map(
    registrations
      .filter((registration) => registration.status === "accepted")
      .map((registration) => [registration.id, registration]),
  );
  const entriesByRider = new Map<string, ReconnaissanceRaceEntry[]>();

  for (const roster of rosters) {
    if (roster.status !== "selected" && roster.status !== "confirmed") {
      continue;
    }
    const registration = acceptedById.get(roster.race_registration_id);
    if (!registration) continue;
    const editionId = registration.race_edition_id;
    const raceName = editionNamesById.get(editionId);
    const days = stageDaysByEditionId.get(editionId) ?? [];
    if (!raceName || days.length === 0) continue;

    const startDayNumber = Math.min(...days);
    const endDayNumber = Math.max(...days);
    if (endDayNumber <= currentDayNumber) continue;

    const entries = entriesByRider.get(roster.rider_id) ?? [];
    if (entries.some((entry) => entry.editionId === editionId)) continue;
    entries.push({ editionId, raceName, startDayNumber, endDayNumber });
    entriesByRider.set(roster.rider_id, entries);
  }

  for (const entries of entriesByRider.values()) {
    entries.sort(
      (left, right) =>
        left.startDayNumber - right.startDayNumber ||
        left.raceName.localeCompare(right.raceName, "fr"),
    );
  }

  return entriesByRider;
}

export function isRaceEditionRegisteredForEveryRider(
  editionId: string,
  riders: Array<{ registeredRaces: ReconnaissanceRaceEntry[] }>,
) {
  return (
    riders.length > 0 &&
    riders.every((rider) =>
      rider.registeredRaces.some((entry) => entry.editionId === editionId),
    )
  );
}
