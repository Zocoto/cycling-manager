import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260916110000_require_race_entry_for_reconnaissance.sql"),
  "utf8",
);
const service = readFileSync(
  join(process.cwd(), "services/team-race-reconnaissance.ts"),
  "utf8",
);
const planner = readFileSync(
  join(process.cwd(), "components/game/race-reconnaissance-planner.tsx"),
  "utf8",
);

describe("inscription obligatoire avant une reconnaissance", () => {
  it("vérifie chaque coureur sur une inscription acceptée côté serveur", () => {
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("roster.status in ('selected', 'confirmed')");
    expect(migration).toContain("registration.team_season_id = p_team_season_id");
    expect(migration).toContain("registration.race_edition_id = p_edition_id");
    expect(migration).toContain("v_registered_count <> cardinality(p_rider_ids)");
  });

  it("protège les deux signatures de réservation existantes", () => {
    expect(migration).toContain(
      "book_current_team_stage_reconnaissance(uuid,uuid[],uuid)",
    );
    expect(migration).toContain(
      "book_current_team_stage_reconnaissance(uuid,uuid[],integer,uuid)",
    );
    expect(migration).toContain("pg_get_functiondef(v_signature)");
    expect(migration).toContain("v_count <> 1");
  });

  it("affiche les engagements des coureurs et filtre les courses communes", () => {
    expect(service).toContain("getAcceptedRaceEntriesByRider({");
    expect(service).toContain("registeredRaces: registeredRacesByRiderId.get(rider.id) ?? []");
    expect(service).toContain('!registeredEditionIds.has(edition.id)');
    expect(planner).toContain("rider.registeredRaces.map((entry)");
    expect(planner).toContain("isRaceEditionRegisteredForEveryRider(");
  });
});
