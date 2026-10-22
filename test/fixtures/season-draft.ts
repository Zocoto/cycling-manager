import type { SeasonDraftView } from "@/lib/game/season-draft";

export function createDraftFixture(): SeasonDraftView {
  return {
    serverNow: "2026-11-06T13:10:00+01:00", firstGameYear: 5, enabled: true,
    edition: { id: "10000000-0000-4000-8000-000000000001", gameYear: 5, status: "preparing", announcementAt: "2026-11-05T00:00:00+01:00", opensAt: "2026-11-06T08:00:00+01:00", startsAt: "2026-11-06T14:00:00+01:00", closedAt: null, currentPosition: null, deadline: null, participantCount: 4, poolCount: 42, version: 1 },
    mine: { teamId: "t1", position: 2, status: "pending", preferences: [], autoEnabled: false, reason: null, selectedRiderId: null },
    finance: { budget: 120000, rosterCount: 19, rosterLimit: 35, nonHomegrownCount: 19, nonHomegrownLimit: 35, salaryDiscountPercent: 3, homegrownRiderIds: [] },
    participants: Array.from({ length: 4 }, (_, index) => ({ teamId: `t${index}`, teamName: ["Dodo Blue Finance", "Kaffa Origins", "Abbaye du Lion", "Stoke Kilnware"][index], directorName: `Manager ${index+1}`, position: index+1, previousPoints: index*40, status: "pending", selectedRiderId: null, selectedName: null, reason: null })),
    riders: Array.from({ length: 42 }, (_, index) => ({
      id: `20000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`, firstName: ["Alex", "Esteban", "Carles", "Giorgos", "Milan", "Louis"][index%6], lastName: `Exemple ${index+1}`,
      countryCode: ["FR", "SV", "AD", "GR", "BE", "MU"][index%6], countryName: ["France", "Salvador", "Andorre", "Grèce", "Belgique", "Maurice"][index%6], age: 20+index%14, potentialSteps: 8-index%6,
      avatarProfileKey: "classic", avatarSeed: String(index+1),
      ratings: { mountain: 76-index%12, hills: 70+index%8, flat: 65+index%7, timeTrial: 58+index%13, cobbles: 57+index%17, sprint: 54+index%20, acceleration: 72, downhill: 65, endurance: 71, resistance: 70, recovery: 63, breakaway: 64, prologue: 61 },
      abilities: index%4===0 ? ["panache"] : [], injuryUntil: null, poolRank: index+1, score: 80-index/3, salaryPerSeason: 17000+index*500, selectedTeamId: null,
      heightCm: 180, weightKg: 69.5, careerRaceDays: index*8,
    })),
  };
}
