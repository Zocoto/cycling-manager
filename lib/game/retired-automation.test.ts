import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260802090000_retire_alpha_bots_and_player_activity.sql",
);

describe("retired alpha automations", () => {
  it("keeps the alpha accounts while disabling every bot registry entry", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("update public.alpha_bot_managers");
    expect(migration).toContain("enabled = false");
    expect(migration).not.toContain("delete from public.alpha_bot_managers");
    expect(migration).not.toContain("delete from auth.users");
    expect(migration).not.toContain("delete from public.sporting_directors");
    expect(migration).not.toContain("delete from public.teams");
    expect(migration).toContain("revoke execute on function public.claim_alpha_bot_cycle");
    expect(migration).toContain("revoke execute on function public.complete_alpha_bot_cycle");
  });

  it("removes the bot cron runtime and both schedules", () => {
    const vercelConfig = readFileSync(path.join(root, "vercel.json"), "utf8");

    expect(
      existsSync(path.join(root, "app", "api", "cron", "alpha-bots", "[slot]", "route.ts")),
    ).toBe(false);
    expect(vercelConfig).not.toContain("/api/cron/alpha-bots/");
  });

  it("removes player tracking from the application and revokes its RPCs", () => {
    const layout = readFileSync(path.join(root, "app", "jeu", "layout.tsx"), "utf8");
    const migration = readFileSync(migrationPath, "utf8");

    expect(existsSync(path.join(root, "app", "api", "player-activity", "route.ts"))).toBe(false);
    expect(
      existsSync(path.join(root, "app", "jeu", "monitoring-activite", "page.tsx")),
    ).toBe(false);
    expect(layout).not.toContain("PlayerActivityTracker");
    expect(migration).toContain("revoke execute on function public.record_current_player_activity");
    expect(migration).toContain("revoke execute on function public.get_player_activity_monitoring");
  });
});
