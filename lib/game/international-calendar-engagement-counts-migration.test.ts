import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260925131500_expose_current_team_international_calendar_counts.sql",
  "utf8",
).replaceAll("\r", "");
const calendarService = readFileSync(
  "services/race-calendar.ts",
  "utf8",
).replaceAll("\r", "");

describe("compteurs d’engagements internationaux du calendrier", () => {
  it("compte uniquement les start-lists professionnelles actives du DS connecté", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_team_international_calendar_counts()",
    );
    expect(migration).toContain("director.auth_user_id = auth.uid()");
    expect(migration).toContain("assignment.role = 'general_manager'");
    expect(migration).toContain("assignment.status = 'active'");
    expect(migration).toContain("contract.status = 'active'");
    expect(migration).toContain(
      "roster.status in ('selected', 'confirmed')",
    );
    expect(migration).toContain("registration.status = 'accepted'");
    expect(migration).toContain("'world_championship'");
    expect(migration).toContain("'continental_championship'");
    expect(migration).toContain("'nations_cup'");
  });

  it("rattache aussi les juniors sélectionnés à leur équipe de formation", () => {
    expect(migration).toContain("public.youth_academy_riders as academy");
    expect(migration).toContain(
      "public.national_federation_junior_race_registration_riders",
    );
    expect(migration).toContain(
      "registration.status in ('registered', 'completed')",
    );
    expect(migration).toContain("'nations_cup_junior'");
  });

  it("charge les compteurs et conserve la Nations Cup juniors au calendrier", () => {
    expect(calendarService).toContain(
      'supabase.rpc("get_current_team_international_calendar_counts")',
    );
    expect(calendarService).toContain(
      'currentTeamInternationalRiderCount:',
    );
    expect(calendarService).toMatch(
      /\.in\("competition_type", \[[\s\S]*"nations_cup_junior",[\s\S]*\]\)/,
    );
  });
});
