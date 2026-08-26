import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260826103000_create_sponsor_ambassador_trophy.sql",
  ),
  "utf8",
);
const trophyService = readFileSync(
  resolve(process.cwd(), "services/trophy-gallery.ts"),
  "utf8",
);
const profileAction = readFileSync(
  resolve(process.cwd(), "app/jeu/directeur-sportif/actions.ts"),
  "utf8",
);

describe("Sponsor ambassador trophy migration", () => {
  it("awards one idempotent trophy per perfect sponsor season", () => {
    expect(migration).toContain(
      "create table public.sporting_director_sponsor_trophies",
    );
    expect(migration).toContain(
      "unique (sporting_director_id, season_id)",
    );
    expect(migration).toContain("new.satisfaction_score <> 100");
    expect(migration).toContain("new.status <> 'completed'");
    expect(migration).toContain("after update of satisfaction_score");
    expect(migration.match(/on conflict do nothing/g)).toHaveLength(2);
  });

  it("keeps the reward out of intermediate sponsor evaluations", () => {
    expect(migration).not.toContain(
      "create or replace function public.evaluate_sponsor_objectives_for_contract(",
    );
    expect(migration).toContain("contract.status = 'completed'");
    expect(migration).toContain("contract.satisfaction_score = 100");
  });

  it("protects and loads the exclusive avatar outfit", () => {
    expect(migration).toContain("v_outfit_key <> 'ambassador'");
    expect(migration).toContain(
      "Le trophée Ambassadeur exemplaire est requis",
    );
    expect(profileAction).toContain(
      "SPONSOR_AMBASSADOR_AVATAR_OUTFIT_KEY",
    );
    expect(trophyService).toContain(
      '.from("sporting_director_sponsor_trophies")',
    );
  });
});
