import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const service = readFileSync(
  resolve(process.cwd(), "services/youth-development.ts"),
  "utf8",
);
const cronRoute = readFileSync(
  resolve(process.cwd(), "app/api/cron/scouting-reports/route.ts"),
  "utf8",
);
const vercelConfig = readFileSync(
  resolve(process.cwd(), "vercel.json"),
  "utf8",
);
const mailboxMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260809151000_notify_completed_scouting_reports.sql",
  ),
  "utf8",
);

describe("automatic scouting report settlement", () => {
  it("finalizes every due active mission without requiring a page visit", () => {
    expect(service).toContain(
      "export async function settleDueYouthScoutingMissions",
    );
    expect(service).toContain('admin.rpc("sync_active_season_day")');
    expect(service).toContain('.from("youth_scouting_missions")');
    expect(service).toContain('.eq("status", "active")');
    expect(service).toContain(
      "mission.completes_day_number <= currentDayNumber",
    );
    expect(service).toContain(
      "for (const mission of due) await completeMission(admin, mission);",
    );
  });

  it("runs from an authenticated cron outside exact key hours", () => {
    expect(cronRoute).toContain("isAuthorizedCronRequest(request)");
    expect(cronRoute).toContain("settleDueYouthScoutingMissions()");
    expect(vercelConfig).toContain(
      '{ "path": "/api/cron/scouting-reports", "schedule": "5,25,35,55 * * * *" }',
    );
  });

  it("keeps the mailbox trigger attached to automatic completion", () => {
    expect(mailboxMigration).toContain(
      "after insert or update of status, report_ready_at",
    );
    expect(mailboxMigration).toContain(
      "perform public.sync_director_scouting_report_message(new.id)",
    );
  });
});
