import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260906150000_add_s3_sponsor_performance_satisfaction.sql",
  ),
  "utf8",
).toLowerCase();
const sponsorService = readFileSync(
  resolve(process.cwd(), "services/sponsoring-workflow.ts"),
  "utf8",
);
const summaryService = readFileSync(
  resolve(process.cwd(), "services/sponsor-objective-summary.ts"),
  "utf8",
);
const sponsorPage = readFileSync(
  resolve(process.cwd(), "app/jeu/sponsoring/page.tsx"),
  "utf8",
);

describe("S3 sponsor performance satisfaction", () => {
  it("reste strictement inactive avant la saison 3", () => {
    expect(migration).toContain("v_edition.game_year < 3");
    expect(migration).toContain("coalesce(v_active_game_year, 0) < 3");
    expect(migration).toContain("after update of status");
    expect(migration).toContain("old.status is distinct from 'completed'");
  });

  it("attribue un barème borné aux résultats et au pays du sponsor", () => {
    expect(migration).toContain(
      "p_category_code = 'elite' and p_rank = 1 then 4",
    );
    expect(migration).toContain(
      "p_category_code = 'world' and p_rank <= 10 then 1",
    );
    expect(migration).toContain(
      "p_category_code = 'continental' and p_rank <= 3 then 1",
    );
    expect(migration).toContain(
      "v_team.sponsor_country_id = v_edition.race_country_id",
    );
    expect(migration).toContain("25 - v_performance_score");
    expect(migration).toContain(
      "100 - v_objective_score - v_performance_score",
    );
  });

  it("ne crédite que la progression vers un meilleur palier UCI", () => {
    expect(migration).toContain("when p_rank = 1 then 6");
    expect(migration).toContain("when p_rank <= 3 then 4");
    expect(migration).toContain("when p_rank <= 5 then 3");
    expect(migration).toContain("when p_rank <= 10 then 2");
    expect(migration).toContain("when p_rank <= 20 then 1");
    expect(migration).toContain(
      "v_current_ranking_bonus - v_previous_ranking_bonus",
    );
    expect(migration).toContain("and ranked.points > 0");
  });

  it("est idempotente et résiste aux recalculs d’objectifs", () => {
    expect(migration).toContain(
      "unique (team_sponsor_contract_id, source_key)",
    );
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "create trigger synchronize_s3_sponsor_satisfaction_score_trigger",
    );
    expect(migration).toContain(
      "coalesce(v_objective_score, 0) + least(25, coalesce(v_performance_score, 0))",
    );
  });

  it("charge et explique les gains dans l’interface sponsor", () => {
    expect(sponsorService).toContain('.from("sponsor_satisfaction_events")');
    expect(sponsorPage).toContain("Les résultats qui ont convaincu");
    expect(sponsorPage).toContain("contract.satisfactionEvents.map");
    expect(summaryService).toContain('.select("satisfaction_score")');
    expect(summaryService).toContain(
      "satisfactionScore: persistedSatisfactionScore",
    );
  });
});
