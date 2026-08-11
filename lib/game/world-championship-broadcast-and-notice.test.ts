import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const roadMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260723161000_create_international_championship_selections.sql",
  ),
  "utf8",
);

const timeTrialMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260810153000_add_world_time_trial_championship.sql",
  ),
  "utf8",
);

const noticeMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260811150000_announce_world_championship_selections_at_j4.sql",
  ),
  "utf8",
);

const racePage = readFileSync(
  join(process.cwd(), "app/jeu/resultats/[slug]/[stageNumber]/page.tsx"),
  "utf8",
);

const raceLive = readFileSync(
  join(process.cwd(), "lib/game/race-live.ts"),
  "utf8",
);

const resultsPage = readFileSync(
  join(process.cwd(), "app/jeu/resultats/page.tsx"),
  "utf8",
);

const liveDirectory = readFileSync(
  join(process.cwd(), "components/game/race-live-directory.tsx"),
  "utf8",
);

describe("diffusion et convocations des championnats du monde", () => {
  it("programme le CLM a 14 h et la course en ligne a 18 h", () => {
    expect(timeTrialMigration).toContain("interval '14 hours'");
    expect(timeTrialMigration).toContain("'individual_time_trial'");
    expect(timeTrialMigration).toContain("'early'");
    expect(roadMigration).toContain("interval '18 hours'");
    expect(roadMigration).toContain("'world_championship'");
    expect(roadMigration).toContain("'late'");
  });

  it("ouvre le Live selon l'heure de depart sans exiger un engagement", () => {
    expect(raceLive).toContain("if (stage.status === \"in_progress\" || now >= startsAt)");
    expect(racePage).toContain("<RaceStageExperience");
    expect(racePage).not.toContain("registration.rosterCount");
    expect(racePage).not.toContain("raceRegistration");
  });

  it("affiche les deux Mondiaux dans l'annuaire public des Lives", () => {
    expect(resultsPage).toContain(
      'edition.competitionType === "world_championship"',
    );
    expect(liveDirectory).toContain(
      'if (edition.competitionType === "world_championship")',
    );
  });

  it("conserve vingt nations et huit titulaires par epreuve", () => {
    expect(noticeMigration).toContain("where nation_rank <= 20");
    expect(noticeMigration).toContain(
      "perform public.sync_international_championship_lineup",
    );
    expect(roadMigration).toContain("eligible.eligible_rank <= 8");
    expect(timeTrialMigration).toContain("rating.time_trial * 0.62");
  });

  it("prepare les deux selections mondiales a J-4 et fige les huit annonces", () => {
    expect(noticeMigration).toContain("race.competition_type = 'world_championship'");
    expect(noticeMigration).toContain("interval '4 days'");
    expect(noticeMigration).toContain("candidate.selected_at is not null");
    expect(noticeMigration).toContain(
      "prepare_upcoming_world_championship_selections(p_now)",
    );
  });
});
