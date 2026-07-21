import "server-only";

import {
  FORM_CAMP_TYPES,
  RIDER_INJURY_DIAGNOSES,
  type FormCampType,
  type MedicalProtocolCode,
  type RiderInjuryDiagnosisCode,
} from "@/lib/game/health-center";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type DirectorRow = { id: string };
type AssignmentRow = { team_id: string };
type SeasonRow = {
  id: string;
  name: string;
  game_year: number;
  current_day_number: number | null;
};
type TeamSeasonRow = {
  id: string;
  team_id: string;
  display_name: string;
  cash_balance: number | string;
  currency: string;
};
type ContractRow = { rider_id: string };
type RiderRow = {
  id: string;
  country_id: string;
  first_name: string;
  last_name: string;
  avatar_profile_key: string;
  avatar_seed: number | string;
};
type CountryRow = { id: string; name: string; iso_alpha2: string };
type RatingRow = { rider_id: string; age: number };
type SeasonDayRow = { id: string; day_number: number };
type ConditionRow = {
  rider_id: string;
  season_day_id: string;
  form: number;
  fatigue: number;
};
type InjuryRow = {
  id: string;
  rider_id: string;
  diagnosis_code: string;
  recovery_hours: number;
  started_at: string;
  base_expected_recovery_at: string;
  expected_recovery_at: string;
  form_loss_per_day: number;
  protocol_code: string | null;
  status: string;
};
type TreatmentRow = {
  rider_injury_id: string;
  protocol_code: string;
  price_paid: number | string;
  recovery_hours_reduced: number;
  applied_at: string;
};
type CampRow = {
  id: string;
  rider_id: string;
  camp_type: FormCampType;
  start_day_number: number;
  end_day_number: number;
  form_gain_per_day: number;
  price_per_day: number | string;
  total_price: number | string;
  status: "planned" | "active" | "completed" | "cancelled";
};
type ProtocolRow = {
  code: MedicalProtocolCode;
  name: string;
  description: string;
  price: number | string;
  duration_reduction_pct: number;
  form_loss_per_day: number;
};

export type RiderMedicalInjury = {
  id: string;
  diagnosisCode: string;
  label: string;
  recoveryHours: number;
  startedAt: string;
  baseExpectedRecoveryAt: string;
  expectedRecoveryAt: string;
  formLossPerDay: number;
  protocolCode: string | null;
  treatment: {
    protocolCode: string;
    pricePaid: number;
    recoveryHoursReduced: number;
    appliedAt: string;
  } | null;
};

export type RiderFormCamp = {
  id: string;
  type: FormCampType;
  label: string;
  startDay: number;
  endDay: number;
  formGainPerDay: number;
  pricePerDay: number;
  totalPrice: number;
  status: CampRow["status"];
};

export type TeamHealthRider = {
  id: string;
  firstName: string;
  lastName: string;
  countryName: string;
  countryCode: string;
  avatarProfileKey: string;
  avatarSeed: number | string;
  age: number;
  form: number;
  fatigue: number;
  injury: RiderMedicalInjury | null;
  formCamp: RiderFormCamp | null;
};

export type TeamMedicalProtocol = {
  code: MedicalProtocolCode;
  name: string;
  description: string;
  price: number;
  durationReductionPct: number;
  formLossPerDay: number;
};

export type TeamHealthOverview = {
  teamId: string;
  teamSeasonId: string;
  teamName: string;
  seasonName: string;
  currentDayNumber: number;
  balance: number;
  currency: string;
  riders: TeamHealthRider[];
  protocols: TeamMedicalProtocol[];
};

export async function getCurrentTeamHealthOverview(
  authUserId: string
): Promise<TeamHealthOverview | null> {
  const admin = createSupabaseAdminClient();
  const { error: settlementError } = await admin.rpc(
    "settle_current_health_and_form"
  );
  assertQuery(settlementError, "la mise à jour quotidienne de la forme");

  const { data: director, error: directorError } = await admin
    .from("sporting_directors")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("status", "active")
    .maybeSingle<DirectorRow>();
  assertQuery(directorError, "le Directeur Sportif");
  if (!director) return null;

  const [assignmentResult, seasonResult] = await Promise.all([
    admin
      .from("team_manager_assignments")
      .select("team_id")
      .eq("sporting_director_id", director.id)
      .eq("role", "general_manager")
      .eq("status", "active")
      .maybeSingle<AssignmentRow>(),
    admin
      .from("seasons")
      .select("id, name, game_year, current_day_number")
      .eq("status", "active")
      .maybeSingle<SeasonRow>(),
  ]);
  assertQuery(assignmentResult.error, "l’affectation à l’équipe");
  assertQuery(seasonResult.error, "la saison active");
  const assignment = assignmentResult.data;
  const season = seasonResult.data;
  if (!assignment || !season) return null;

  const [teamSeasonResult, contractsResult, protocolsResult] =
    await Promise.all([
      admin
        .from("team_seasons")
        .select("id, team_id, display_name, cash_balance, currency")
        .eq("team_id", assignment.team_id)
        .eq("season_id", season.id)
        .maybeSingle<TeamSeasonRow>(),
      admin
        .from("rider_contracts")
        .select("rider_id")
        .eq("team_id", assignment.team_id)
        .eq("status", "active")
        .returns<ContractRow[]>(),
      admin
        .from("medical_protocol_catalog")
        .select(
          "code, name, description, price, duration_reduction_pct, form_loss_per_day"
        )
        .eq("is_active", true)
        .order("price")
        .returns<ProtocolRow[]>(),
    ]);
  assertQuery(teamSeasonResult.error, "la saison de l’équipe");
  assertQuery(contractsResult.error, "l’effectif");
  assertQuery(protocolsResult.error, "les protocoles médicaux");
  const teamSeason = teamSeasonResult.data;
  if (!teamSeason) return null;

  const riderIds = (contractsResult.data ?? []).map((row) => row.rider_id);
  if (riderIds.length === 0) {
    return {
      teamId: teamSeason.team_id,
      teamSeasonId: teamSeason.id,
      teamName: teamSeason.display_name,
      seasonName: season.name,
      currentDayNumber: season.current_day_number ?? 1,
      balance: toNumber(teamSeason.cash_balance),
      currency: teamSeason.currency,
      riders: [],
      protocols: mapProtocols(protocolsResult.data ?? []),
    };
  }

  const [
    ridersResult,
    ratingsResult,
    daysResult,
    injuriesResult,
    campsResult,
  ] = await Promise.all([
    admin
      .from("riders")
      .select(
        "id, country_id, first_name, last_name, avatar_profile_key, avatar_seed"
      )
      .in("id", riderIds)
      .returns<RiderRow[]>(),
    admin
      .from("rider_season_ratings")
      .select("rider_id, age")
      .eq("season_id", season.id)
      .in("rider_id", riderIds)
      .returns<RatingRow[]>(),
    admin
      .from("season_days")
      .select("id, day_number")
      .eq("season_id", season.id)
      .lte("day_number", season.current_day_number ?? 1)
      .order("day_number", { ascending: false })
      .returns<SeasonDayRow[]>(),
    admin
      .from("rider_injuries")
      .select(
        "id, rider_id, diagnosis_code, recovery_hours, started_at, base_expected_recovery_at, expected_recovery_at, form_loss_per_day, protocol_code, status"
      )
      .in("rider_id", riderIds)
      .eq("status", "active")
      .gt("expected_recovery_at", new Date().toISOString())
      .order("expected_recovery_at")
      .returns<InjuryRow[]>(),
    admin
      .from("rider_form_camps")
      .select(
        "id, rider_id, camp_type, start_day_number, end_day_number, form_gain_per_day, price_per_day, total_price, status"
      )
      .eq("season_id", season.id)
      .in("rider_id", riderIds)
      .in("status", ["planned", "active"])
      .order("start_day_number")
      .returns<CampRow[]>(),
  ]);
  assertQuery(ridersResult.error, "les coureurs");
  assertQuery(ratingsResult.error, "l’âge des coureurs");
  assertQuery(daysResult.error, "les journées de saison");
  assertQuery(injuriesResult.error, "les blessures");
  assertQuery(campsResult.error, "les stages de forme");

  const riders = ridersResult.data ?? [];
  const countryIds = [...new Set(riders.map((rider) => rider.country_id))];
  const injuryIds = (injuriesResult.data ?? []).map((injury) => injury.id);
  const dayIds = (daysResult.data ?? []).map((day) => day.id);
  const [countriesResult, conditionsResult, treatmentsResult] =
    await Promise.all([
      admin
        .from("countries")
        .select("id, name, iso_alpha2")
        .in("id", countryIds)
        .returns<CountryRow[]>(),
      dayIds.length
        ? admin
            .from("rider_condition_states")
            .select("rider_id, season_day_id, form, fatigue")
            .in("rider_id", riderIds)
            .in("season_day_id", dayIds)
            .returns<ConditionRow[]>()
        : Promise.resolve({ data: [] as ConditionRow[], error: null }),
      injuryIds.length
        ? admin
            .from("rider_injury_treatments")
            .select(
              "rider_injury_id, protocol_code, price_paid, recovery_hours_reduced, applied_at"
            )
            .in("rider_injury_id", injuryIds)
            .returns<TreatmentRow[]>()
        : Promise.resolve({ data: [] as TreatmentRow[], error: null }),
    ]);
  assertQuery(countriesResult.error, "les pays des coureurs");
  assertQuery(conditionsResult.error, "la forme des coureurs");
  assertQuery(treatmentsResult.error, "les soins appliqués");

  const countryById = new Map(
    (countriesResult.data ?? []).map((country) => [country.id, country])
  );
  const ratingByRiderId = new Map(
    (ratingsResult.data ?? []).map((rating) => [rating.rider_id, rating])
  );
  const dayRank = new Map(
    (daysResult.data ?? []).map((day) => [day.id, day.day_number])
  );
  const conditionByRiderId = new Map<string, ConditionRow>();
  for (const condition of conditionsResult.data ?? []) {
    const current = conditionByRiderId.get(condition.rider_id);
    if (
      !current ||
      (dayRank.get(condition.season_day_id) ?? 0) >
        (dayRank.get(current.season_day_id) ?? 0)
    ) {
      conditionByRiderId.set(condition.rider_id, condition);
    }
  }
  const treatmentByInjuryId = new Map(
    (treatmentsResult.data ?? []).map((treatment) => [
      treatment.rider_injury_id,
      treatment,
    ])
  );
  const injuryByRiderId = new Map(
    (injuriesResult.data ?? []).map((injury) => [injury.rider_id, injury])
  );
  const campByRiderId = new Map(
    (campsResult.data ?? []).map((camp) => [camp.rider_id, camp])
  );

  return {
    teamId: teamSeason.team_id,
    teamSeasonId: teamSeason.id,
    teamName: teamSeason.display_name,
    seasonName: season.name,
    currentDayNumber: season.current_day_number ?? 1,
    balance: toNumber(teamSeason.cash_balance),
    currency: teamSeason.currency,
    protocols: mapProtocols(protocolsResult.data ?? []),
    riders: riders
      .map((rider) => {
        const country = countryById.get(rider.country_id);
        const condition = conditionByRiderId.get(rider.id);
        const injury = injuryByRiderId.get(rider.id);
        const treatment = injury
          ? treatmentByInjuryId.get(injury.id)
          : undefined;
        const camp = campByRiderId.get(rider.id);

        return {
          id: rider.id,
          firstName: rider.first_name,
          lastName: rider.last_name,
          countryName: country?.name ?? "Pays inconnu",
          countryCode: country?.iso_alpha2 ?? "xx",
          avatarProfileKey: rider.avatar_profile_key,
          avatarSeed: rider.avatar_seed,
          age: ratingByRiderId.get(rider.id)?.age ?? 25,
          form: condition?.form ?? 75,
          fatigue: condition?.fatigue ?? 0,
          injury: injury
            ? {
                id: injury.id,
                diagnosisCode: injury.diagnosis_code,
                label: getInjuryLabel(injury.diagnosis_code),
                recoveryHours: injury.recovery_hours,
                startedAt: injury.started_at,
                baseExpectedRecoveryAt: injury.base_expected_recovery_at,
                expectedRecoveryAt: injury.expected_recovery_at,
                formLossPerDay: injury.form_loss_per_day,
                protocolCode: injury.protocol_code,
                treatment: treatment
                  ? {
                      protocolCode: treatment.protocol_code,
                      pricePaid: toNumber(treatment.price_paid),
                      recoveryHoursReduced:
                        treatment.recovery_hours_reduced,
                      appliedAt: treatment.applied_at,
                    }
                  : null,
              }
            : null,
          formCamp: camp
            ? {
                id: camp.id,
                type: camp.camp_type,
                label: FORM_CAMP_TYPES[camp.camp_type].label,
                startDay: camp.start_day_number,
                endDay: camp.end_day_number,
                formGainPerDay: camp.form_gain_per_day,
                pricePerDay: toNumber(camp.price_per_day),
                totalPrice: toNumber(camp.total_price),
                status: camp.status,
              }
            : null,
        } satisfies TeamHealthRider;
      })
      .sort(
        (left, right) =>
          Number(Boolean(right.injury)) - Number(Boolean(left.injury)) ||
          left.lastName.localeCompare(right.lastName, "fr") ||
          left.firstName.localeCompare(right.firstName, "fr")
      ),
  };
}

export function getInjuryLabel(diagnosisCode: string) {
  if (diagnosisCode in RIDER_INJURY_DIAGNOSES) {
    return RIDER_INJURY_DIAGNOSES[
      diagnosisCode as RiderInjuryDiagnosisCode
    ].label;
  }

  return "Blessure en cours";
}

function mapProtocols(rows: ProtocolRow[]): TeamMedicalProtocol[] {
  return rows.map((protocol) => ({
    code: protocol.code,
    name: protocol.name,
    description: protocol.description,
    price: toNumber(protocol.price),
    durationReductionPct: protocol.duration_reduction_pct,
    formLossPerDay: protocol.form_loss_per_day,
  }));
}

function toNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function assertQuery(
  error: { message: string } | null,
  resourceName: string
): asserts error is null {
  if (error) {
    throw new Error(`Impossible de charger ${resourceName} : ${error.message}`);
  }
}
