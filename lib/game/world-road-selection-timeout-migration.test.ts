import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905095000_fix_world_road_selection_timeouts.sql",
  ),
  "utf8",
);

describe("fiabilisation des convocations mondiales en ligne", () => {
  it("ignore les editions mondiales deja integralement preparees", () => {
    expect(migration).toContain("v_existing_nation_count >= 30");
    expect(migration).toContain("v_incomplete_nation_count = 0");
    expect(migration).toContain("continue;");
  });

  it("ne resynchronise que les listes nouvellement creees ou reparees", () => {
    expect(migration).toContain(
      "get diagnostics v_inserted_candidate_count = row_count",
    );
    expect(migration).toContain(
      "if v_selection_created or v_inserted_candidate_count > 0 then",
    );

    const guardedSync = migration.indexOf(
      "if v_selection_created or v_inserted_candidate_count > 0 then",
    );
    const rerank = migration.indexOf(
      "perform public.rerank_world_time_trial_selection(",
      guardedSync,
    );
    const synchronization = migration.indexOf(
      "perform public.sync_international_championship_lineup(",
      guardedSync,
    );

    expect(guardedSync).toBeGreaterThan(-1);
    expect(rerank).toBeGreaterThan(guardedSync);
    expect(synchronization).toBeGreaterThan(rerank);
  });

  it("conserve la publication a J-4 et les trente meilleures nations", () => {
    expect(migration).toContain(
      "stage.departure_at <= p_now + interval '4 days'",
    );
    expect(migration).toContain("where nation_rank <= 30");
  });

  it("accorde au service un delai de secours sans ralentir le chemin nominal", () => {
    expect(migration).toContain("set statement_timeout = '240s'");
  });

  it("repare les convocations manquantes pendant le deploiement", () => {
    expect(migration).toContain("set local statement_timeout = '5min'");
    expect(migration).toContain(
      "select public.prepare_upcoming_world_championship_selections(now())",
    );
    expect(migration).toContain(
      "world_championship_selection_repair_created=%",
    );
  });
});
