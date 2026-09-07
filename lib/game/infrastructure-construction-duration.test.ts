import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  INTERNATIONAL_CENTER_LEVELS,
  TEAM_INFRASTRUCTURE_DEFINITIONS,
  type TeamInfrastructureCode,
} from "@/lib/game/infrastructure";
import { STAFF_ACADEMY_LEVELS } from "@/lib/game/staff-academy";
import { FEDERATION_INFRASTRUCTURE_DEFINITIONS } from "@/lib/game/federation-infrastructures";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260907130000_rebalance_infrastructure_construction_durations.sql",
  ),
  "utf8",
);

const expectedTeamDurations = {
  recruitment_data_room: [7, 14, 21],
  staff_academy: [10, 16, 22, 28, 35],
  training_center: [5, 9, 14, 20, 28],
  indoor_track: [7, 11, 16, 22, 28],
  cryotherapy_center: [6, 10, 15, 21, 28],
  wind_tunnel: [9, 14, 20, 27, 35],
  research_lab: [10, 15, 20, 25, 30, 33, 35],
  international_welcome_center: [10, 16, 22, 28, 35],
  weather_center: [6, 10, 15, 21, 28],
  media_center: [9, 14, 20, 27, 35],
  fan_club_headquarters: [6, 10, 15, 21, 28],
  club_shop: [5, 9, 14, 20, 26],
} as const satisfies Record<TeamInfrastructureCode, readonly number[]>;

const expectedFederationDurations = {
  national_detection_network: [7, 10, 14, 18, 23],
  regional_academies: [8, 12, 16, 21, 27],
  national_performance_center: [9, 14, 19, 24, 30],
  federal_staff_institute: [7, 11, 15, 20, 26],
  federal_medical_network: [7, 10, 14, 18, 23],
  national_technical_laboratory: [9, 14, 19, 25, 32],
  race_organization_office: [7, 10, 14, 18, 23],
  federal_integration_office: [9, 14, 19, 24, 30],
  home_advantage_program: [6, 9, 13, 18, 23],
} as const;

describe("infrastructure construction duration balance", () => {
  it("keeps every team building on the intended 5-to-35-day curve", () => {
    for (const [code, expected] of Object.entries(expectedTeamDurations)) {
      const durations = TEAM_INFRASTRUCTURE_DEFINITIONS[
        code as TeamInfrastructureCode
      ].levels.map((level) => level.durationDays);

      expect(durations).toEqual(expected);
      expect(durations.every((duration, index) => index === 0 || duration > durations[index - 1]!)).toBe(true);
      expect(Math.max(...durations)).toBeLessThanOrEqual(35);
    }

    expect(STAFF_ACADEMY_LEVELS.map((level) => level.durationDays)).toEqual(
      expectedTeamDurations.staff_academy,
    );
    expect(INTERNATIONAL_CENTER_LEVELS.map((level) => level.durationDays)).toEqual([
      10, 16, 22, 28, 35,
    ]);
  });

  it("keeps national projects on the intended 6-to-32-day curve", () => {
    for (const definition of FEDERATION_INFRASTRUCTURE_DEFINITIONS) {
      const durations = definition.levels.map((level) => level.durationDays);
      expect(durations).toEqual(
        expectedFederationDurations[
          definition.code as keyof typeof expectedFederationDurations
        ],
      );
      expect(durations.every((duration, index) => index === 0 || duration > durations[index - 1]!)).toBe(true);
      expect(Math.max(...durations)).toBeLessThanOrEqual(32);
    }
  });

  it("uses the same server catalog and shortens active projects safely", () => {
    for (const marker of [
      "get_team_infrastructure_base_duration_days",
      "get_federation_infrastructure_base_duration_days",
      "international_youth_center",
      "project.base_duration_days - project.final_duration_days",
      "where project.status = 'active'",
      "completes_game_day_index",
      "least(",
    ]) {
      expect(migration).toContain(marker);
    }
  });
});
