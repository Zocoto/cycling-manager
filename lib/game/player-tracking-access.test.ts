import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PLAYER_TRACKING_ADMIN_EMAIL,
  canAccessPlayerTracking,
} from "./player-tracking-access";

const pageSource = readSource("app/jeu/suivi-joueurs/page.tsx");
const serviceSource = readSource("services/player-tracking-admin.ts");
const activityMigration = readSource(
  "supabase/migrations/20260814030000_expose_player_daily_activity.sql",
);

describe("player tracking access", () => {
  it("autorise uniquement le compte demande", () => {
    expect(canAccessPlayerTracking(PLAYER_TRACKING_ADMIN_EMAIL)).toBe(true);
    expect(canAccessPlayerTracking("  PAUL.LEBLANC22@GMAIL.COM ")).toBe(true);
    expect(canAccessPlayerTracking("membre@example.com")).toBe(false);
    expect(canAccessPlayerTracking(null)).toBe(false);
    expect(canAccessPlayerTracking(undefined)).toBe(false);
  });

  it("protege aussi la route et le service cote serveur", () => {
    expect(pageSource).toContain(
      "if (!canAccessPlayerTracking(user.email)) notFound()",
    );
    expect(serviceSource).toContain(
      "if (!canAccessPlayerTracking(requesterEmail))",
    );
    expect(serviceSource.indexOf("canAccessPlayerTracking(requesterEmail)")).toBeLessThan(
      serviceSource.indexOf("createSupabaseAdminClient()"),
    );
  });

  it("ne charge que les informations demandees pour le suivi", () => {
    expect(serviceSource).toContain("admin.auth.admin.listUsers");
    expect(serviceSource).not.toContain("last_sign_in_at");
    expect(serviceSource).toContain(
      '.rpc("get_player_tracking_last_activity")',
    );
    expect(serviceSource).toContain(
      '.select("id, auth_user_id, username, display_name")',
    );
    expect(serviceSource).toContain('.select("team_id, display_name")');
    expect(pageSource).toContain("Dernière activité");
    expect(pageSource).toContain(
      '"record_current_sporting_director_attendance"',
    );
    expect(pageSource).toContain('timeZone: "Europe/Paris"');
    expect(pageSource).not.toContain("hour:");
    expect(pageSource).not.toContain("minute:");
  });

  it("enregistre une seule activite civile par compte et par jour", () => {
    expect(activityMigration).toContain("create table public.player_daily_activity");
    expect(activityMigration).toContain(
      "primary key (auth_user_id, activity_on)",
    );
    expect(activityMigration).toContain(
      "on conflict (auth_user_id, activity_on) do nothing",
    );
    expect(activityMigration).toContain("activity_on date not null");
    expect(activityMigration).toContain(
      "(now() at time zone 'Europe/Paris')::date",
    );
  });
});

function readSource(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}
