import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("key-hour load shedding", () => {
  it("opens a finished replay through an explicit route with immediate feedback", () => {
    const experience = read("components/game/race-stage-experience.tsx");

    expect(experience).toContain("href={replayHref}");
    expect(experience).toContain("prefetch={false}");
    expect(experience).toContain("Ouverture du replay…");
    expect(experience).toContain("!replayRequested");
  });

  it("keeps empty development maintenance on an indexed fast path", () => {
    const migration = read(
      "supabase/migrations/20260827200000_secure_key_hour_maintenance.sql",
    );

    expect(migration).toContain("development_race_editions_due_idx");
    expect(migration).toContain("pg_try_advisory_xact_lock");
    expect(migration).toContain("if not exists (");
    expect(migration).toContain("limit 2");
    expect(migration).toContain("if v_settled > 0 and v_game_year >= 3");
    expect(migration).not.toContain(
      "settle_due_development_races_pre_season_three",
    );
  });

  it("spreads 18:00 and 20:00 background work and defers Gazette pushes", () => {
    const vercel = read("vercel.json");
    const gazetteRoute = read("app/api/cron/cyclogazette/[slot]/route.ts");
    const pushRoute = read("app/api/cron/push-notifications/route.ts");
    const transferRoute = read("app/api/cron/transfer-market/route.ts");
    const transferService = read("services/transfer-market.ts");
    const pushService = read("services/push-notifications.ts");

    expect(vercel).not.toContain("race-settlements/late-summer-00");
    expect(vercel).not.toContain("race-settlements/late-winter-00");
    expect(vercel).toContain('"schedule": "1 18 * * *"');
    expect(vercel).toContain('"schedule": "1 19 * * *"');
    expect(vercel).toContain('"3,14,24,33,44,54 * * * *"');
    expect(vercel).not.toContain('"schedule": "*/5 * * * *"');
    expect(gazetteRoute).toContain('push: "deferred"');
    expect(gazetteRoute).not.toContain("dispatchDuePushNotifications");
    expect(pushRoute).toContain("limit: 20");
    expect(pushService).toContain("limit = 20");
    expect(transferRoute).not.toContain("dispatchDuePushNotifications");
    expect(transferService).toContain("if (generatedListings > 0)");
  });
});
