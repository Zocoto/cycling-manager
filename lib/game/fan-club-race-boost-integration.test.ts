import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const raceCalendarService = readFileSync(
  resolve(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);
const raceSimulation = readFileSync(
  resolve(process.cwd(), "lib/game/race-simulation.ts"),
  "utf8",
);
const raceProfile = readFileSync(
  resolve(process.cwd(), "app/jeu/courses/[slug]/race-profile-content.tsx"),
  "utf8",
);
const fanClubGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260908193000_harden_race_settlement_enrichment_dependencies.sql",
  ),
  "utf8",
);

describe("intégration du bonus supporters dans la course", () => {
  it("charge les cars et la ferveur dans les entrées officielles", () => {
    expect(raceCalendarService).toContain("loadFanClubRaceBoostDirectory(");
    expect(raceCalendarService).toContain("fanClubSupport:");
    expect(raceCalendarService).toContain("mobilizedSupporters:");
    expect(raceCalendarService).toContain("ratingBoost:");
    expect(fanClubGrantMigration).toContain(
      "grant select on table public.fan_club_trip_allocations to service_role",
    );
  });

  it("découpe les grands effectifs avant les filtres PostgREST", () => {
    expect(raceCalendarService).toMatch(
      /values: riderIds,[\s\S]*?\.from\("riders"\)[\s\S]*?\.in\("id", chunk\)/,
    );
  });

  it("applique le bonus aux notes avant la simulation", () => {
    expect(raceSimulation).toContain("applyFanClubRaceRatingBoost(");
    expect(raceSimulation).toContain("rider.fanClubSupport?.ratingBoost ?? 0");
    expect(raceSimulation).toContain("profileType: input.profileType");
    expect(raceSimulation).toContain("stageType: input.stageType");
  });

  it("rend le détail et la projection 70 MO sur la fiche course", () => {
    expect(raceProfile).toContain("Mobilisation des supporters");
    expect(raceProfile).toContain("70 MO →");
    expect(raceProfile).toContain("Organiser un déplacement");
  });
});
