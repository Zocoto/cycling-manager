import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261008210000_add_award_comments.sql",
  "utf8",
);
const gazetteService = readFileSync("services/cyclogazette.ts", "utf8");

describe("Gazette du J1 de la saison 4", () => {
  it("réserve les commentaires d’awards aux vrais lauréats", () => {
    expect(migration).toContain("season_award_comments");
    expect(migration).toContain("upsert_current_season_award_comment");
    expect(migration).toContain("award.sporting_director_id = v_director_id");
    expect(migration).toContain("assignment.team_id = award.team_id");
    expect(migration).toContain("award_season.game_year >= start_season.game_year");
    expect(migration).toContain("char_length(v_message) > 500");
  });

  it("ne fabrique plus aucune interview éditoriale", () => {
    expect(gazetteService).toContain("const reactions = submittedReactions;");
    expect(gazetteService).toContain(".filter((reaction) => !reaction.isEditorial)");
    expect(gazetteService).not.toContain("completeEditorialReactions");
    expect(gazetteService).not.toContain("M. Delorme");
    expect(gazetteService).not.toContain("Claire Martin");
    expect(gazetteService).not.toContain("editorial:${index}");
  });
});
