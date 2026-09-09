import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260909100000_create_federation_sponsor_creation_jobs.sql",
  ),
  "utf8",
);
const catalog = readFileSync(
  join(root, "components/game/federation-infrastructure-catalog.tsx"),
  "utf8",
);
const service = readFileSync(
  join(root, "services/federation-infrastructures.ts"),
  "utf8",
);
const actions = readFileSync(
  join(root, "app/jeu/federations/infrastructure-actions.ts"),
  "utf8",
);
const packageJson = readFileSync(join(root, "package.json"), "utf8");

describe("federation sponsor creation jobs", () => {
  it("réserve une seule prospection annuelle au Bureau d’organisation N5", () => {
    expect(migration).toContain(
      "create table public.national_federation_sponsor_creation_jobs",
    );
    expect(migration).toContain(
      "unique (country_id, requested_season_id)",
    );
    expect(migration).toContain(
      "infrastructure.infrastructure_code = 'race_organization_office'",
    );
    expect(migration).toContain("), 0) < 5");
    expect(migration).toContain("term.governance_mode = 'elected'");
    expect(migration).toContain(
      "term.president_director_id = v_identity.sporting_director_id",
    );
  });

  it("conserve un job traçable jusqu’à la publication d’un sponsor du bon pays", () => {
    for (const status of ["pending", "in_progress", "completed", "failed"]) {
      expect(migration).toContain(`'${status}'`);
    }
    expect(migration).toContain(
      "claim_national_federation_sponsor_creation_job",
    );
    expect(migration).toContain(
      "complete_national_federation_sponsor_creation_job",
    );
    expect(migration).toContain(
      "v_sponsor.country_id <> v_job.country_id",
    );
    expect(migration).toContain(
      "Le sponsor doit être synchronisé dans le registre avant publication.",
    );
    expect(migration).toMatch(
      /grant execute on function public\.claim_national_federation_sponsor_creation_job\(uuid\)\s+to service_role/i,
    );
  });

  it("affiche le quota, l’historique et l’action réservée au président", () => {
    expect(catalog).toContain("Appel à un nouveau partenaire");
    expect(catalog).toContain("1 par saison");
    expect(catalog).toContain("Sponsor permanent");
    expect(catalog).toContain("Prospection déjà utilisée");
    expect(catalog).toContain("requestFederationSponsorCreationAction");
    expect(actions).toContain(
      '"request_national_federation_sponsor_creation"',
    );
    expect(service).toContain(
      'from("national_federation_sponsor_creation_jobs")',
    );
  });

  it("expose au chat de production une commande de file dédiée", () => {
    expect(packageJson).toContain('"sponsors:jobs"');
    const script = readFileSync(
      join(root, "scripts/manage-federation-sponsor-jobs.ts"),
      "utf8",
    );
    for (const command of ["list", "claim", "complete", "fail"]) {
      expect(script).toContain(`command === "${command}"`);
    }
  });
});
