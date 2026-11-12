import "server-only";

import {
  calculateFederationConstructionPreview,
  FEDERATION_INFRASTRUCTURE_DEFINITIONS,
  type FederationInfrastructureCode,
} from "@/lib/game/federation-infrastructures";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardFastSummary } from "@/services/dashboard-fast-summary";

export type DashboardFederationConstructionOpportunity = {
  countryCode: string;
  projects: Array<{
    code: FederationInfrastructureCode;
    name: string;
    targetLevel: number;
    cost: number;
  }>;
};

type FederationConstructionRow = {
  season: { game_year: number; current_day_number: number };
  country: {
    id: string;
    iso_alpha2: string;
    terms: Array<{ start_game_year: number; end_game_year: number }>;
    levels: Array<{ infrastructure_code: string; level: number }>;
    projects: Array<{ infrastructure_code: string; completes_game_day_index: number }>;
  };
};

type FederationBudgetRow = { balance: number | string; reserved_amount: number | string };

export async function getDashboardFederationConstructionOpportunity(
  { teamSeasonId, sportingDirectorId, seasonId }: Pick<DashboardFastSummary,
    "teamSeasonId" | "sportingDirectorId" | "seasonId">,
  signal = AbortSignal.timeout(3_000),
): Promise<DashboardFederationConstructionOpportunity | null> {
  try {
    // The authenticated fast summary supplies the current DS and affiliation.
    const admin = createSupabaseAdminClient();
    const result = await admin.from("team_seasons")
      .select(`
        season:seasons!inner(game_year,current_day_number),
        country:countries!registration_country_id!inner(
          id,iso_alpha2,
          terms:national_federation_terms!inner(start_game_year,end_game_year),
          levels:national_federation_infrastructures(infrastructure_code,level),
          projects:national_federation_infrastructure_projects(infrastructure_code,completes_game_day_index)
        )
      `)
      .eq("id", teamSeasonId)
      .eq("season_id", seasonId)
      .in("status", ["planned", "active"])
      .eq("season.status", "active")
      .gte("season.game_year", 3)
      .eq("country.is_active", true)
      .eq("country.terms.governance_mode", "elected")
      .eq("country.terms.president_director_id", sportingDirectorId)
      .eq("country.projects.status", "active")
      .abortSignal(signal)
      .maybeSingle<FederationConstructionRow>();

    if (result.error) {
      console.warn("dashboard_federation_construction_unavailable", { code: result.error.code });
      return null;
    }
    if (!result.data) return null;

    const { country, season: { game_year: gameYear, current_day_number: currentDayNumber } } = result.data;
    if (!country.terms.some((term) => term.start_game_year <= gameYear && term.end_game_year >= gameYear)) {
      return null;
    }

    const currentGameDayIndex = gameYear * 28 + currentDayNumber - 1;
    if (country.projects.some((project) => project.completes_game_day_index > currentGameDayIndex)) {
      return null;
    }

    const countryCode = country.iso_alpha2.toLowerCase();
    if (!/^[a-z]{2}$/.test(countryCode)) return null;

    const budget = await admin.rpc("get_national_federation_hosting_budget", {
      p_country_id: country.id, p_season_id: seasonId,
    }).abortSignal(signal).maybeSingle<FederationBudgetRow>();
    if (budget.error) {
      console.warn("dashboard_federation_construction_unavailable", { code: budget.error.code });
      return null;
    }
    if (!budget.data) return null;
    const availableCents = Math.round(Number(budget.data.balance) * 100) -
      Math.round(Number(budget.data.reserved_amount) * 100);

    const levels = new Map(country.levels.map((row) => [row.infrastructure_code, row.level]));
    const projectsAwaitingSettlement = new Set(country.projects.map((row) => row.infrastructure_code));
    const projects = FEDERATION_INFRASTRUCTURE_DEFINITIONS.flatMap(({ code, name, levels: availableLevels }) => {
      if (projectsAwaitingSettlement.has(code)) return [];
      const nextLevel = availableLevels.find(({ level }) => level === (levels.get(code) ?? 0) + 1);
      if (!nextLevel) return [];

      const { cost } = calculateFederationConstructionPreview({
        level: nextLevel, architectCount: 0, priority: "balanced",
      });
      return cost * 100 <= availableCents ? [{ code, name, targetLevel: nextLevel.level, cost }] : [];
    });

    return projects.length > 0 ? { countryCode, projects } : null;
  } catch {
    console.warn("dashboard_federation_construction_unavailable");
    return null;
  }
}
