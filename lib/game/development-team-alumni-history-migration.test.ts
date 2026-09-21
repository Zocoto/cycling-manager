import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260921160000_persist_development_team_alumni_history.sql",
  ),
  "utf8",
).replace(/\r\n/g, "\n");

describe("mémoire durable des anciens coureurs de Development Team", () => {
  it("crée une affiliation indépendante du roster opérationnel", () => {
    expect(migration).toContain(
      "create table public.rider_development_team_history",
    );
    expect(migration).toContain(
      "unique (academy_rider_id, team_id, season_id)",
    );
    expect(migration).toContain("development_team_name text not null");
    expect(migration).toContain("rider_id uuid references public.riders");
  });

  it("capture chaque entrée et chaque sortie du roster", () => {
    expect(migration).toContain(
      "create trigger development_team_roster_history_insert",
    );
    expect(migration).toContain(
      "create trigger development_team_roster_history_delete",
    );
    expect(migration).toContain(
      "perform public.sync_rider_development_team_history(new.academy_rider_id)",
    );
    expect(migration).toContain("left_at = greatest(now(), history.joined_at)");
  });

  it("lie automatiquement l'historique au coureur lors de toute promotion", () => {
    expect(migration).toContain(
      "after update of promoted_rider_id on public.youth_academy_riders",
    );
    expect(migration).toContain("when (new.promoted_rider_id is not null)");
    expect(migration).toContain(
      "perform public.sync_rider_development_team_history(new.id)",
    );
  });

  it("rattrape les preuves historiques sans assimiler une sélection fédérale à une DevTeam", () => {
    expect(migration).toContain("from public.development_team_roster as roster");
    expect(migration).toContain(
      "from public.development_race_registration_riders as registration_rider",
    );
    expect(migration).toContain("from public.development_race_results as result");
    expect(migration).toContain("result.development_team_id is not null");
  });
});
