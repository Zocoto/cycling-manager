import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905101500_schedule_daily_fan_club_shop_sales.sql",
  ),
  "utf8",
);
const initialReportMigration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260905102000_run_initial_fan_club_sales_report.sql",
  ),
  "utf8",
);
const cronRoute = readFileSync(
  join(process.cwd(), "app/api/cron/fan-club-sales/route.ts"),
  "utf8",
);
const managementService = readFileSync(
  join(process.cwd(), "services/fan-club-management.ts"),
  "utf8",
);
const vercelConfig = readFileSync(join(process.cwd(), "vercel.json"), "utf8");

describe("daily Fan Club shop settlement", () => {
  it("settles all active shops through an idempotent scheduled RPC", () => {
    expect(migration).toContain(
      "create or replace function public.settle_due_fan_club_shop_sales()",
    );
    expect(migration).toContain("perform public.sync_active_season_day()");
    expect(migration).toContain("v_first_due_day..v_target.current_day_number");
    expect(migration).toContain(
      "public.settle_team_fan_club_sales_for_day(",
    );
    expect(migration).toMatch(
      /grant execute on function public\.settle_due_fan_club_shop_sales\(\)[\s\S]*to service_role/,
    );
    expect(cronRoute).toContain('admin.rpc("settle_due_fan_club_shop_sales")');
    expect(vercelConfig).toContain('"/api/cron/fan-club-sales"');
  });

  it("does not settle sales while the manager opens the shop", () => {
    expect(managementService).not.toContain(
      '"settle_current_team_fan_club_sales"',
    );
    expect(migration).toMatch(
      /revoke execute on function public\.settle_current_team_fan_club_sales\(\)[\s\S]*from authenticated/,
    );
  });

  it("exposes stock and current-day CR data to the DS assistant", () => {
    expect(migration).toContain(
      "create or replace function public.get_current_fan_club_assistant_summary()",
    );
    expect(migration).toContain("sales_processed_today boolean");
    expect(migration).toContain("today_units_sold integer");
    expect(migration).toContain("today_revenue numeric");
  });

  it("runs one atomic catch-up CR when the feature is deployed", () => {
    expect(initialReportMigration).toContain(
      "from public.settle_due_fan_club_shop_sales()",
    );
    expect(initialReportMigration).toContain(
      "Initial Fan Club sales CR failed",
    );
    expect(initialReportMigration).toContain("raise notice");
  });
});
