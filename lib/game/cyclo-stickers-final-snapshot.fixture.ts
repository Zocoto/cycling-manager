import { CYCLO_STICKERS_FINAL_TITLE_SLOTS, type CycloStickersFinalSource } from "./cyclo-stickers-final-snapshot";
import { RIDER_RATING_AXES, type RiderRatings } from "./rider-profile";

/** Synthetic isolated S4 rows. Never uses or relabels the frozen S3 pilot. */
export function createFinalCycloStickersSourceFixture(): CycloStickersFinalSource {
  const id = (value: number) => `10000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
  const sourceSeasonId = id(1);
  const teams = Array.from({ length: 5 }, (_, index) => ({
    sourceSeasonId, jerseySeasonId: sourceSeasonId, teamId: id(100 + index), rank: index + 1,
    name: `Équipe de recette ${index + 1}`, points: 5000 - index * 100,
    jersey: { primaryColor: "#123456", secondaryColor: "#ABCDEF", accentColor: "#FEDCBA", pattern: "diagonal" as const, status: "sponsored" as const, imagePath: `/images/sponsors/test-s4/jersey-${index}.webp` },
  }));
  const riders = Array.from({ length: 60 }, (_, index) => {
    const team = teams[index % 5];
    return {
      id: id(200 + index), sourceSeasonId, ratingsSeasonId: sourceSeasonId, contractSeasonId: sourceSeasonId, jerseySeasonId: sourceSeasonId,
      name: `Coureur de recette ${index + 1}`, country: "France", countryCode: "FR", age: 22 + index % 10,
      avatarProfileKey: "europe_west", avatarSeed: index, teamId: team.teamId, teamName: team.name, jersey: { ...team.jersey },
      ratings: index >= 57
        ? { ...Object.fromEntries(RIDER_RATING_AXES.map(({ key }) => [key, 60])) as RiderRatings, breakaway: 86 - (index - 57) }
        : { ...Object.fromEntries(RIDER_RATING_AXES.map(({ key }) => [key, 60 + index % 8])) as RiderRatings, mountain: 80, timeTrial: 75 },
      honours: [{ sourceSeasonId, raceEditionId: id(1000 + index), raceName: "Course S4 de recette", categoryCode: "elite", kind: "race" as const, count: 1, rank: 1 }],
    };
  });
  return {
    schemaVersion: 1, capturedAt: "2026-11-07T00:05:00.000Z",
    season: { id: sourceSeasonId, gameYear: 4, status: "completed", startsOn: "2026-10-10", endsOn: "2026-11-06" },
    ranking: riders.slice(0, 50).map((rider, index) => ({ sourceSeasonId, riderId: rider.id, rank: index + 1, points: 1000 - Math.floor(index / 2) * 10, victories: index % 5 })),
    bonusRanking: riders.slice(57).map((rider, index) => ({ sourceSeasonId, riderId: rider.id, rank: [71, 93, 128][index], points: 690 - index * 100, victories: index })),
    teams, riders,
    championships: CYCLO_STICKERS_FINAL_TITLE_SLOTS.map((type, index) => ({
      sourceSeasonId, type, riderId: riders[index < 6 ? index : 50 + index - 6].id,
      raceEditionId: id(2000 + index), raceStatus: "completed" as const, category: "pro" as const,
    })),
  };
}
