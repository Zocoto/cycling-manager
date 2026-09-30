import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const localMigration = readMigration(
  "20260930150000_create_s4_local_race_circuit.sql",
);
const expansionMigration = readMigration(
  "20260930160000_expand_and_diversify_s4_calendar.sql",
);

describe("S4 calendar expansion migrations", () => {
  it("garde strictement le nouveau calendrier hors de la saison 3", () => {
    expect(localMigration).toContain("v_season.game_year < 4");
    expect(localMigration).toContain("where game_year >= 4");
    expect(expansionMigration).toContain("where game_year >= 4");
    expect(`${localMigration}\n${expansionMigration}`).not.toContain(
      "game_year >= 3",
    );
  });

  it("prépare quatre classiques et un mini-tour pour les 42 pays actifs", () => {
    expect(
      localMigration.match(/^  \('[A-Z]{2}', array\[/gm),
    ).toHaveLength(42);
    expect(localMigration).toContain("for v_event_index in 1..5 loop");
    expect(localMigration).toContain("when v_event_index = 3 then 3 else 1");
    expect(localMigration).toContain("cardinality(classic_names) = 4");
    expect(localMigration).toContain("sync_s4_local_calendar_for_team_season");
  });

  it("verrouille les Locales au pays tout en les gardant consultables", () => {
    expect(localMigration).toContain(
      "category.code not in ('local', 'regional')",
    );
    expect(localMigration).toContain(
      "context.registration_country_id = race_country.id",
    );
    expect(localMigration).toContain(
      "Cette course locale est réservée aux équipes de son pays.",
    );
    expect(localMigration).toContain(
      "before insert on public.race_registrations",
    );
    expect(localMigration).toContain(
      "before insert on public.stage_reconnaissances",
    );
  });

  it("ajoute 12 classiques, 6 tours et huit prologues internationaux", () => {
    expect(expansionMigration).toContain(
      "Le renfort international S4 doit contenir 18 courses.",
    );
    expect(expansionMigration).toContain(
      "6 tours et 12 classiques",
    );
    expect(expansionMigration.match(/\"type\":\"prologue\"/g)).toHaveLength(
      3,
    );
    for (const slug of [
      "tour-du-sakura",
      "tour-du-saint-laurent",
      "tour-du-rift",
      "dragon-kingdom-tour",
      "route-de-l-atlas",
    ]) {
      expect(expansionMigration).toContain(`'${slug}'`);
    }
  });

  it("réduit à deux les anciennes finales en CLM par équipes", () => {
    expect(expansionMigration).toContain("'tour-de-mazovie'");
    expect(expansionMigration).toContain("'individual_time_trial'");
    expect(expansionMigration).toContain("'tour-des-highlands-de-donegal'");
    expect(expansionMigration).toContain("'mekong-delta-tour'");
    expect(expansionMigration).toContain(
      "seules deux finales TTT sont conservées",
    );
  });

  it("préfiltre les gros chargements des calendriers et des crons", () => {
    expect(localMigration).toContain(
      "get_current_team_visible_calendar_edition_ids",
    );
    expect(expansionMigration).toContain("get_due_race_job_edition_ids");
    expect(localMigration).toContain(
      "race_editions_season_status_category_idx",
    );
    expect(localMigration).toContain(
      "race_registrations_edition_status_idx",
    );
  });
});

function readMigration(filename: string) {
  return readFileSync(
    join(process.cwd(), "supabase/migrations", filename),
    "utf8",
  ).replaceAll("\r\n", "\n");
}
