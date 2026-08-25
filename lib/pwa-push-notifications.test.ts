import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("installed app push notifications", () => {
  it("uses a push-only service worker and keeps the application online-first", () => {
    const worker = read("public/sw.js");
    expect(worker).toContain('addEventListener("push"');
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).toContain("showNotification");
    expect(worker).not.toContain('addEventListener("fetch"');
  });

  it("enables notifications by default while preserving the device opt-out", () => {
    const control = read("components/pwa/push-notification-control.tsx");
    const header = read("components/game/game-header.tsx");
    expect(control).toContain("Notification.requestPermission()");
    expect(control).toContain("PUSH_PREFERENCE_KEY");
    expect(control).toContain('!== "disabled"');
    expect(control).toContain('writePushPreference(false)');
    expect(control).toContain('"pointerdown"');
    expect(control).toContain('"keydown"');
    expect(control).toContain("ensurePushSubscription(registration)");
    expect(control).toContain("Activer sur cet appareil");
    expect(control).toContain("entre 22 h et 8 h, heure de Paris");
    expect(header).toContain("<PushNotificationControl />");
  });

  it("opens the contextual page carried by each notification", () => {
    const worker = read("public/sw.js");
    const distributor = read("services/push-notifications.ts");
    const migration = read(
      "supabase/migrations/20260814100000_create_web_push_notifications.sql",
    );
    const livePage = read("app/jeu/resultats/[slug]/[stageNumber]/page.tsx");

    expect(worker).toContain("event.notification.data?.url");
    expect(worker).toContain("client.navigate(targetUrl.href)");
    expect(worker).toContain("self.clients.openWindow(targetUrl.href)");
    expect(distributor).toContain("url: notification.notification_action_href");
    expect(migration).toContain(
      "'/jeu/resultats/' || race.slug || '/' || stage.stage_number::text",
    );
    expect(livePage).toContain("<RaceStageExperience");
  });

  it("runs the secured distributor every five minutes", () => {
    const cronRoute = read("app/api/cron/push-notifications/route.ts");
    const vercel = read("vercel.json");
    expect(cronRoute).toContain("isAuthorizedCronRequest");
    expect(cronRoute).toContain("dispatchDuePushNotifications");
    expect(vercel).toContain('"/api/cron/push-notifications"');
    expect(vercel).toContain('"*/5 * * * *"');
  });
});
