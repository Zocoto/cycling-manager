import "server-only";
import { cache } from "react";
import { SPONSORS } from "@/data/sponsors";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveSponsorSportingPhilosophy, SPONSOR_SPORTING_PHILOSOPHIES } from "@/lib/game/sponsor-philosophy";
import { readSponsorPartialAchievements } from "@/lib/game/sponsor-partial-achievements";
import type { SponsorProject } from "@/lib/game/sponsor-project";
import type { SponsorContractObjective } from "./sponsoring-workflow";
import type { SponsorMainObjectiveTerms } from "@/lib/game/sponsor-main-objective";

type Relation<T> = T | T[] | null;
const first = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
type ContractRow = { id: string; sponsor_offer_id: string | null; start_season_id: string; objective_season_id: string | null;
  satisfaction_score: number; sponsors: Relation<{ catalog_key: string }> };
type ObjectiveRow = { id: string; name: string; status: SponsorContractObjective["status"]; display_order: number;
  satisfaction_points: number; target_details: SponsorContractObjective["targetDetails"];
  objective_progress: Relation<{ current_value: number | string; status: SponsorContractObjective["progressStatus"]; details: Record<string, unknown> | null }>;
  sponsor_main_objective_terms: Relation<{ cash_reward: number; currency_code: string; reputation_penalty: number;
    race_category_code: SponsorMainObjectiveTerms["raceCategoryCode"]; settlement_status: SponsorMainObjectiveTerms["settlementStatus"] }> };

const numeric = (value: unknown): number | null => {
  if ((typeof value !== "string" && typeof value !== "number") || value === "") return null;
  const result = Number(value); return Number.isFinite(result) ? result : null;
};

/** Trusted team ID from authenticated header only. Two indexed, bounded SELECTs, no RPC, no retries.
 * Request-local memoization: never share a manager's contract through a global cache. */
export const getTeamSponsorProject = cache(async (teamId: string | null): Promise<SponsorProject | null> => {
  if (!teamId) return null;
  try {
    const db = createSupabaseAdminClient();
    const contractResult = await db.from("team_sponsor_contracts")
      .select("id, sponsor_offer_id, start_season_id, objective_season_id, satisfaction_score, sponsors(catalog_key)")
      .eq("team_id", teamId).eq("role", "principal").eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).abortSignal(AbortSignal.timeout(1500)).maybeSingle<ContractRow>();
    if (contractResult.error) throw contractResult.error;
    const contract = contractResult.data;
    if (!contract) return null;
    const sponsor = SPONSORS.find(item => item.id === first(contract.sponsors)?.catalog_key);
    if (!sponsor) return null;
    const seasonId = contract.objective_season_id ?? contract.start_season_id;
    const objectives: SponsorContractObjective[] = [];
    if (contract.sponsor_offer_id) {
      const result = await db.from("sponsor_objectives")
        .select("id, name, status, display_order, satisfaction_points, target_details, objective_progress(current_value, status, details), sponsor_main_objective_terms(cash_reward, currency_code, reputation_penalty, race_category_code, settlement_status)")
        .eq("sponsor_offer_id", contract.sponsor_offer_id).eq("season_id", seasonId).neq("status", "draft")
        .eq("objective_progress.team_sponsor_contract_id", contract.id).eq("objective_progress.season_id", seasonId)
        .order("display_order", { ascending: true }).limit(10)
        .limit(1, { referencedTable: "objective_progress" }).limit(1, { referencedTable: "sponsor_main_objective_terms" })
        .abortSignal(AbortSignal.timeout(1500)).returns<ObjectiveRow[]>();
      if (result.error) throw result.error;
      for (const row of result.data ?? []) {
        if (!row.target_details || typeof row.target_details.kind !== "string") continue;
        const progress = first(row.objective_progress);
        const details = progress?.details;
        const terms = first(row.sponsor_main_objective_terms);
        objectives.push({ id: row.id, name: row.name, description: null, displayOrder: row.display_order, status: row.status,
          satisfactionPoints: Math.max(0, numeric(row.satisfaction_points) ?? 0), targetDetails: row.target_details,
          currentValue: numeric(progress?.current_value), targetValue: numeric(details?.targetValue), progressStatus: progress?.status ?? null,
          achievementLevel: details?.achievementLevel === "partial" || details?.achievementLevel === "full" || details?.achievementLevel === "missed" ? details.achievementLevel : null,
          partialSatisfactionPoints: Math.max(0, numeric(details?.partialSatisfactionPoints) ?? 0),
          partialAchievements: readSponsorPartialAchievements(details?.partialAchievements),
          mainObjectiveTerms: terms ? { cashReward: Number(terms.cash_reward), currencyCode: terms.currency_code,
            reputationPenalty: Number(terms.reputation_penalty), raceCategoryCode: terms.race_category_code, settlementStatus: terms.settlement_status } : null });
      }
    }
    const stored = objectives.find(item => item.targetDetails.sportingPhilosophy)?.targetDetails.sportingPhilosophy;
    return { contractId: contract.id, seasonId, sponsorName: sponsor.name,
      philosophy: stored && SPONSOR_SPORTING_PHILOSOPHIES.includes(stored) ? stored : resolveSponsorSportingPhilosophy(sponsor.id),
      satisfactionScore: Math.max(0, Math.min(100, numeric(contract.satisfaction_score) ?? 0)), objectives };
  } catch (error) {
    // Optional guidance must never make a calendar, roster or result page unavailable.
    console.error("sponsor_project_read_unavailable", error && typeof error === "object" && "message" in error ? String(error.message) : "read failed");
    return null;
  }
});
