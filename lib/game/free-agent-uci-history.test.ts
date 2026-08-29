import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8").replaceAll(
    "\r\n",
    "\n",
  );
}

const historyService = readSource("services/public-rider-profile.ts");
const riderPage = readSource(
  "app",
  "jeu",
  "coureurs",
  "[identifiant]",
  "page.tsx",
);
const preservationMigration = readSource(
  "supabase",
  "migrations",
  "20260829210000_preserve_scoring_free_agents.sql",
);
const detectionMigration = readSource(
  "supabase",
  "migrations",
  "20260829143000_add_free_agent_detection_teams.sql",
);

describe("free-agent UCI history", () => {
  it("keeps points earned without a contract detached from every team", () => {
    expect(detectionMigration).toContain("sporting_director_id,\n    team_season_id");
    expect(detectionMigration).toContain(
      "p_source_type,\n    null,\n    null,\n    v_context.rider_id,",
    );
    expect(historyService).toContain(
      "historyTeamKey(season.id, contract.team_id)",
    );
    expect(historyService).toContain("hasSeveralTeams || hasFreeAgentPoints");
    expect(historyService).toContain("achievements?.points ?? 0");
  });

  it("adds one explicit free-agent affiliation once UCI points exist", () => {
    expect(historyService).toContain(
      '"id, season_id, display_name, race:races(competition_type, race_format)"',
    );
    expect(historyService).toContain("historyTeamKey(season.id, null)");
    expect(historyService).toContain('teamName: "Agent libre"');
    expect(historyService).toContain("teamId: null");
    expect(historyService).toContain("achievements.points <= 0");
    expect(riderPage).toContain("{entry.teamId ? (");
  });

  it("preserves scoring free agents during every season rollover", () => {
    expect(preservationMigration).toContain(
      "reward_events_free_agent_rider_uci_idx",
    );
    expect(preservationMigration).toContain("if v_has_team or exists (");
    expect(preservationMigration).toContain(
      "free_agent_reward.team_season_id is null",
    );
    expect(preservationMigration).toContain(
      "free_agent_reward.uci_points > 0",
    );
    expect(preservationMigration).toContain(
      "free_agent_reward.source_type in (''race_result'', ''stage_result'')",
    );
  });
});
