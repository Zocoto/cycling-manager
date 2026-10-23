import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261023150000_fix_federation_result_mail_recipients.sql",
  "utf8",
).replaceAll("\r", "");
const original = readFileSync(
  "supabase/migrations/20260808165000_create_sporting_director_mailbox.sql",
  "utf8",
).replaceAll("\r", "").split(
  "create or replace function public.publish_director_race_result_messages(",
)[1].split("create or replace function public.publish_director_race_result_messages_trigger()")[0];
const anchors = [...migration.matchAll(/\$old\$([\s\S]*?)\$old\$/gu)].map((match) => match[1]);
const replacements = [...migration.matchAll(/\$new\$([\s\S]*?)\$new\$/gu)].map((match) => match[1]);

function patchedPublisher() {
  return anchors.reduce((definition, anchor, index) => {
    expect(definition.split(anchor)).toHaveLength(2);
    return definition.replace(anchor, replacements[index]);
  }, original);
}

describe("federation result-mail migration", () => {
  it("patches only four unique publisher anchors with bounded deployment locks", () => {
    expect(anchors).toHaveLength(4);
    expect(replacements).toHaveLength(4);
    expect(migration).toContain("set local lock_timeout = '1s'");
    expect(migration).toContain("set local statement_timeout = '5s'");
    expect(migration).toContain("array_length(string_to_array(v_definition, v_old[i]), 1) <> 2");
    expect(migration).toContain("execute v_definition");
    expect(migration).not.toMatch(/(?:create|drop)\s+(?:table|index|trigger)|cron\.|grant\s|revoke\s/iu);
    expect(patchedPublisher()).toContain("result_recipients as (");
  });

  it("uses the selected rider's frozen ownership in the same edition and season", () => {
    const publisher = patchedPublisher();
    for (const guard of [
      "link.race_registration_id = registration.id",
      "link.race_edition_id = context.id",
      "selection.season_id = context.season_id",
      "member.professional_rider_id = roster.rider_id",
      "member.response_status = 'confirmed'",
      "owner_season.team_id = member.owner_team_id",
      "owner_season.season_id = context.season_id",
      "member.owner_director_id is not null",
      "'continental_championship', 'world_championship'",
    ]) expect(publisher).toContain(guard);
    expect(publisher).not.toContain("rider_contracts");
    expect(publisher).not.toContain("president_director_id");
    expect(publisher).toContain("group by recipient.team_season_id, recipient.recipient_director_id");
    expect(publisher).toContain("on director.id = team_result.recipient_director_id");
  });

  it("keeps club eligibility, source identity and read/archive timestamps unchanged", () => {
    const publisher = patchedPublisher();
    for (const invariant of [
      "edition.status = 'completed'",
      "'national_road'",
      "'national_time_trial'",
      "assignment.role = 'general_manager'",
      "assignment.status = 'active'",
      "director.status = 'active'",
      "context.category_code in ('elite', 'world')",
      "or team_result.best_rank <= 3",
      "'race-result:%s:%s'",
      "on conflict (sporting_director_id, source_reference)",
    ]) expect(publisher).toContain(invariant);
    const originalUpsert = original.split("  on conflict (sporting_director_id, source_reference)")[1];
    expect(publisher.split("  on conflict (sporting_director_id, source_reference)")[1]).toBe(originalUpsert);
    expect(publisher).not.toMatch(/(?:update|delete from) public\.(?:race_results|stage_results|team_finance_transactions)/iu);
  });

  it("keeps the existing completion trigger and does not start a backfill or polling job", () => {
    expect(migration).not.toMatch(/perform public\.|select public\.publish|pg_cron|schedule\(/iu);
    expect(migration).toContain("pg_get_functiondef('public.publish_director_race_result_messages(uuid)'::regprocedure)");
  });
});
