import type { PerformanceSample } from "./samples";

const TRACKED_RPCS: Record<string, string> = {
  get_current_dashboard_fast_summary_v2: "/jeu",
  get_current_dashboard_core_summary_v2: "/jeu",
  get_current_game_objective_summary_cached: "/jeu",
  get_current_dashboard_assistant_summary: "/jeu",
  get_calendar_engaged_riders: "/jeu/calendrier",
  get_current_team_race_preparation: "/jeu/preparation-course",
  get_current_team_roster: "/jeu/effectif",
  save_current_rider_training_plans: "/jeu/entrainement",
  save_current_youth_training_settings_bulk: "/jeu/centre-de-formation",
  save_current_team_equipment_assignments: "/jeu/materiel",
  apply_current_team_nutrition_interventions: "/jeu/centre-de-soin",
  save_current_team_national_championship_selections: "/jeu/championnats-nationaux",
};

export function createTimedRpcFetch(baseFetch: typeof fetch, supabaseOrigin: string, record: (sample: PerformanceSample) => void): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const rpc = url.origin === supabaseOrigin && url.pathname.startsWith("/rest/v1/rpc/") ? url.pathname.slice(13) : "";
    const route = TRACKED_RPCS[rpc];
    if (!route) return baseFetch(input, init);
    const start = performance.now();
    let ok = false;
    try {
      const response = await baseFetch(input, init);
      ok = response.ok;
      return response;
    } finally {
      // Instrumentation must never replace a response or a network exception.
      try { record({ source: "rpc", route, metric: rpc, value: Math.min(300_000, Math.max(0, performance.now() - start)), device: "server", ok }); } catch { /* fail open */ }
    }
  };
}
