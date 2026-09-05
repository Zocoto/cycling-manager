import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260905113000_add_sponsor_rider_recruitment_objectives.sql",
  ),
  "utf8",
);
const currentOffers = readFileSync(
  resolve(process.cwd(), "services/persisted-sponsor-offers.ts"),
  "utf8",
);
const futureOffers = readFileSync(
  resolve(process.cwd(), "services/future-sponsor-offers.ts"),
  "utf8",
);
const contracts = readFileSync(
  resolve(process.cwd(), "services/sponsoring-workflow.ts"),
  "utf8",
);

describe("sponsor rider recruitment objectives", () => {
  it("autorise et évalue réellement la nouvelle famille d’objectif", () => {
    expect(migration).toContain("'rider_recruitment'");
    expect(migration).toContain("public.rider_contracts as rider_contract");
    expect(migration).toContain(
      "rider_contract.rider_id = v_target_rider_id",
    );
    expect(migration).toContain(
      "rider_contract.team_id = v_contract.team_id",
    );
    expect(migration).toContain(
      "v_contract.game_year between",
    );
  });

  it("active la famille uniquement au moment où un nouveau lot d’offres est inséré", () => {
    for (const source of [currentOffers, futureOffers]) {
      expect(source).toContain(
        "RIDER_RECRUITMENT_OBJECTIVE_OFFER_GENERATION_VERSION",
      );
      expect(source).toMatch(
        /generation_version: Math\.max\([\s\S]{0,150}RIDER_RECRUITMENT_OBJECTIVE_OFFER_GENERATION_VERSION/,
      );
      expect(source).toMatch(
        /generation_version \?\? 0\) >=\s+RIDER_RECRUITMENT_OBJECTIVE_OFFER_GENERATION_VERSION/,
      );
    }
  });

  it("ne réactive jamais cet objectif pendant l’hydratation d’un contrat signé", () => {
    expect(contracts).not.toContain(
      "includeRiderRecruitmentObjective: true",
    );
    expect(migration).not.toMatch(
      /update public\.sponsor_objectives[\s\S]+objective_type = 'rider_recruitment'/,
    );
  });
});
