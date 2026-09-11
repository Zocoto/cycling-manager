import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getFederationSelectionCallUpLeadDays } from "./federation-selection-weather";

const read = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, "utf8").replaceAll("\r", "");
const migration = read("20260911103000_stop_early_selection_notifications");
const cn = read("20260817120000_unify_national_championship_registrations")
  .split("create or replace function public.sync_national_championship_registrations(")[1]
  .split("$$;")[0];
const pro = read("20260910110000_wire_professional_nations_cup")
  .split("create or replace function public.prepare_due_automatic_federation_professional_lineups(")[1]
  .split("$$;")[0];

describe("selection notification timing", () => {
  it("removes only the CN invitation block, after all automatic entries have been prepared", () => {
    const start = cn.indexOf("  insert into public.national_championship_notifications (");
    const end = cn.indexOf("  return v_synced;");
    expect(start).toBeGreaterThan(cn.lastIndexOf("insert into public.race_rosters"));
    expect(end).toBeGreaterThan(start);
    expect(cn.slice(start, end).trimEnd()).toMatch(/message = excluded\.message;$/);
    expect(migration).toContain("btrim(v_notification_block, E' \\t\\n\\r')");
    expect(cn.slice(0, start)).toContain("candidate.national_rank <= 200");
    expect(cn.slice(0, start)).toContain("preference.is_selected = true");
    expect(cn.slice(0, start)).toContain("withdrawal.rider_id is null");
    expect(migration).not.toContain("save_current_team_national_championship_selections");
  });

  it("blocks mirroring old CN invitations but preserves result messages and existing history", () => {
    expect(migration).toContain("notification.notification_type <> ''selection''");
    expect(migration).not.toMatch(/delete from public\.(?:sporting_director_messages|national_championship_notifications)/i);
    expect(migration).not.toMatch(/update public\.race_(?:registrations|rosters)/i);
    expect(migration).not.toContain("process_due_national_championships(");
  });

  it("uses the existing international windows and excludes missing or departed races", () => {
    expect(getFederationSelectionCallUpLeadDays({ competitionCode: "world_championship", riderCategory: "professional" })).toBe(4);
    expect(getFederationSelectionCallUpLeadDays({ competitionCode: "continental_championship", riderCategory: "professional" })).toBe(1);
    expect(getFederationSelectionCallUpLeadDays({ competitionCode: "nations_cup", riderCategory: "professional" })).toBe(1);
    expect(migration).toContain("interval '96 hours'");
    expect(migration).toContain("interval '24 hours'");
    expect(migration).toContain("p_departure_at > p_now");
    expect(migration).toContain(") is not true then continue; end if;");
    expect(pro.split("      if v_edition_id is null then continue; end if;")).toHaveLength(2);
    expect(migration).toContain("and v_season.current_day_number + 4");
  });

  it("guards junior direct callers at J-3, before any list is published", () => {
    const junior = read("20260904130000_expand_federation_program")
      .split("create or replace function public.ensure_automatic_federation_junior_lineups(")[1].split("$$;")[0];
    expect(junior.indexOf("  if v_season.game_year < 3 then return 0; end if;")).toBeLessThan(junior.indexOf("insert into public.national_federation_selection_lists"));
    expect(migration).toContain("v_season.current_day_number < v_edition.start_day_number - 3");
    expect(migration).toContain("v_season.status <> ''active''");
    expect(migration).not.toContain("publish_national_federation_preselection(text,text)");
  });
});
