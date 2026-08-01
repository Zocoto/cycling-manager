import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260801130000_create_player_activity_monitoring.sql",
  ),
  "utf8",
);
const layout = readFileSync(join(process.cwd(), "app/jeu/layout.tsx"), "utf8");
const monitoringPage = readFileSync(
  join(process.cwd(), "app/jeu/monitoring-activite/page.tsx"),
  "utf8",
);

describe("collecte globale de l’activité", () => {
  it("branche le tracker au layout de toutes les pages du jeu", () => {
    expect(layout).toContain("<PlayerActivityTracker />");
    expect(migration).toContain("record_current_player_activity");
  });

  it("ne stocke que des métadonnées minimisées avec une rétention courte", () => {
    expect(migration).toContain("event_type text not null");
    expect(migration).toContain("route_path text not null");
    expect(migration).toContain("action_label text");
    expect(migration).not.toContain("ip_address");
    expect(migration).not.toContain("form_values");
    expect(migration).not.toContain("message_content");
    expect(migration).toContain("now() - interval '7 days'");
  });

  it("interdit l’accès direct aux événements", () => {
    expect(migration).toContain(
      "alter table public.player_activity_events enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.player_activity_events",
    );
  });
});

describe("outil administrateur caché", () => {
  it("cumule un contrôle applicatif et un contrôle SQL sur l’e-mail exact", () => {
    expect(monitoringPage).toContain("canAccessPlayerActivityMonitoring");
    expect(monitoringPage).toContain("notFound()");
    expect(migration).toContain("paul.leblanc22@gmail.com");
    expect(migration).toContain("auth.jwt() ->> 'email'");
  });

  it("est explicitement exclu des moteurs de recherche", () => {
    expect(monitoringPage).toContain("robots: { index: false, follow: false }");
  });
});
