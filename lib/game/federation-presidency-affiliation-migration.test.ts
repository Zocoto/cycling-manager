import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261009170000_initialize_federation_presidents_on_affiliation.sql"), "utf8");
const membershipChangeMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261009173000_restart_vacant_federation_vote_after_membership_change.sql"), "utf8");

describe("présidence à l’arrivée dans une fédération", () => {
  it("reopens failed elections for real membership changes, but not for periodic catch-up", () => {
    expect(membershipChangeMigration).toContain("if not p_membership_changed and exists (");
    expect(membershipChangeMigration).toContain("private.ensure_federation_presidency(p_country_id, p_season_id, false)");
    expect(membershipChangeMigration).toContain("private.ensure_federation_presidency(new.registration_country_id, new.season_id, true)");
    expect(membershipChangeMigration).toContain("from public, anon, authenticated");
  });
  it("works throughout current and future seasons instead of S3 J1 only", () => {
    expect(migration).not.toContain("game_year <> 3");
    expect(migration).not.toContain("current_day_number, 1) <> 1");
    expect(migration).toContain("v_season.game_year - case when mod(v_season.game_year, 2) = 0 then 1 else 0 end");
    expect(migration).toContain("status = 'active'");
  });
  it("preserves incumbents and current ballots, counts real DSs, and opens an election at multiple members", () => {
    expect(migration).toContain("v_term.president_director_id is not null then return 'unchanged'");
    expect(migration).toContain("status in ('applications', 'voting')");
    expect(migration).toContain("count(distinct assignment.sporting_director_id)");
    expect(migration).toContain("director.auth_user_id is not null");
    expect(migration).toContain("if v_player_count > 1 then");
    expect(migration).toContain("public.open_exceptional_federation_election(p_country_id, v_term.id, v_season.id)");
  });
  it("waits for final affiliation state and never reacts to points/budget updates", () => {
    expect(migration.match(/deferrable initially deferred/g)).toHaveLength(4);
    expect(migration).toContain("old.registration_country_id is distinct from new.registration_country_id");
    expect(migration).toContain("old.sporting_director_id is distinct from new.sporting_director_id");
    expect(migration).not.toContain("old.points");
    expect(migration).not.toContain("old.operating_budget");
  });
  it("keeps maintenance serialized, privileged and idempotent without rewriting ballots", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("for update");
    expect(migration).toContain("set local lock_timeout = '3s'");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("on conflict (sporting_director_id, source_reference) do nothing");
    expect(migration).not.toContain("update public.national_federation_elections");
    expect(migration).not.toContain("insert into public.national_federation_votes");
  });
  it("isolates the owner's Rwanda exception from the general membership rule", () => {
    expect(migration).toContain("v_director_id constant uuid := '8406962e-41b9-4181-a372-3d57043de3a8'");
    expect(migration).toContain("start_game_year = 3 and end_game_year = 4 for update");
    expect(migration).toContain("'appointmentType', 'administrative'");
    expect(migration).toContain("les prochaines présidences vacantes seront soumises à une élection");
  });
});
