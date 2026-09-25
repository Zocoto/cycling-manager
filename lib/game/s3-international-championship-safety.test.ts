import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const cancellation = read(
  "supabase/migrations/20260925150000_cancel_s3_continental_championships.sql",
);
const worlds = read(
  "supabase/migrations/20260925151000_secure_s3_world_championship_pipeline.sql",
);

describe("S3 international championship safety", () => {
  it("cancels every professional and junior continental event and result", () => {
    expect(cancellation).toContain("v_professional_editions <> 10");
    expect(cancellation).toContain("v_junior_editions <> 10");
    expect(cancellation).toContain("update public.race_editions");
    expect(cancellation).toContain("update public.development_race_editions");
    expect(cancellation).toContain("delete from public.stage_results");
    expect(cancellation).toContain("delete from public.race_results");
    expect(cancellation).toContain("delete from public.official_stage_simulations");
  });

  it("removes S3 jerseys and restores all ten S2 continental holders", () => {
    expect(cancellation).toContain("v_s2_titles <> 10");
    expect(cancellation).toContain(
      "delete from public.rider_national_championship_titles",
    );
    expect(cancellation).toContain("with s2_holders as");
    expect(cancellation).toContain("set relinquished_at = null");
  });

  it("restores the World Championships response deadline to H-24", () => {
    expect(worlds).toContain(
      "slot.competition_code = ''continental_championship''",
    );
    expect(worlds).toContain("then interval ''1 hour''");
    expect(worlds).toContain("CM et saisons futures closent a H-24");
  });

  it("keeps past international races out of federation preparation", () => {
    expect(worlds).toContain(
      "edition.status not in (''completed'', ''cancelled'')",
    );
    expect(worlds).toContain("stage.status = ''planned''");
    expect(worlds).toContain("stage.departure_at > now()");
  });

  it("preflights automatic calls, DS responses and synchronized startlists", () => {
    expect(worlds).toContain(
      "private.get_active_world_championship_readiness",
    );
    expect(worlds).toContain("missingAutomaticLists");
    expect(worlds).toContain("pendingCallupsWithoutMessage");
    expect(worlds).toContain("pendingOrDeclinedCallupsOnStartlist");
    expect(worlds).toContain("confirmedCallupsMissingFromStartlist");
    expect(worlds).toContain("duplicateRidersWithinAnEvent");
    expect(worlds).toContain(
      "sync_due_national_federation_championship_lineups(now(), true)",
    );
  });

  it("removes the duplicate-team failure from junior rankings", () => {
    expect(worlds).toContain("max(grouped.display_name)");
    expect(worlds).toContain(
      "group by grouped.entity_key, grouped.development_team_id;",
    );
    expect(worlds).toContain("refresh_development_rankings(v_season_id)");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
