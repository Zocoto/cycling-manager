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

  it("atomically aligns the amateur team and coach with their current federation after one full season", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260912130000_naturalize_amateur_team_and_director.sql",
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
    const affiliationService = readFileSync(
      join(process.cwd(), "services/amateur-team-affiliation.ts"),
      "utf8",
    ).replace(/\r\n/g, "\n");

    expect(migration).toContain(
      "p_country_id is distinct from v_federation_country.id",
    );
    expect(migration).toContain(
      "previous_season.game_year = v_season.game_year - 1",
    );
    expect(migration).toContain("previous_team_season.status = 'completed'");
    expect(migration).toContain("set home_country_id = v_federation_country.id");
    expect(migration).toContain("update public.sporting_directors");
    expect(migration).toContain("set country_id = v_federation_country.id");
    expect(migration).toContain("v_team_needs_change and exists");
    expect(migration).toContain(
      "app.allow_federation_identity_naturalization",
    );
    expect(migration).not.toContain("set registration_country_id =");
    expect(panel).not.toContain("<select");
    expect(panel).toContain('value={state.federationCountryId}');
    expect(panel).toContain("Une saison complète dans cette fédération est requise");
    expect(panel).toContain('label="Équipe amateure"');
    expect(panel).toContain('label="Entraîneur"');
    expect(panel).toContain("Naturaliser la structure");
    expect(panel).toContain("sponsors");
    expect(affiliationService).toMatch(
      /teamAlreadyAligned\s*&&\s*trainerAlreadyAligned/,
    );
    expect(affiliationService).toMatch(
      /alreadyChanged\s*&&\s*!teamAlreadyAligned/,
    );
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
