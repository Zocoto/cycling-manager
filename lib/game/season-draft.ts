import { RIDER_RATING_AXES, type RiderRatings } from "@/lib/game/rider-profile";

export type SeasonDraftRider = {
  id: string; firstName: string; lastName: string; countryCode: string; countryName: string;
  age: number; potentialSteps: number; avatarProfileKey: string | null; avatarSeed: string | null;
  ratings: RiderRatings; abilities: string[]; injuryUntil: string | null;
  heightCm?: number | null; weightKg?: number | null; careerRaceDays?: number;
  poolRank: number; score: number; salaryPerSeason: number; selectedTeamId: string | null;
};
export type SeasonDraftParticipant = {
  teamId: string; teamName: string; directorName: string; position: number; previousPoints: number;
  status: "pending" | "picked" | "passed"; selectedRiderId: string | null; selectedName: string | null; reason: string | null;
};
export type SeasonDraftView = {
  serverNow: string; firstGameYear: number; enabled: boolean;
  edition: null | {
    id: string; gameYear: number; status: "scheduled" | "preparing" | "running" | "completed" | "cancelled";
    announcementAt: string; opensAt: string; startsAt: string; closedAt: string | null;
    currentPosition: number | null; deadline: string | null; participantCount: number; poolCount: number; version: number;
  };
  mine?: null | {
    teamId: string; position: number; status: SeasonDraftParticipant["status"]; preferences: string[];
    autoEnabled: boolean; reason: string | null; selectedRiderId: string | null;
  };
  finance?: null | { budget: number; rosterCount: number; rosterLimit: number; nonHomegrownCount: number; nonHomegrownLimit: number; salaryDiscountPercent: number; homegrownRiderIds: string[] };
  participants?: SeasonDraftParticipant[] | null;
  riders?: SeasonDraftRider[] | null;
};

export function draftSalary(rider: SeasonDraftRider, discountPercent = 0, homegrown = false) {
  const discounted = Math.round(rider.salaryPerSeason * (1 - discountPercent / 100) * 100) / 100;
  return Math.round(discounted / (homegrown && rider.abilities.includes("homegrown") ? 2 : 1) * 100) / 100;
}

export function draftRiderAverage(rider: SeasonDraftRider) {
  return RIDER_RATING_AXES.reduce((sum, axis) => sum + rider.ratings[axis.key], 0) / RIDER_RATING_AXES.length;
}

export function reorderDraftPreferences(ids: readonly string[], riderId: string, direction: -1 | 1) {
  const next = [...ids];
  const index = next.indexOf(riderId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function isDraftBannerVisible(view: SeasonDraftView) {
  const edition = view.edition;
  if (!edition || edition.status === "cancelled" || (!view.enabled && edition.status === "scheduled")) return false;
  const now = Date.parse(view.serverNow);
  const dayEnd = Date.parse(edition.startsAt) + 10 * 60 * 60 * 1000;
  return now >= Date.parse(edition.announcementAt) && (edition.status === "running" || now < dayEnd);
}

export function formatDraftDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function draftChoiceError(reason: string | null) {
  if (reason === "pool_empty") return "Vivier épuisé";
  if (reason === "timeout") return "Délai écoulé";
  if (reason === "voluntary") return "Tour passé volontairement";
  return "Tour passé";
}
