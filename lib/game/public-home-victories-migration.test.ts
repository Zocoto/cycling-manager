import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260821234000_fix_public_official_victory_total.sql",
  ),
  "utf8",
);
const service = readFileSync(
  resolve(process.cwd(), "services/public-game-news.ts"),
  "utf8",
);

describe("compteur public des victoires officielles", () => {
  it("calcule le total exact des victoires hors championnats nationaux", () => {
    expect(migration).toContain("count(*) over ()::bigint as total_count");
    expect(migration).toContain("result.final_rank = 1");
    expect(migration).toContain("race.competition_type not in (");
    expect(migration).toContain("'national_road'");
    expect(migration).toContain("'national_time_trial'");
  });

  it("réserve la lecture publique au service serveur", () => {
    expect(migration).toContain(
      "revoke all on function public.get_public_home_victories(integer)",
    );
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("utilise le total exact de la fonction SQL dans le flux d'accueil", () => {
    expect(service).toContain('.rpc("get_public_home_victories"');
    expect(service).toContain(
      "normalizePublicGameNewsTotal(results[0]?.total_count)",
    );
  });
});
