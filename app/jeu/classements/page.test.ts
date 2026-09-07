import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const rankingsService = readFileSync(
  new URL("../../../services/uci-rankings.ts", import.meta.url),
  "utf8",
);

describe("classement UCI individuel", () => {
  it("affiche le portrait compact de chaque coureur avec son âge et son maillot", () => {
    expect(page).toContain('import { RiderAvatar }');
    expect(page).toContain("profileKey={entry.avatarProfileKey}");
    expect(page).toContain("seed={entry.avatarSeed}");
    expect(page).toContain("age={entry.age}");
    expect(page).toContain("jersey={entry.jersey}");
    expect(page).toContain('renderMode="compact"');
  });

  it("charge les données de portrait sans requête séquentielle supplémentaire", () => {
    expect(rankingsService).toContain(
      "first_name, last_name, avatar_profile_key, avatar_seed",
    );
    expect(rankingsService).toContain('.select("rider_id, age")');
    expect(rankingsService).toContain("riderAgesResult,");
    expect(rankingsService).toContain("await Promise.all([");
  });
});
