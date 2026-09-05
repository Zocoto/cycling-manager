import "server-only";

import type { RiderComparisonOption } from "@/lib/game/rider-comparison";
import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ComparisonRosterRow = {
  rider_id: string;
  first_name: string;
  last_name: string;
  country_name: string;
  country_iso_alpha2: string;
  age: number | null;
};

export async function getCurrentTeamRiderComparisonOptions(
  supabase: ServerClient,
): Promise<RiderComparisonOption[]> {
  const { data, error } = await supabase.rpc(
    "get_current_team_roster_with_potential",
  );

  if (error) {
    throw new Error(
      `Impossible de charger les coureurs à comparer : ${error.message}`,
    );
  }

  return ((data ?? []) as ComparisonRosterRow[])
    .map((rider) => ({
      id: rider.rider_id,
      firstName: rider.first_name,
      lastName: rider.last_name,
      countryCode: rider.country_iso_alpha2,
      countryName: rider.country_name,
      age: rider.age,
    }))
    .sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName, "fr") ||
        left.firstName.localeCompare(right.firstName, "fr") ||
        left.id.localeCompare(right.id),
    );
}
