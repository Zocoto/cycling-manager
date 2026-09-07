import "server-only";

import {
  isRaceTacticalDoctrineCode,
  type RaceTacticalBriefing,
  type RaceTacticalReport,
} from "@/lib/game/race-tactics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type TacticalBriefingRow = {
  stage_id: string;
  team_id: string;
  primary_doctrine: string;
  primary_rider_ids: string[] | null;
  backup_doctrine: string | null;
  backup_rider_ids: string[] | null;
  center_level_snapshot: number;
  updated_at: string;
  tactical_report: unknown;
};

export type RaceTacticalPreparationPlan = RaceTacticalBriefing & {
  updatedAt: string;
  report: RaceTacticalReport | null;
};

export type TeamRaceTacticalPreparation = {
  centerLevel: number;
  briefingsByStageId: Record<string, RaceTacticalPreparationPlan>;
};

export async function getTeamRaceTacticalPreparation(
  teamId: string,
): Promise<TeamRaceTacticalPreparation> {
  const admin = createSupabaseAdminClient();
  const [infrastructureResult, briefingsResult] = await Promise.all([
    admin
      .from("team_infrastructures")
      .select("level")
      .eq("team_id", teamId)
      .eq("infrastructure_code", "tactical_center")
      .maybeSingle<{ level: number }>(),
    admin.rpc("get_team_race_tactical_briefings", {
      p_team_id: teamId,
    }),
  ]);

  if (infrastructureResult.error) {
    throw new Error(
      `Impossible de charger le Centre tactique : ${infrastructureResult.error.message}`,
    );
  }
  if (briefingsResult.error) {
    throw new Error(
      `Impossible de charger les briefings tactiques : ${briefingsResult.error.message}`,
    );
  }

  const briefingsByStageId: Record<string, RaceTacticalPreparationPlan> = {};
  for (const row of (briefingsResult.data as TacticalBriefingRow[] | null) ?? []) {
    if (!isRaceTacticalDoctrineCode(row.primary_doctrine)) continue;
    const backupDoctrine = isRaceTacticalDoctrineCode(row.backup_doctrine)
      ? row.backup_doctrine
      : null;

    briefingsByStageId[row.stage_id] = {
      teamId: row.team_id,
      primaryDoctrine: row.primary_doctrine,
      primaryRiderIds: row.primary_rider_ids ?? [],
      backupDoctrine,
      backupRiderIds: backupDoctrine ? (row.backup_rider_ids ?? []) : [],
      centerLevel: Number(row.center_level_snapshot),
      updatedAt: row.updated_at,
      report: parseTacticalReport(row.tactical_report),
    };
  }

  return {
    centerLevel: Number(infrastructureResult.data?.level ?? 0),
    briefingsByStageId,
  };
}

function parseTacticalReport(value: unknown): RaceTacticalReport | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const report = value as Record<string, unknown>;
  const requestedDoctrine = report.requestedDoctrine;
  const appliedDoctrine = report.appliedDoctrine;
  const source = report.source;
  const impacts = report.impacts;
  const energyCosts = report.energyCosts;

  if (
    typeof report.teamId !== "string" ||
    !isRaceTacticalDoctrineCode(requestedDoctrine) ||
    (appliedDoctrine !== null &&
      !isRaceTacticalDoctrineCode(appliedDoctrine)) ||
    (source !== "primary" && source !== "backup" && source !== "none") ||
    typeof report.triggered !== "boolean" ||
    typeof report.summary !== "string" ||
    !Array.isArray(impacts) ||
    !impacts.every((impact) => typeof impact === "string") ||
    !Array.isArray(energyCosts)
  ) {
    return null;
  }

  const parsedEnergyCosts = energyCosts.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    return typeof candidate.riderId === "string" &&
      typeof candidate.percentage === "number"
      ? [{ riderId: candidate.riderId, percentage: candidate.percentage }]
      : [];
  });

  return {
    teamId: report.teamId,
    requestedDoctrine,
    appliedDoctrine,
    source,
    triggered: report.triggered,
    summary: report.summary,
    impacts,
    energyCosts: parsedEnergyCosts,
  };
}
