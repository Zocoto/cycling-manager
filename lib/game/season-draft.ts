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
  hasPreferences?: boolean;
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

export function canEditDraftPreferences(view: SeasonDraftView, now = Date.parse(view.serverNow)) {
  const { edition, mine } = view;
  if (!edition || mine?.status !== "pending") return false;
  if (edition.status === "preparing") return true;
  if (edition.status !== "running") return false;
  if (edition.currentPosition === null) return true;
  if (mine.position < edition.currentPosition) return false;
  if (mine.position > edition.currentPosition) return true;
  return !!edition.deadline && now < Date.parse(edition.deadline);
}

export type DraftPreparation = {
  editionId: string | null; teamId: string | null; preferences: string[]; autoEnabled: boolean;
};
export type DraftPreparationEditor = {
  saved: DraftPreparation; preferences: string[]; autoEnabled: boolean;
};

export function synchronizeDraftPreparation(current: DraftPreparationEditor, saved: DraftPreparation): DraftPreparationEditor {
  const changedParticipant = current.saved.editionId !== saved.editionId || current.saved.teamId !== saved.teamId;
  const changedPreferences = JSON.stringify(current.saved.preferences) !== JSON.stringify(saved.preferences)
    || current.saved.autoEnabled !== saved.autoEnabled;
  if (!changedParticipant && !changedPreferences) return current;
  const dirty = JSON.stringify(current.preferences) !== JSON.stringify(current.saved.preferences)
    || current.autoEnabled !== current.saved.autoEnabled;
  return {
    saved,
    preferences: changedParticipant || !dirty ? saved.preferences : current.preferences,
    autoEnabled: changedParticipant || !dirty ? saved.autoEnabled : current.autoEnabled,
  };
}

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

const draftBannerDayFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
});
const draftBannerOffsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Paris", timeZoneName: "longOffset",
});

export function draftBannerExpiresAt(startsAt: string) {
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return NaN;
  const parts = Object.fromEntries(draftBannerDayFormatter.formatToParts(start).map(part => [part.type, part.value]));
  const nextDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1);
  // Paris changes its clock after local midnight, so this offset is also the
  // offset at the beginning of that date, including both DST transition days.
  const offset = draftBannerOffsetFormatter.formatToParts(nextDay).find(part => part.type === "timeZoneName")!.value.replace("GMT", "");
  return Date.parse(new Date(nextDay).toISOString().slice(0, 10) + "T00:00:00" + offset);
}

export function isDraftBannerVisible(view: SeasonDraftView) {
  const edition = view.edition;
  if (!edition || edition.status === "cancelled" || (!view.enabled && edition.status === "scheduled")) return false;
  const now = Date.parse(view.serverNow);
  const startsAt = Date.parse(edition.startsAt);
  if (!Number.isFinite(now) || !Number.isFinite(startsAt)) return false;
  // A delayed draft must not keep its dashboard announcement past J1.
  return draftBannerDayFormatter.format(now) === draftBannerDayFormatter.format(startsAt);
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

/** Presentation only: use the authoritative queue without advancing a turn. */
export function getSeasonDraftProgress(view: SeasonDraftView) {
  const edition = view.edition;
  const participants = [...(view.participants ?? [])].sort((a, b) => a.position - b.position);
  const byRiderId = new Map((view.riders ?? []).map(rider => [rider.id, `${rider.firstName} ${rider.lastName}`]));
  const selectedNames = new Map(participants.filter(p => p.status === "picked").map(p => [p.teamId,
    p.selectedName?.trim() || (p.selectedRiderId ? byRiderId.get(p.selectedRiderId) : null) || "Coureur sélectionné",
  ]));
  const resolved = participants.filter(p => p.status !== "pending");
  const current = edition?.status === "running"
    ? participants.find(p => p.position === edition.currentPosition && p.status === "pending") ?? null : null;
  const nextPosition = edition && ["preparing", "running"].includes(edition.status)
    ? participants.find(p => p.status === "pending" && (edition.currentPosition === null || p.position >= edition.currentPosition))?.position ?? null : null;
  const mine = view.mine;
  const canCountAhead = edition && ["preparing", "running"].includes(edition.status) && mine?.status === "pending"
    && participants.length === edition.participantCount && (edition.currentPosition === null || edition.currentPosition <= mine.position);
  const ahead = canCountAhead ? participants.filter(p => p.status === "pending" && p.position < mine.position
    && (edition.currentPosition === null || p.position >= edition.currentPosition)).length : null;
  return {current, nextPosition, ahead, resolvedCount: resolved.length, selectedNames,
    recentChoices: resolved.slice(-6).reverse()};
}
