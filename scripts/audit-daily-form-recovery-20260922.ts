/** Read-only audit of unexpectedly repeated daily rider-form recovery. */
/* eslint-disable @typescript-eslint/no-explicit-any -- production rows are inspected as schemaless snapshots. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({
  path:
    process.env.DAILY_FORM_AUDIT_ENV_FILE ?? "../cycling-manager/.env.local",
  quiet: true,
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Configuration Supabase absente.");

const db = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function rows(query: PromiseLike<any>, label: string): Promise<any[]> {
  const result = await query;
  if (result.error) throw new Error(`${label} : ${result.error.message}`);
  return result.data ?? [];
}

async function allRows(
  build: (from: number, to: number) => PromiseLike<any>,
  label: string,
) {
  const pageSize = 1_000;
  const result: any[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = await rows(build(from, from + pageSize - 1), label);
    result.push(...page);
    if (page.length < pageSize) return result;
  }
}

function minuteBucket(timestamp: string) {
  return timestamp.slice(0, 16);
}

function parisDate(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

function clampForm(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100) / 100));
}

async function main() {
  const allSeasons = await rows(
    db
      .from("seasons")
      .select("id,name,game_year,status,current_day_number")
      .order("game_year"),
    "saisons",
  );
  const seasons = allSeasons.filter((candidate) => candidate.status === "active");
  assert(seasons.length === 1, `Nombre de saisons actives inattendu : ${seasons.length}`);
  const season = seasons[0];
  const seasonById = new Map(allSeasons.map((candidate) => [candidate.id, candidate]));

  const seasonDays = await rows(
    db
      .from("season_days")
      .select("id,day_number,calendar_date")
      .eq("season_id", season.id)
      .order("day_number"),
    "jours de saison",
  );
  const dayById = new Map(seasonDays.map((day) => [day.id, day]));

  const [teamsByInternalName, teamsByAmateurName, teamSeasons] = await Promise.all([
    rows(
      db
        .from("teams")
        .select("id,internal_name,amateur_name")
        .ilike("internal_name", "%davidson%"),
      "équipes Davidson (nom interne)",
    ),
    rows(
      db
        .from("teams")
        .select("id,internal_name,amateur_name")
        .ilike("amateur_name", "%davidson%"),
      "équipes Davidson (nom amateur)",
    ),
    rows(
      db
        .from("team_seasons")
        .select("id,team_id,display_name,short_name")
        .eq("season_id", season.id)
        .ilike("display_name", "%davidson%"),
      "équipes Davidson (nom de saison)",
    ),
  ]);
  const davidsonTeams = [
    ...teamsByInternalName,
    ...teamsByAmateurName,
    ...teamSeasons.map((teamSeason) => ({
      id: teamSeason.team_id,
      internal_name: null,
      amateur_name: teamSeason.display_name,
    })),
  ].filter(
    (team, index, all) => all.findIndex((candidate) => candidate.id === team.id) === index,
  );
  assert(davidsonTeams.length > 0, "Aucune équipe Davidson trouvée.");
  const davidsonTeamIds = davidsonTeams.map((team) => team.id);

  const contracts = await allRows(
    (from, to) =>
      db
        .from("rider_contracts")
        .select(
          "id,rider_id,team_id,status,start_season_id,end_season_id,joined_day_number,left_season_id,left_day_number,signed_at,acquisition_type",
        )
        .order("id")
        .range(from, to),
    "contrats",
  );
  const contractCoversSeason = (contract: any) => {
    const start = seasonById.get(contract.start_season_id)?.game_year;
    const end = seasonById.get(contract.end_season_id)?.game_year;
    return (
      contract.status !== "planned" &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= season.game_year &&
      end >= season.game_year
    );
  };
  const activeSeasonContracts = contracts.filter(contractCoversSeason);
  const riderIds = [...new Set(activeSeasonContracts.map((contract) => contract.rider_id))];
  const riders = await allRows(
    (from, to) =>
      db
        .from("riders")
        .select("id,first_name,last_name,status")
        .eq("status", "active")
        .order("id")
        .range(from, to),
    "coureurs actifs",
  );
  const riderById = new Map(riders.map((rider) => [rider.id, rider]));
  const contractByRiderId = new Map(
    activeSeasonContracts
      .filter((contract) => contract.status === "active")
      .map((contract) => [contract.rider_id, contract]),
  );
  const contractsByRiderId = new Map<string, any[]>();
  for (const contract of activeSeasonContracts) {
    const riderContracts = contractsByRiderId.get(contract.rider_id) ?? [];
    riderContracts.push(contract);
    contractsByRiderId.set(contract.rider_id, riderContracts);
  }
  const hasContractCoverage = (riderId: string, dayNumber: number) =>
    (contractsByRiderId.get(riderId) ?? []).some((contract) => {
      const startYear = seasonById.get(contract.start_season_id)?.game_year;
      const leftYear = contract.left_season_id
        ? seasonById.get(contract.left_season_id)?.game_year
        : null;
      if (
        startYear === season.game_year &&
        dayNumber < Number(contract.joined_day_number ?? 1)
      ) {
        return false;
      }
      if (
        leftYear === season.game_year &&
        dayNumber > Number(contract.left_day_number ?? 28)
      ) {
        return false;
      }
      return true;
    });

  const dailyEffects = await allRows(
    (from, to) =>
      db
        .from("rider_daily_condition_effects")
        .select(
          "id,rider_id,season_day_id,effect_type,form_delta,form_before,form_after,applied_at,roster_rotation_bonus",
        )
        .in(
          "season_day_id",
          seasonDays.map((day) => day.id),
        )
        .order("applied_at")
        .order("id")
        .range(from, to),
    "effets quotidiens",
  );
  const conditionStates = await allRows(
    (from, to) =>
      db
        .from("rider_condition_states")
        .select("id,rider_id,season_day_id,form,fatigue,source,updated_at")
        .in(
          "season_day_id",
          seasonDays.map((day) => day.id),
        )
        .order("updated_at")
        .order("id")
        .range(from, to),
    "états de forme",
  );
  const nutritionEffects = await allRows(
    (from, to) =>
      db
        .from("rider_daily_nutrition_effects")
        .select(
          "id,rider_id,team_id,season_day_id,form_delta,form_before,form_after,applied_at,condition_applied_at,contributions",
        )
        .in(
          "season_day_id",
          seasonDays.map((day) => day.id),
        )
        .order("applied_at")
        .order("id")
        .range(from, to),
    "effets nutritionnels quotidiens",
  );
  const trainingSessions = await allRows(
    (from, to) =>
      db
        .from("rider_training_sessions")
        .select(
          "id,rider_id,team_id,season_day_id,status,intensity,form_delta,form_before,form_after,progress_milli,decline_milli,rating_changes,is_contract_eligible,processed_at",
        )
        .eq("season_id", season.id)
        .order("processed_at")
        .order("id")
        .range(from, to),
    "séances d’entraînement",
  );

  const [stageEffects, injuryEffects, nutritionInterventions, rotationRecoveries] =
    await Promise.all([
      allRows(
        (from, to) =>
          db
            .from("stage_rider_condition_effects")
            .select(
              "id,rider_id,season_day_id,form_delta,form_before,form_after,applied_at",
            )
            .in(
              "season_day_id",
              seasonDays.map((day) => day.id),
            )
            .order("id")
            .range(from, to),
        "effets de course",
      ),
      allRows(
        (from, to) =>
          db
            .from("rider_injury_form_effects")
            .select(
              "id,rider_id,season_day_id,form_delta,form_before,form_after,applied_at",
            )
            .in(
              "season_day_id",
              seasonDays.map((day) => day.id),
            )
            .order("id")
            .range(from, to),
        "effets de blessure",
      ),
      allRows(
        (from, to) =>
          db
            .from("rider_nutrition_interventions")
            .select(
              "id,rider_id,season_day_id,base_form_gain,level_form_bonus,actual_form_gain,form_before,form_after,applied_at",
            )
            .in(
              "season_day_id",
              seasonDays.map((day) => day.id),
            )
            .order("id")
            .range(from, to),
        "interventions nutritionnelles",
      ),
      allRows(
        (from, to) =>
          db
            .from("roster_management_rotation_recoveries")
            .select(
              "id,rider_id,source_season_day_id,target_season_day_id,form_gain,created_at",
            )
            .in(
              "target_season_day_id",
              seasonDays.map((day) => day.id),
            )
            .order("id")
            .range(from, to),
        "récupérations de rotation",
      ),
    ]);

  const [rewardInventory, rewardCatalog] = await Promise.all([
    allRows(
      (from, to) =>
        db
          .from("daily_reward_inventory")
          .select("id,reward_key,status,used_at,usage_payload")
          .eq("status", "used")
          .not("used_at", "is", null)
          .order("id")
          .range(from, to),
      "récompenses utilisées",
    ),
    rows(
      db
        .from("daily_reward_catalog")
        .select("reward_key,effect_kind,effect_payload"),
      "catalogue de récompenses",
    ),
  ]);

  const effectsByRider = new Map<string, any[]>();
  for (const effect of dailyEffects) {
    const effects = effectsByRider.get(effect.rider_id) ?? [];
    effects.push(effect);
    effectsByRider.set(effect.rider_id, effects);
  }

  const batchAnomalies = [...effectsByRider.entries()].flatMap(([riderId, effects]) => {
    const byMinute = new Map<string, any[]>();
    for (const effect of effects) {
      const bucket = minuteBucket(effect.applied_at);
      const bucketEffects = byMinute.get(bucket) ?? [];
      bucketEffects.push(effect);
      byMinute.set(bucket, bucketEffects);
    }
    return [...byMinute.entries()]
      .filter(([, bucketEffects]) => bucketEffects.length >= 3)
      .map(([minute, bucketEffects]) => {
        const contract = contractByRiderId.get(riderId);
        return {
          riderId,
          rider: riderById.get(riderId)
            ? `${riderById.get(riderId).first_name} ${riderById.get(riderId).last_name}`
            : riderId,
          teamId: contract?.team_id ?? null,
          joinedDay: contract?.joined_day_number ?? null,
          minute,
          count: bucketEffects.length,
          days: bucketEffects.map((effect) => dayById.get(effect.season_day_id)?.day_number),
          effects: bucketEffects.map((effect) => ({
            id: effect.id,
            day: dayById.get(effect.season_day_id)?.day_number,
            type: effect.effect_type,
            delta: Number(effect.form_delta),
            before: Number(effect.form_before),
            after: Number(effect.form_after),
            rotation: Number(effect.roster_rotation_bonus ?? 0),
          })),
        };
      });
  });

  const uncoveredDailyEffects = dailyEffects.flatMap((effect) => {
    const contract = contractByRiderId.get(effect.rider_id);
    const day = dayById.get(effect.season_day_id);
    if (!day || hasContractCoverage(effect.rider_id, day.day_number)) return [];
    return [
      {
        riderId: effect.rider_id,
        rider: riderById.get(effect.rider_id)
          ? `${riderById.get(effect.rider_id).first_name} ${riderById.get(effect.rider_id).last_name}`
          : effect.rider_id,
        teamId: contract.team_id,
        joinedDay: contract.joined_day_number,
        effectDay: day.day_number,
        effectId: effect.id,
        type: effect.effect_type,
        delta: Number(effect.form_delta),
        before: Number(effect.form_before),
        after: Number(effect.form_after),
        appliedAt: effect.applied_at,
      },
    ];
  });
  const uncoveredNutritionEffects = nutritionEffects.flatMap((effect) => {
    const contract = contractByRiderId.get(effect.rider_id);
    const day = dayById.get(effect.season_day_id);
    if (!day || hasContractCoverage(effect.rider_id, day.day_number)) return [];
    return [
      {
        riderId: effect.rider_id,
        rider: riderById.get(effect.rider_id)
          ? `${riderById.get(effect.rider_id).first_name} ${riderById.get(effect.rider_id).last_name}`
          : effect.rider_id,
        teamId: contract?.team_id ?? effect.team_id,
        joinedDay: contract?.joined_day_number ?? null,
        acquisitionType: contract?.acquisition_type ?? null,
        seasonContractCount:
          contractsByRiderId.get(effect.rider_id)?.length ?? 0,
        effectDay: day.day_number,
        effectId: effect.id,
        delta: Number(effect.form_delta),
        before: Number(effect.form_before),
        after: Number(effect.form_after),
        appliedAt: effect.applied_at,
        conditionAppliedAt: effect.condition_applied_at,
      },
    ];
  });
  const uncoveredTrainingSessions = trainingSessions.flatMap((session) => {
    const contract = contractByRiderId.get(session.rider_id);
    const day = dayById.get(session.season_day_id);
    if (!day || hasContractCoverage(session.rider_id, day.day_number)) return [];
    return [
      {
        riderId: session.rider_id,
        rider: riderById.get(session.rider_id)
          ? `${riderById.get(session.rider_id).first_name} ${riderById.get(session.rider_id).last_name}`
          : session.rider_id,
        teamId: contract?.team_id ?? session.team_id,
        joinedDay: contract?.joined_day_number ?? null,
        sessionDay: day.day_number,
        sessionId: session.id,
        status: session.status,
        intensity: Number(session.intensity),
        delta: Number(session.form_delta),
        before: Number(session.form_before),
        after: Number(session.form_after),
        progress: session.progress_milli,
        decline: session.decline_milli,
        ratingChanges: session.rating_changes,
        processedAt: session.processed_at,
      },
    ];
  });

  const davidsonRiderIds = new Set(
    activeSeasonContracts
      .filter((contract) => davidsonTeamIds.includes(contract.team_id))
      .map((contract) => contract.rider_id),
  );
  const davidson = [...davidsonRiderIds].map((riderId) => {
    const contract = contractByRiderId.get(riderId);
    return {
      riderId,
      rider: riderById.get(riderId)
        ? `${riderById.get(riderId).first_name} ${riderById.get(riderId).last_name}`
        : riderId,
      contract,
      effects: (effectsByRider.get(riderId) ?? []).map((effect) => ({
        id: effect.id,
        day: dayById.get(effect.season_day_id)?.day_number,
        type: effect.effect_type,
        delta: Number(effect.form_delta),
        before: Number(effect.form_before),
        after: Number(effect.form_after),
        rotation: Number(effect.roster_rotation_bonus ?? 0),
        appliedAt: effect.applied_at,
      })),
      states: conditionStates
        .filter((state) => state.rider_id === riderId)
        .map((state) => ({
          day: dayById.get(state.season_day_id)?.day_number,
          form: Number(state.form),
          fatigue: Number(state.fatigue),
          source: state.source,
          updatedAt: state.updated_at,
        })),
    };
  });

  const anomaliesByTeam = new Map<string, Set<string>>();
  for (const anomaly of [
    ...uncoveredDailyEffects,
    ...uncoveredNutritionEffects,
    ...uncoveredTrainingSessions,
  ]) {
    if (!anomaly.teamId) continue;
    const ids = anomaliesByTeam.get(anomaly.teamId) ?? new Set<string>();
    ids.add(anomaly.riderId);
    anomaliesByTeam.set(anomaly.teamId, ids);
  }

  const summarizeAffectedRiders = (teamFilter?: Set<string>) => {
    const riderIds = new Set(
      [...uncoveredDailyEffects, ...uncoveredNutritionEffects]
        .filter((row) => !teamFilter || teamFilter.has(row.riderId))
        .map((row) => row.riderId),
    );
    return [...riderIds].map((riderId) => {
      const contract = contractByRiderId.get(riderId);
      const daily = uncoveredDailyEffects.filter((row) => row.riderId === riderId);
      const nutrition = uncoveredNutritionEffects.filter(
        (row) => row.riderId === riderId,
      );
      const training = uncoveredTrainingSessions.filter(
        (row) => row.riderId === riderId,
      );
      const latestState = conditionStates
        .filter((state) => state.rider_id === riderId)
        .sort(
          (left, right) =>
            Number(dayById.get(right.season_day_id)?.day_number ?? 0) -
            Number(dayById.get(left.season_day_id)?.day_number ?? 0),
        )[0];
      return {
        riderId,
        rider: riderById.get(riderId)
          ? `${riderById.get(riderId).first_name} ${riderById.get(riderId).last_name}`
          : riderId,
        teamId: contract?.team_id ?? daily[0]?.teamId ?? nutrition[0]?.teamId,
        joinedDay: contract?.joined_day_number ?? null,
        acquisitionType: contract?.acquisition_type ?? null,
        seasonContractCount: contractsByRiderId.get(riderId)?.length ?? 0,
        currentForm: latestState ? Number(latestState.form) : null,
        invalidDailyCount: daily.length,
        invalidDailyGain: daily.reduce((sum, row) => sum + row.delta, 0),
        invalidNutritionCount: nutrition.length,
        invalidNutritionGain: nutrition.reduce((sum, row) => sum + row.delta, 0),
        invalidTrainingCount: training.length,
        invalidTrainingGain: training.reduce((sum, row) => sum + row.delta, 0),
        firstInvalidDay: Math.min(
          ...[...daily, ...nutrition].map((row) => row.effectDay),
          ...training.map((row) => row.sessionDay),
        ),
        lastInvalidDay: Math.max(
          ...[...daily, ...nutrition].map((row) => row.effectDay),
          ...training.map((row) => row.sessionDay),
        ),
      };
    });
  };

  const compactReport = {
    season,
    davidsonTeams,
    counts: {
      activeSeasonContracts: activeSeasonContracts.length,
      riders: riderIds.length,
      dailyEffects: dailyEffects.length,
      nutritionEffects: nutritionEffects.length,
      trainingSessions: trainingSessions.length,
      conditionStates: conditionStates.length,
      batchAnomalies: batchAnomalies.length,
      uncoveredDailyEffects: uncoveredDailyEffects.length,
      uncoveredNutritionEffects: uncoveredNutritionEffects.length,
      uncoveredTrainingSessions: uncoveredTrainingSessions.length,
      affectedTeams: anomaliesByTeam.size,
      affectedRiders: new Set(
        [
          ...uncoveredDailyEffects,
          ...uncoveredNutritionEffects,
          ...uncoveredTrainingSessions,
        ].map((row) => row.riderId),
      ).size,
    },
    davidsonAffectedRiders: summarizeAffectedRiders(davidsonRiderIds),
    allAffectedRiders: summarizeAffectedRiders(),
    affectedTeams: [...anomaliesByTeam.entries()].map(([teamId, ids]) => ({
      teamId,
      riders: ids.size,
    })),
  };
  const affectedRiderSummaries = summarizeAffectedRiders();
  const affectedRiderIds = new Set(
    affectedRiderSummaries.map((summary) => summary.riderId),
  );
  const afterFirstCoveredDay = (row: any, dayField = "season_day_id") => {
    if (!affectedRiderIds.has(row.rider_id)) return false;
    const dayNumber = dayById.get(row[dayField])?.day_number;
    const firstCoveredDay = Math.min(
      ...(contractsByRiderId.get(row.rider_id) ?? []).map((contract) =>
        seasonById.get(contract.start_season_id)?.game_year === season.game_year
          ? Number(contract.joined_day_number ?? 1)
          : 1,
      ),
    );
    return Number(dayNumber) >= firstCoveredDay;
  };
  const affectedPostJoinEvents = {
    daily: dailyEffects.filter(
      (row) =>
        afterFirstCoveredDay(row) &&
        hasContractCoverage(
          row.rider_id,
          Number(dayById.get(row.season_day_id)?.day_number),
        ),
    ),
    nutrition: nutritionEffects.filter(
      (row) =>
        afterFirstCoveredDay(row) &&
        hasContractCoverage(
          row.rider_id,
          Number(dayById.get(row.season_day_id)?.day_number),
        ),
    ),
    training: trainingSessions.filter(
      (row) => afterFirstCoveredDay(row) && row.is_contract_eligible !== false,
    ),
    stage: stageEffects.filter((row) => afterFirstCoveredDay(row)),
    injury: injuryEffects.filter((row) => afterFirstCoveredDay(row)),
    intervention: nutritionInterventions.filter((row) => afterFirstCoveredDay(row)),
    rotation: rotationRecoveries.filter(
      (row) =>
        affectedRiderIds.has(row.rider_id) &&
        afterFirstCoveredDay(
          { rider_id: row.rider_id, season_day_id: row.target_season_day_id },
        ),
    ),
  };
  const rewardByKey = new Map(
    rewardCatalog.map((reward) => [reward.reward_key, reward]),
  );
  const dayByCalendarDate = new Map(
    seasonDays.map((day) => [day.calendar_date, day]),
  );
  const formRewards = rewardInventory.flatMap((inventory) => {
    const riderId = inventory.usage_payload?.riderId;
    const reward = rewardByKey.get(inventory.reward_key);
    const day = inventory.used_at
      ? dayByCalendarDate.get(parisDate(inventory.used_at))
      : null;
    if (
      !riderId ||
      !affectedRiderIds.has(riderId) ||
      reward?.effect_kind !== "form_boost" ||
      !day
    ) {
      return [];
    }
    return [{
      id: inventory.id,
      rider_id: riderId,
      season_day_id: day.id,
      amount: Number(reward.effect_payload?.amount ?? 0),
      applied_at: inventory.used_at,
    }];
  });

  const replayedForms = affectedRiderSummaries.map((summary) => {
    const riderId = summary.riderId;
    const invalidSourceDays = [
      ...uncoveredDailyEffects
        .filter((row) => row.riderId === riderId)
        .map((row) => row.effectDay),
      ...uncoveredNutritionEffects
        .filter((row) => row.riderId === riderId)
        .map((row) => row.effectDay),
    ];
    const firstInvalidDay = Math.min(...invalidSourceDays);
    const coveredBeforeInvalid = seasonDays.some(
      (day) =>
        day.day_number < firstInvalidDay &&
        hasContractCoverage(riderId, day.day_number),
    );
    const startDay = seasonDays.find(
      (day) =>
        day.day_number >= firstInvalidDay &&
        hasContractCoverage(riderId, day.day_number),
    );
    assert(startDay, `Jour de reprise introuvable pour ${riderId}.`);
    const baselineState = conditionStates
      .filter(
        (state) =>
          state.rider_id === riderId &&
          dayById.get(state.season_day_id)?.day_number === firstInvalidDay,
      )
      .sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0];
    let form = coveredBeforeInvalid && baselineState
      ? Number(baselineState.form)
      : 75;
    const states: Array<{ day: number; form: number; events: string[] }> = [];

    for (
      let dayNumber = startDay.day_number;
      dayNumber <= Number(season.current_day_number);
      dayNumber += 1
    ) {
      if (!hasContractCoverage(riderId, dayNumber)) continue;
      const events: Array<{
        kind: string;
        at: string;
        delta: number;
      }> = [];
      const previousDay = seasonDays.find(
        (day) => day.day_number === dayNumber - 1,
      );
      if (
        previousDay &&
        hasContractCoverage(riderId, previousDay.day_number)
      ) {
        for (const effect of dailyEffects.filter(
          (row) =>
            row.rider_id === riderId &&
            row.season_day_id === previousDay.id &&
            row.effect_type !== "training",
        )) {
          events.push({
            kind: `daily:${effect.effect_type}`,
            at: `${seasonDays.find((day) => day.day_number === dayNumber)?.calendar_date}T00:00:00`,
            delta: Number(effect.form_delta),
          });
        }
        for (const effect of nutritionEffects.filter(
          (row) =>
            row.rider_id === riderId &&
            row.season_day_id === previousDay.id,
        )) {
          const potential = Array.isArray(effect.contributions)
            ? effect.contributions.reduce(
                (sum: number, contribution: any) =>
                  sum + Number(contribution.gain ?? 0),
                0,
              )
            : 0;
          events.push({
            kind: "daily:nutritionist",
            at: `${seasonDays.find((day) => day.day_number === dayNumber)?.calendar_date}T00:00:01`,
            delta: potential > 0 ? potential : Number(effect.form_delta),
          });
        }
      }
      for (const session of trainingSessions.filter(
        (row) =>
          row.rider_id === riderId &&
          row.season_day_id ===
            seasonDays.find((day) => day.day_number === dayNumber)?.id &&
          row.is_contract_eligible !== false,
      )) {
        events.push({
          kind: `training:${session.status}`,
          at: session.processed_at,
          delta: Number(session.form_delta),
        });
      }
      for (const effect of stageEffects.filter(
        (row) =>
          row.rider_id === riderId &&
          row.season_day_id ===
            seasonDays.find((day) => day.day_number === dayNumber)?.id,
      )) {
        events.push({
          kind: "race",
          at: effect.applied_at,
          delta: Number(effect.form_delta),
        });
      }
      for (const effect of injuryEffects.filter(
        (row) =>
          row.rider_id === riderId &&
          row.season_day_id ===
            seasonDays.find((day) => day.day_number === dayNumber)?.id,
      )) {
        events.push({
          kind: "injury",
          at: effect.applied_at,
          delta: Number(effect.form_delta),
        });
      }
      for (const intervention of nutritionInterventions.filter(
        (row) =>
          row.rider_id === riderId &&
          row.season_day_id ===
            seasonDays.find((day) => day.day_number === dayNumber)?.id,
      )) {
        events.push({
          kind: "nutrition",
          at: intervention.applied_at,
          delta:
            Number(intervention.base_form_gain) +
            Number(intervention.level_form_bonus),
        });
      }
      for (const reward of formRewards.filter(
        (row) =>
          row.rider_id === riderId &&
          row.season_day_id ===
            seasonDays.find((day) => day.day_number === dayNumber)?.id,
      )) {
        events.push({
          kind: "daily_reward",
          at: reward.applied_at,
          delta: reward.amount,
        });
      }
      events.sort((left, right) => left.at.localeCompare(right.at));
      for (const event of events) form = clampForm(form + event.delta);
      states.push({
        day: dayNumber,
        form,
        events: events.map((event) => `${event.kind}:${event.delta}`),
      });
    }
    return {
      riderId,
      rider: summary.rider,
      actualForm: summary.currentForm,
      expectedForm: form,
      adjustment:
        Math.round((form - Number(summary.currentForm)) * 100) / 100,
      repairStartsDay: startDay.day_number,
      baselineForm: coveredBeforeInvalid && baselineState
        ? Number(baselineState.form)
        : 75,
      states,
    };
  });
  const summaryOnlyReport = {
    season,
    davidsonTeams,
    counts: compactReport.counts,
    davidsonAffectedRiders: compactReport.davidsonAffectedRiders,
    acquisitionTypes: Object.fromEntries(
      [...new Set(affectedRiderSummaries.map((row) => row.acquisitionType))].map(
        (type) => [
          type ?? "unknown",
          affectedRiderSummaries.filter((row) => row.acquisitionType === type)
            .length,
        ],
      ),
    ),
    ridersWithMultipleSeasonContracts: affectedRiderSummaries.filter(
      (row) => row.seasonContractCount > 1,
    ).length,
    multipleSeasonContractRiders: affectedRiderSummaries
      .filter((row) => row.seasonContractCount > 1)
      .map((row) => ({
        ...row,
        contracts: contractsByRiderId.get(row.riderId),
      })),
    joinedDayCounts: Object.fromEntries(
      [...new Set(affectedRiderSummaries.map((row) => row.joinedDay))]
        .sort((left, right) => Number(left) - Number(right))
        .map((day) => [
          String(day),
          affectedRiderSummaries.filter((row) => row.joinedDay === day).length,
        ]),
    ),
    affectedPostJoinEventCounts: Object.fromEntries(
      Object.entries(affectedPostJoinEvents).map(([key, value]) => [
        key,
        value.length,
      ]),
    ),
    formRewardCount: formRewards.length,
    replay: {
      correctedRiders: replayedForms.filter(
        (row) => row.expectedForm !== row.actualForm,
      ).length,
      unchangedRiders: replayedForms.filter(
        (row) => row.expectedForm === row.actualForm,
      ).length,
      expectedFormRange: {
        min: Math.min(...replayedForms.map((row) => row.expectedForm)),
        max: Math.max(...replayedForms.map((row) => row.expectedForm)),
      },
      totalAdjustment: replayedForms.reduce(
        (sum, row) => sum + row.adjustment,
        0,
      ),
      davidson: replayedForms.filter((row) =>
        davidsonRiderIds.has(row.riderId),
      ),
      gapRiders: replayedForms.filter((row) =>
        affectedRiderSummaries.some(
          (candidate) =>
            candidate.riderId === row.riderId &&
            candidate.seasonContractCount > 1,
        ),
      ),
    },
  };

  const verboseReport = {
    ...compactReport,
    davidson,
    batchAnomalies,
    davidsonAnomalies: {
      daily: uncoveredDailyEffects.filter((row) =>
        davidsonRiderIds.has(row.riderId),
      ),
      nutrition: uncoveredNutritionEffects.filter((row) =>
        davidsonRiderIds.has(row.riderId),
      ),
    },
    uncoveredDailyEffects,
    uncoveredNutritionEffects,
    uncoveredTrainingSessions,
  };

  console.log(
    JSON.stringify(
      process.env.DAILY_FORM_AUDIT_VERBOSE === "1"
        ? verboseReport
        : process.env.DAILY_FORM_AUDIT_SUMMARY_ONLY === "1"
          ? summaryOnlyReport
          : compactReport,
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
