import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  ALPHA_BOT_AUTOMATION_END_DAY,
  ALPHA_BOT_PROFILES,
  buildRaceRoster,
  buildAlphaBotCycleKey,
  isSharedMarketItemAssignedToBot,
} from "./alpha-bots";
import type { RaceCalendarEdition } from "./race-calendar";
import type { RaceRosterOption } from "@/services/race-calendar";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260911100000_activate_managed_teams_for_s3_first_half.sql",
  ),
  "utf8",
);

describe("managed teams first-half automation", () => {
  it("targets the five historical bots and Antoine Morel only through J14", () => {
    expect(ALPHA_BOT_PROFILES.map((profile) => profile.key)).toEqual([
      "elodie_martin",
      "thomas_vermeulen",
      "giulia_rinaldi",
      "mikkel_sorensen",
      "rafael_costa",
      "antoine_morel_29",
    ]);
    expect(ALPHA_BOT_AUTOMATION_END_DAY).toBe(14);
    expect(migration).toContain("automation_season_id");
    expect(migration).toContain("season.game_year = 3");
    expect(migration).toContain("coalesce(season.current_day_number, 1)");
    expect(migration).toContain(
      "between 1 and manager.automation_end_day_number",
    );
  });

  it("makes daily slots stable and assigns a shared market item to one account", () => {
    const cycleKey = buildAlphaBotCycleKey(
      new Date("2026-09-11T10:00:00.000Z"),
      "morning",
    );
    expect(cycleKey).toBe("2026-09-11:morning");

    const owners = ALPHA_BOT_PROFILES.filter((profile) =>
      isSharedMarketItemAssignedToBot({
        botKey: profile.key,
        cycleKey,
        channel: "transfer-listing",
        itemId: "listing-42",
      }),
    );
    expect(owners).toHaveLength(1);
  });

  it("restores service-only, idempotent cycle claims", () => {
    expect(migration).toContain("auth.role() <> 'service_role'");
    expect(migration).toContain("on conflict (manager_id, cycle_key) do nothing");
    expect(migration).toContain("cycle.attempt_count < 3");
    expect(migration).toContain(
      "grant execute on function public.claim_alpha_bot_cycle",
    );
  });

  it("never assigns a mountain-classification role on a one-day race", () => {
    const edition = {
      raceFormat: "one_day",
      competitionType: "standard",
      minimumRosterSize: 2,
      maximumRosterSize: 2,
      stages: [{ profileType: "mountain" }],
    } as RaceCalendarEdition;
    const riders = [
      {
        riderId: "rider-a",
        isAvailable: true,
        countryCode: "FR",
        mountain: 80,
        hills: 70,
        flat: 60,
        timeTrial: 60,
        cobbles: 55,
        sprint: 50,
      },
      {
        riderId: "rider-b",
        isAvailable: true,
        countryCode: "FR",
        mountain: 75,
        hills: 68,
        flat: 58,
        timeTrial: 55,
        cobbles: 52,
        sprint: 48,
      },
    ] as RaceRosterOption[];

    expect(
      buildRaceRoster(ALPHA_BOT_PROFILES[0], edition, riders).map(
        (rider) => rider.role,
      ),
    ).toEqual(["leader", "free_agent"]);
  });
});
