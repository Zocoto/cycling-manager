import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const raceCalendarService = readFileSync(
  join(process.cwd(), "services/race-calendar.ts"),
  "utf8",
);

describe("international national-team equipment boundary", () => {
  it("classifies World Championships, Continental Championships and Nations Cup as national selections", () => {
    const nationalSelectionBlock = raceCalendarService.slice(
      raceCalendarService.indexOf(
        "const nationalInternationalEditionIds = new Set(",
      ),
      raceCalendarService.indexOf(
        "const nationalJerseyDesignByCountryId",
      ),
    );

    expect(nationalSelectionBlock).toContain('"world_championship"');
    expect(nationalSelectionBlock).toContain('"continental_championship"');
    expect(nationalSelectionBlock).toContain('"nations_cup"');
  });

  it("does not forward club-owned permanent or stage equipment to national selections", () => {
    expect(raceCalendarService).toContain(
      "if (nationalInternationalEditionIds.has(row.race_edition_id)) continue;",
    );
    expect(raceCalendarService).toContain(
      "values: usesNationalWorldModel\n        ? []",
    );
  });

  it("keeps club equipment enabled for ordinary team races", () => {
    expect(raceCalendarService).toContain(
      ": Array.isArray(row.equipment_effects)\n          ? row.equipment_effects",
    );
    expect(raceCalendarService).toContain(
      "teamStaffEffects: raceStaffEffects.byTeamId.get(row.team_id)",
    );
  });
});
