import "server-only";

import type {
  RecruitmentAlert,
  RecruitmentAlertOverview,
} from "@/lib/game/recruitment-alerts";
import type { RiderRatingKey } from "@/lib/game/rider-profile";
import type { StaffRole, TrainerSpecialty } from "@/lib/game/staff";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type RecruitmentAlertRow = {
  id: string;
  alert_type: "rider" | "staff";
  country_id: string | null;
  minimum_overall: number | null;
  rating_key: RiderRatingKey | null;
  minimum_rating: number | null;
  minimum_potential_steps: number | null;
  staff_role: StaffRole | null;
  minimum_staff_level: number | null;
  staff_trainer_specialty: TrainerSpecialty | null;
  created_at: string;
};

type CountryRow = {
  id: string;
  name: string;
  iso_alpha2: string;
};

export async function getCurrentDirectorRecruitmentAlertOverview(
  supabase: SupabaseServerClient,
): Promise<RecruitmentAlertOverview> {
  const [alertsResult, countriesResult] = await Promise.all([
    supabase
      .from("recruitment_alerts")
      .select(
        "id, alert_type, country_id, minimum_overall, rating_key, minimum_rating, minimum_potential_steps, staff_role, minimum_staff_level, staff_trainer_specialty, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<RecruitmentAlertRow[]>(),
    supabase
      .from("countries")
      .select("id, name, iso_alpha2")
      .eq("is_active", true)
      .order("name")
      .returns<CountryRow[]>(),
  ]);

  if (alertsResult.error) {
    throw new Error(
      `Impossible de charger les alertes de recrutement : ${alertsResult.error.message}`,
    );
  }

  if (countriesResult.error) {
    throw new Error(
      `Impossible de charger les nationalités : ${countriesResult.error.message}`,
    );
  }

  const countries = (countriesResult.data ?? []).map((country) => ({
    id: country.id,
    name: country.name,
    code: country.iso_alpha2,
  }));
  const countriesById = new Map(countries.map((country) => [country.id, country]));

  return {
    countries,
    alerts: (alertsResult.data ?? []).map((row): RecruitmentAlert => {
      const country = row.country_id
        ? countriesById.get(row.country_id) ?? null
        : null;

      return {
        id: row.id,
        type: row.alert_type,
        countryId: row.country_id,
        countryName: country?.name ?? null,
        countryCode: country?.code ?? null,
        minimumOverall: row.minimum_overall,
        ratingKey: row.rating_key,
        minimumRating: row.minimum_rating,
        minimumPotentialSteps: row.minimum_potential_steps,
        staffRole: row.staff_role,
        minimumStaffLevel: row.minimum_staff_level,
        staffTrainerSpecialty: row.staff_trainer_specialty,
        createdAt: row.created_at,
      };
    }),
  };
}
