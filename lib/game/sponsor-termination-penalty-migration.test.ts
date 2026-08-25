import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260825124000_raise_sponsor_termination_reputation_penalty.sql",
  ),
  "utf8",
);

describe("sponsor termination reputation penalty migration", () => {
  it("remplace de manière contrôlée le barème de 10 par 25 points", () => {
    expect(migration).toContain(
      "'public.terminate_active_sponsor_contract(uuid)'::regprocedure",
    );
    expect(migration).toContain(
      "'v_reputation_penalty integer := 10;',",
    );
    expect(migration).toContain(
      "'v_reputation_penalty integer := 25;'",
    );
  });

  it("reste idempotente et interrompt une réécriture inattendue", () => {
    expect(migration).toContain(
      "position('v_reputation_penalty integer := 25;' in v_definition) > 0",
    );
    expect(migration).toContain("migration interrompue");
  });
});
