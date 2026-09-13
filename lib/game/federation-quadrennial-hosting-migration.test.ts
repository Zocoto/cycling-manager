import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260913140000_replace_s4_pro_nations_cup_with_quadrennial_games.sql",
  ),
  "utf8",
);
const hosting = readFileSync(
  join(process.cwd(), "lib/game/federation-hosting.ts"),
  "utf8",
);
const courses = readFileSync(
  join(process.cwd(), "services/federation-courses.ts"),
  "utf8",
);

describe("quadriennial federation hosting migration", () => {
  it("replaces only the professional Nations Cup in every fourth season", () => {
    expect(migration).toContain("'quadrennial_games_pro'");
    expect(migration).toContain("target_game_year % 4 = 0");
    expect(migration).toContain("target_game_year % 4 <> 0");
    expect(migration).toContain("and event_type = 'nations_cup_pro'");
    expect(migration).toContain("'nations_cup_junior'");
    expect(hosting).toContain("getFederationHostingEventsForGameYear");
    expect(hosting).toContain('event.type !== "nations_cup_pro"');
    expect(hosting).toContain('event.type !== "quadrennial_games_pro"');
    expect(courses).toContain(
      "getFederationHostingEventsForGameYear(targetGameYear)",
    );
  });

  it("rejects a professional Nations Cup candidacy targeting S4", () => {
    expect(migration).toContain("(v_season.game_year + 1) % 4 = 0");
    expect(migration).toContain(
      "La Nations Cup professionnelle est remplacée par les Jeux quadriennaux",
    );
    expect(migration).toContain(
      "Les Jeux quadriennaux ne peuvent être organisés qu’en saison quadriennale",
    );
  });

  it("applies the selected host and revenue to the S4 professional programme", () => {
    expect(migration).toContain(
      "when v_season.game_year % 4 = 0 then 'quadrennial_games_pro'",
    );
    expect(migration).toContain(
      "new.event_type in ('nations_cup_pro', 'quadrennial_games_pro')",
    );
    expect(migration).toContain("when 'quadrennial_games_pro' then 180000");
    expect(migration).toContain("when 'quadrennial_games_pro' then 17");
  });
});
