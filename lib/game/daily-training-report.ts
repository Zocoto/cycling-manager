import {
  RIDER_RATING_AXES,
  type RiderRatingKey,
} from "@/lib/game/rider-profile";
import type { TrainingSessionStatus } from "@/lib/game/training";

export type DailyTrainingAudience = "senior" | "junior";

export type DailyTrainingStatChange = {
  statCode: RiderRatingKey;
  shortLabel: string;
  label: string;
  value: number;
};

export type DailyTrainingRiderReport = {
  riderId: string;
  firstName: string;
  lastName: string;
  sessionCount: number;
  status: TrainingSessionStatus | "not_recorded" | "junior_completed";
  trainingModes: string[];
  statChanges: DailyTrainingStatChange[];
  formBefore: number | null;
  formDelta: number | null;
  formAfter: number | null;
};

export type DailyTrainingReport = {
  audience: DailyTrainingAudience;
  teamName: string;
  seasonName: string;
  dayNumber: number;
  currentDayNumber: number;
  calendarDate: string;
  riders: DailyTrainingRiderReport[];
  sessionCount: number;
  completedRiderCount: number;
  progressedRiderCount: number;
  totalPositiveChange: number;
};

export type TrainingReportRiderSource = {
  id: string;
  firstName: string;
  lastName: string;
};

export type SeniorTrainingSessionSource = {
  riderId: string;
  status: TrainingSessionStatus;
  ratingChanges: Record<string, number>;
  formBefore: number;
  formDelta: number;
  formAfter: number;
};

export type JuniorTrainingSessionSource = {
  riderId: string;
  trainingMode: string;
  slot: string;
  gameType: string | null;
  ratingChanges: Record<string, number>;
};

const SENIOR_STAT_KEY_MAP: Record<string, RiderRatingKey> = {
  mountain: "mountain",
  hills: "hills",
  flat: "flat",
  time_trial: "timeTrial",
  timeTrial: "timeTrial",
  cobbles: "cobbles",
  sprint: "sprint",
  acceleration: "acceleration",
  downhill: "downhill",
  endurance: "endurance",
  resistance: "resistance",
  recovery: "recovery",
  breakaway: "breakaway",
  prologue: "prologue",
};

export function resolveTrainingReportDay(
  requestedDay: string | string[] | undefined,
  currentDayNumber: number,
): number {
  const rawValue = Array.isArray(requestedDay) ? requestedDay[0] : requestedDay;
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed)) return currentDayNumber;
  return Math.min(currentDayNumber, Math.max(1, parsed));
}

export function buildSeniorDailyTrainingRiders({
  riders,
  sessions,
}: {
  riders: TrainingReportRiderSource[];
  sessions: SeniorTrainingSessionSource[];
}): DailyTrainingRiderReport[] {
  const sessionByRiderId = new Map(
    sessions.map((session) => [session.riderId, session]),
  );

  return riders
    .map((rider): DailyTrainingRiderReport => {
      const session = sessionByRiderId.get(rider.id);
      return {
        riderId: rider.id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        sessionCount: session ? 1 : 0,
        status: session?.status ?? "not_recorded",
        trainingModes: [],
        statChanges: toStatChanges(session?.ratingChanges ?? {}, 1),
        formBefore: session?.formBefore ?? null,
        formDelta: session?.formDelta ?? null,
        formAfter: session?.formAfter ?? null,
      };
    })
    .sort(compareRiderNames);
}

export function buildJuniorDailyTrainingRiders({
  riders,
  sessions,
}: {
  riders: TrainingReportRiderSource[];
  sessions: JuniorTrainingSessionSource[];
}): DailyTrainingRiderReport[] {
  const sessionsByRiderId = new Map<string, JuniorTrainingSessionSource[]>();
  for (const session of sessions) {
    sessionsByRiderId.set(session.riderId, [
      ...(sessionsByRiderId.get(session.riderId) ?? []),
      session,
    ]);
  }

  return riders
    .map((rider): DailyTrainingRiderReport => {
      const riderSessions = sessionsByRiderId.get(rider.id) ?? [];
      const rawChanges = riderSessions.reduce<Record<string, number>>(
        (total, session) => {
          for (const [key, value] of Object.entries(session.ratingChanges ?? {})) {
            total[key] = (total[key] ?? 0) + Number(value);
          }
          return total;
        },
        {},
      );

      return {
        riderId: rider.id,
        firstName: rider.firstName,
        lastName: rider.lastName,
        sessionCount: riderSessions.length,
        status: riderSessions.length ? "junior_completed" : "not_recorded",
        trainingModes: riderSessions.map(formatJuniorTrainingMode),
        statChanges: toStatChanges(rawChanges, 8),
        formBefore: null,
        formDelta: null,
        formAfter: null,
      };
    })
    .sort(compareRiderNames);
}

export function summarizeDailyTrainingReport(
  riders: DailyTrainingRiderReport[],
) {
  return {
    sessionCount: riders.reduce((total, rider) => total + rider.sessionCount, 0),
    completedRiderCount: riders.filter(
      (rider) => rider.status === "completed" || rider.status === "junior_completed",
    ).length,
    progressedRiderCount: riders.filter((rider) =>
      rider.statChanges.some((change) => change.value > 0),
    ).length,
    totalPositiveChange: roundChange(
      riders.reduce(
        (total, rider) =>
          total +
          rider.statChanges.reduce(
            (riderTotal, change) =>
              riderTotal + Math.max(0, change.value),
            0,
          ),
        0,
      ),
    ),
  };
}

export function formatDailyTrainingRiderSentence(
  rider: DailyTrainingRiderReport,
): string {
  const changes = rider.statChanges
    .map(
      (change) =>
        `${change.shortLabel} ${change.value > 0 ? "+" : ""}${formatTrainingChange(change.value)}`,
    )
    .join(" · ");

  if (rider.status === "not_recorded") {
    return "Aucun rapport enregistré pour cette journée.";
  }

  if (rider.status === "junior_completed") {
    const sessions = `${rider.sessionCount} séance${rider.sessionCount > 1 ? "s" : ""}`;
    const modes = rider.trainingModes.length
      ? ` (${rider.trainingModes.join(", ")})`
      : "";
    return `${sessions}${modes} · ${changes || "aucun gain de caractéristique"}.`;
  }

  const form =
    rider.formBefore !== null && rider.formAfter !== null
      ? ` · forme ${rider.formBefore} → ${rider.formAfter}${
          rider.formDelta
            ? ` (${rider.formDelta > 0 ? "+" : ""}${rider.formDelta})`
            : ""
        }`
      : "";

  if (rider.status === "completed") {
    return `Séance effectuée · ${changes || "aucune note entière gagnée"}${form}.`;
  }

  return `${getSkippedReason(rider.status)}${form}.`;
}

export function formatTrainingChange(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 3,
  }).format(value);
}

function toStatChanges(
  rawChanges: Record<string, number>,
  scale: number,
): DailyTrainingStatChange[] {
  const totals = new Map<RiderRatingKey, number>();
  for (const [rawKey, rawValue] of Object.entries(rawChanges ?? {})) {
    const key = SENIOR_STAT_KEY_MAP[rawKey];
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + Number(rawValue) * scale);
  }

  return RIDER_RATING_AXES.flatMap((axis): DailyTrainingStatChange[] => {
    const value = roundChange(totals.get(axis.key) ?? 0);
    if (value === 0) return [];
    return [
      {
        statCode: axis.key,
        shortLabel: axis.shortLabel,
        label: axis.label,
        value,
      },
    ];
  });
}

function formatJuniorTrainingMode(session: JuniorTrainingSessionSource): string {
  if (session.trainingMode === "automatic") return "automatique";
  if (session.slot === "manual_am") return "manuel matin";
  if (session.slot === "manual_pm") return "manuel après-midi";
  return "manuel";
}

function getSkippedReason(status: TrainingSessionStatus): string {
  switch (status) {
    case "skipped_low_form":
      return "Repos : forme sous le seuil de l’équipe";
    case "skipped_injury":
      return "Séance suspendue : coureur blessé";
    case "skipped_form_camp":
      return "Séance suspendue : stage de remise en forme";
    case "skipped_reconnaissance":
      return "Séance suspendue : reconnaissance de course";
    default:
      return "Séance effectuée";
  }
}

function compareRiderNames(
  left: DailyTrainingRiderReport,
  right: DailyTrainingRiderReport,
) {
  return `${left.lastName} ${left.firstName}`.localeCompare(
    `${right.lastName} ${right.firstName}`,
    "fr",
  );
}

function roundChange(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
