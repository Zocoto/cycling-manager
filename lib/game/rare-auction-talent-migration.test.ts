import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DAILY_AUCTION_POTENTIAL_DISTRIBUTION } from "@/lib/game/daily-auction-potential";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260728140000_add_rare_daily_auction_talents.sql",
  ),
  "utf8",
);

describe("rare daily auction talents migration", () => {
  it("utilise dix mille tirages pour représenter les probabilités fines", () => {
    expect(migration).toContain("% 10000 + 10000");
    expect(migration).toContain(") % 10000");
  });

  it("reste synchronisée avec tous les paliers définis côté jeu", () => {
    for (const tier of DAILY_AUCTION_POTENTIAL_DISTRIBUTION.slice(0, -1)) {
      expect(migration).toContain(
        `value < ${tier.maxRollExclusive} then ${tier.potentialSteps}`,
      );
    }
    expect(migration).toContain(
      "when p_generation_source = 'auction' then 8",
    );
  });

  it("préserve la distribution amateur à 70 % / 30 %", () => {
    expect(migration).toContain("when value < 7000 then 1");
    expect(migration).toContain("else 2");
  });

  it("ne modifie pas rétroactivement les coureurs déjà générés", () => {
    expect(migration).not.toContain("update public.riders");
  });
});
