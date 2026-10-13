import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indicator = readFileSync("components/layout/site-presence.tsx", "utf8");
const gameHeader = readFileSync("components/game/game-header.tsx", "utf8");
const publicHeader = readFileSync("components/layout/public-header.tsx", "utf8");

describe("dedicated header presence slot", () => {
  it("uses a readable in-flow control, not an overlay on the brand", () => {
    expect(indicator).not.toContain("absolute ${placement}");
    expect(indicator).not.toContain("-bottom-");
    expect(indicator).toContain('compact ? "h-8" : "h-10"');
    expect(indicator).toContain("w-14 shrink-0");
    expect(indicator).toContain("text-[11px]");
    expect(indicator).toContain('svg viewBox="0 0 20 20"');
    for (const source of [gameHeader, publicHeader]) {
      expect(source).toContain('data-header-presence-slot="true"');
      expect(source).not.toContain('<div className="relative shrink-0">');
    }
  });

  it("reserves the mobile search space and keeps compact routes on one row", () => {
    expect(gameHeader).toContain("order-2 w-[calc(100%-4rem)] min-w-0 sm:w-full");
    expect(gameHeader).toContain('compactMobile ? "order-none" : "order-2"');
    expect(gameHeader.match(/<SitePresenceIndicator/g)).toHaveLength(1);
    const slot = gameHeader.indexOf('data-header-presence-slot="true"');
    expect(slot).toBeGreaterThan(gameHeader.indexOf("<GameNavigationMenu"));
    expect(slot).toBeLessThan(gameHeader.indexOf('data-global-header-search="true"'));
  });

  it("keeps public mobile account buttons and places presence beside navigation", () => {
    expect(publicHeader).toContain('className="hidden shrink-0 lg:block"');
    expect(publicHeader).toContain("<SitePresenceIndicator compact />");
    expect(publicHeader.indexOf("<SitePresenceIndicator compact />")).toBeGreaterThan(publicHeader.indexOf('"Navigation mobile"'));
    expect(publicHeader).toContain("<LanguageSwitcher compact />");
    expect(publicHeader).toContain('href="/inscription"');
  });

  it("retains detail access by hover, click, keyboard and Escape", () => {
    expect(indicator).toContain("pinned.current = true; open();");
    expect(indicator).toContain("onMouseEnter={open} onMouseLeave={closeSoon}");
    expect(indicator).toContain('event.key === "Escape"');
    expect(indicator).toContain("aria-expanded={Boolean(position)}");
  });
});
