import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const youthDevelopment = readFileSync(
  new URL("../../services/youth-development.ts", import.meta.url),
  "utf8",
);
const maintenance = readFileSync(
  new URL("../../services/game-state-settlement.ts", import.meta.url),
  "utf8",
);

describe("automatic youth training maintenance", () => {
  it("does not generate the current youth session before 08:00 Paris", () => {
    expect(youthDevelopment).toContain(
      "export async function settleDueYouthAutomaticTrainingSessions",
    );
    expect(youthDevelopment).toContain("if (getParisHour(now) < 8)");
  });

  it("only settles teams with a missing automatic session or a due mode change", () => {
    expect(youthDevelopment).toContain(
      '.eq("season_day_id", currentDayResult.data.id)',
    );
    expect(youthDevelopment).toContain("automaticSessionIsMissing");
    expect(youthDevelopment).toContain("pendingModeIsDue");
    expect(youthDevelopment).toContain("for (const teamId of dueTeamIds)");
  });

  it("runs juniors behind the monitored training cron and reports failures", () => {
    expect(maintenance).toContain(
      "settleDueYouthAutomaticTrainingSessions()",
    );
    expect(maintenance).toContain("youth_training: youthTraining");
    expect(maintenance).toContain('status: "failed"');
    expect(maintenance.indexOf("settleDueYouthAutomaticTrainingSessions()"))
      .toBeLessThan(maintenance.indexOf("const completed = await admin"));
  });
});
