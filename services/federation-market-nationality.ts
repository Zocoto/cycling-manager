import "server-only";

import {
  getRaceOrganizationOfficeEffects,
} from "@/lib/game/federation-infrastructure-effects";
import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type InfrastructureRow = { country_id: string; level: number };
type SpecializationRow = {
  country_id: string;
  active_specialization_code: string;
};

export async function loadFederationMarketNationalityWeights(
  admin: AdminClient,
): Promise<Map<string, number>> {
  const [infrastructures, specializations] = await Promise.all([
    admin
      .from("national_federation_infrastructures")
      .select("country_id, level")
      .eq("infrastructure_code", "race_organization_office")
      .gte("level", 3)
      .returns<InfrastructureRow[]>(),
    admin
      .from("national_federation_infrastructure_specializations")
      .select("country_id, active_specialization_code")
      .eq("infrastructure_code", "race_organization_office")
      .eq("active_specialization_code", "national_pipeline")
      .returns<SpecializationRow[]>(),
  ]);

  if (infrastructures.error) {
    throw new Error(
      `Impossible de charger les Bureaux d’organisation : ${infrastructures.error.message}`,
    );
  }
  if (specializations.error) {
    throw new Error(
      `Impossible de charger leur orientation de marché : ${specializations.error.message}`,
    );
  }

  const pipelineCountries = new Set(
    (specializations.data ?? []).map((row) => row.country_id),
  );
  return new Map(
    (infrastructures.data ?? []).flatMap((row) => {
      if (!pipelineCountries.has(row.country_id)) return [];
      const effects = getRaceOrganizationOfficeEffects({
        level: row.level,
        specializationCode: "national_pipeline",
      });
      return [
        [
          row.country_id,
          1 + effects.marketNationalityChanceBonusPercentage / 100,
        ] as const,
      ];
    }),
  );
}
