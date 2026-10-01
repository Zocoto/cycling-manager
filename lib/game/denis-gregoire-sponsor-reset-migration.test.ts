import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261001120000_reset_denis_gregoire_s4_sponsor_choice.sql",
  ),
  "utf8",
);

describe("Dénis Grégoire S4 sponsor reset migration", () => {
  it("targets the audited director, team, contract and offers", () => {
    expect(migration).toContain("42ee1bb6-94fb-4b0b-9bfc-9f2f0defc539");
    expect(migration).toContain("20bcbcf8-7f09-42b7-b4be-ce77d4aade10");
    expect(migration).toContain("ba57b131-8fa4-4a50-9af5-b206483bab2c");
    expect(migration).toContain("6a0fb866-9d96-4633-88bf-9baca52c21e2");
    expect(migration).toContain("e177991b-5226-4219-a809-f2cbbcc25d87");
    expect(migration).toContain("lower(btrim(director.username)) = 'dgreg'");
  });

  it("refuses to overwrite a changed or already-used contract", () => {
    expect(migration).toContain(
      "Le contrat S4 de Dénis Grégoire ne correspond plus à l’état erroné audité.",
    );
    expect(migration).toContain("from public.objective_progress");
    expect(migration).toContain("from public.sponsor_satisfaction_events");
    expect(migration).toContain("if v_dependency_count <> 0 then");
  });

  it("restores Glen Durnach and reopens a blank jersey selection", () => {
    expect(migration).toContain("set status = 'withdrawn'");
    expect(migration).toContain("set status = 'accepted'");
    expect(migration).toContain("sponsor_id = v_glen_offer.sponsor_id");
    expect(migration).toContain("sponsor_offer_id = v_glen_offer.id");
    expect(migration).toContain("selected_jersey_id = null");
    expect(migration).toContain("selected_jersey_style = null");
    expect(migration).toContain("pending_jersey_id = null");
  });
});
