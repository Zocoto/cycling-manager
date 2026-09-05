import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const serverActionFiles = [
  "actions.ts",
  "affiliation-actions.ts",
  "finance-actions.ts",
  "governance-actions.ts",
  "infrastructure-actions.ts",
  "selection-actions.ts",
];

describe("federation form boundaries", () => {
  it.each(serverActionFiles)(
    "%s only exports async runtime values from its use-server module",
    (fileName) => {
      const source = readFileSync(
        join(process.cwd(), "app/jeu/federations", fileName),
        "utf8",
      ).replace(/\r\n/g, "\n");

      expect(source.startsWith('"use server";')).toBe(true);
      expect(source).not.toMatch(
        /^export\s+(?:const|let|var|class|enum|function)\b/m,
      );
    },
  );

  it("allows affiliation with an existing sponsor and keeps the limits explicit", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260905170000_allow_sponsored_amateur_affiliation_transfer.sql",
      ),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const panel = readFileSync(
      join(
        process.cwd(),
        "components/game/amateur-team-affiliation-panel.tsx",
      ),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(migration).not.toContain("from public.team_sponsor_contracts");
    expect(migration).toContain("team_national_affiliation_changes");
    expect(migration).toContain("set home_country_id = v_new_country.id");
    expect(panel).toContain("Aucune ancienneté minimale n’est requise");
    expect(panel).toContain("le sponsor et les contrats déjà signés restent");
  });

  it("loads federation member jerseys from the production contract table", () => {
    const service = readFileSync(
      join(process.cwd(), "services/federation-team-jerseys.ts"),
      "utf8",
    );

    expect(service).toContain('.from("team_sponsor_contracts")');
    expect(service).not.toContain('.from("sponsor_contracts")');
  });
});
