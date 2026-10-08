import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261008170000_compensate_peloponnese_live_ranking.sql"
  ),
  "utf8"
);

describe("Peloponnese live ranking compensation migration", () => {
  it("cible uniquement les dix membres engagés dans la course terminée", () => {
    expect(migration).toContain(
      "fb8bd3b9-ac38-4e63-ad17-86a6610e13ad"
    );
    expect(migration).toContain(
      "display_name = 'Classique du Péloponnèse'"
    );
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("v_target_count <> 10");
  });

  it("attribue un cadeau modéré, traçable et idempotent", () => {
    expect(migration).toContain("'performance-equipment'");
    expect(migration).toContain(
      "on conflict (incident_key, sporting_director_id) do nothing"
    );
    expect(migration).toContain(
      "where inventory.source_race_incident_compensation_id = v_grant_id"
    );
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing"
    );
  });

  it("explique que les résultats sportifs et économiques sont restés corrects", () => {
    expect(migration).toContain(
      "Dijilly Sidibé est bien vainqueur, devant Anil Mirza et Abshero Tolosa"
    );
    expect(migration).toContain(
      "Les primes, points et palmarès ont été attribués sur ce résultat correct"
    );
  });
});
