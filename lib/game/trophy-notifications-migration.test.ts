import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = readSource(
  "supabase/migrations/20260827100000_notify_new_trophies.sql",
);
const dashboardService = readSource("services/dashboard-fast-summary.ts");
const dashboardPage = readSource("app/jeu/page.tsx");
const objectivesPage = readSource("app/jeu/objectifs/page.tsx");
const seenMarker = readSource(
  "components/game/trophy-notifications-seen-marker.tsx",
);

describe("new trophy notifications", () => {
  it("records idempotent unread events behind a partial index", () => {
    expect(migration).toContain(
      "create table public.sporting_director_trophy_notifications",
    );
    expect(migration).toContain(
      "unique (sporting_director_id, source_reference)",
    );
    expect(migration).toContain(
      "sporting_director_trophy_notifications_unread_idx",
    );
    expect(migration).toContain("where seen_at is null");
  });

  it("sends one dedicated in-game mail for each new trophy", () => {
    expect(migration).toContain("private.create_trophy_notification");
    expect(migration).toContain(
      "insert into public.sporting_director_messages",
    );
    expect(migration).toContain("'trophy',");
    expect(migration).toContain("'Comité des distinctions'");
    expect(migration).toContain("'/jeu/objectifs?onglet=trophees'");
    expect(migration).toContain(
      "on conflict (sporting_director_id, source_reference) do nothing",
    );
  });

  it("covers every trophy family displayed by the gallery", () => {
    for (const trigger of [
      "notify_sporting_director_trophy_after_award",
      "notify_attendance_trophy_after_award",
      "notify_sponsor_trophy_after_award",
      "notify_referral_trophy_after_qualification",
      "notify_major_race_after_result",
      "notify_major_race_after_completion",
      "notify_team_uci_after_write",
      "notify_rider_uci_after_write",
      "notify_uci_trophies_after_season_completion",
    ]) {
      expect(migration).toContain(trigger);
    }

    for (const trophyKind of [
      "grand_tour",
      "monument",
      "world_championship",
      "continental_championship",
      "uci_team",
      "uci_rider",
      "special",
      "achievement",
      "medical",
      "sponsor",
      "attendance",
      "referral",
    ]) {
      expect(migration).toContain(`'${trophyKind}'`);
    }
  });

  it("adds the unread count to the existing compact dashboard request", () => {
    expect(migration).toContain(
      "public.get_current_dashboard_fast_summary_v2()",
    );
    expect(migration).toContain("unread_trophy_count integer");
    expect(dashboardService).toContain(
      '.rpc("get_current_dashboard_fast_summary_v2")',
    );
    expect(dashboardService).toContain("unreadTrophyCount");
  });

  it("keeps reward and trophy counters distinct and clears only on a real gallery visit", () => {
    expect(dashboardPage).toContain("hasRewards || hasNewTrophies");
    expect(dashboardPage).toContain("bg-[#C72F5E]");
    expect(dashboardPage).toContain("bg-[#2F6EC7]");
    expect(objectivesPage).toContain('selectedTab === "trophees"');
    expect(objectivesPage).toContain("<TrophyNotificationsSeenMarker />");
    expect(seenMarker).toContain("useEffect");
    expect(seenMarker).toContain("markTrophyNotificationsSeenAction");
    expect(migration).toContain("mark_current_trophy_notifications_seen");
  });
});
