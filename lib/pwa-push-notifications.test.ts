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

  it("asks for permission only from the explicit header control", () => {
    const control = read("components/pwa/push-notification-control.tsx");
    const header = read("components/game/game-header.tsx");
    expect(control).toContain("Notification.requestPermission()");
    expect(control).toContain("Activer sur cet appareil");
    expect(control).toContain("entre 22 h et 8 h, heure de Paris");
    expect(header).toContain("<PushNotificationControl />");
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
