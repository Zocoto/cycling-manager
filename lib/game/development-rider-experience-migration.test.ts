import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260821203000_add_development_rider_experience.sql",
  "utf8",
);
const developmentService = readFileSync("services/development-team.ts", "utf8");
const resultsPanel = readFileSync(
  "components/game/development-team-panel.tsx",
  "utf8",
);
const teamPage = readFileSync("app/jeu/equipes/[identifiant]/page.tsx", "utf8");

describe("expérience et profils publics des coureurs de Devteam", () => {
  it("compte exactement les jours réellement courus et résiste aux resimulations", () => {
    expect(migration).toContain(
      "add column if not exists career_race_days integer not null default 0",
    );
    expect(migration).toContain("result.result_scope = 'stage'");
    expect(migration).toMatch(
      /after insert or update or delete\r?\non public\.development_race_results/,
    );
    expect(migration).toContain(
      "set career_race_days = greatest(0, career_race_days - 1)",
    );
    expect(migration).toContain("set career_race_days = career_race_days + 1");
  });

  it("transmet l'expérience junior au coureur lors du passage professionnel", () => {
    expect(migration).toContain("academy.promoted_rider_id = rider.id");
    expect(migration).toContain("sync_promoted_rider_from_youth_experience");
    expect(migration).toContain(
      "after update of promoted_rider_id, career_race_days",
    );
  });

  it("rend les juniors et la Devteam accessibles depuis les résultats et la fiche équipe", () => {
    expect(resultsPanel).toContain(
      "/jeu/centre-de-formation/development/${result.academyRiderId}",
    );
    expect(developmentService).toContain(
      "export async function getPublicDevelopmentTeam",
    );
    expect(teamPage).toContain(
      "<DevelopmentTeamCard developmentTeam={developmentTeam} />",
    );
    expect(teamPage).toContain(
      "/jeu/centre-de-formation/development/${rider.id}",
    );
  });
});
