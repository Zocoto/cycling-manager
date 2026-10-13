import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indicator = readFileSync("components/layout/site-presence.tsx", "utf8");
const gameHeader = readFileSync("components/game/game-header.tsx", "utf8");
const publicHeader = readFileSync("components/layout/public-header.tsx", "utf8");

describe("header presence placement", () => {
  it("moves only the absolute badge beside the wheel, without resizing the brand slot", () => {
    expect(indicator).toContain("absolute ${placement}");
    expect(indicator).toContain("left-10 -bottom-1.5 sm:left-15 sm:-bottom-2");
    expect(indicator).toContain("xl:-bottom-4 xl:h-4");
    expect(indicator).not.toContain("absolute -bottom-1 left-0");
    for (const source of [gameHeader, publicHeader]) {
      expect(source).toContain('<div className="relative shrink-0">');
    }
    expect(gameHeader).toContain("flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2");
    expect(gameHeader).toContain('className="order-1 ml-auto flex shrink-0 items-center gap-1.5 sm:contents"');
    expect(publicHeader).toContain("items-center justify-between gap-3 px-3 pb-4 pt-5");
  });

  it("uses the public wheel offset and keeps the existing detail interactions", () => {
    expect(publicHeader).toContain('<SitePresenceIndicator header="public" />');
    expect(indicator).toContain("left-13 -bottom-1.5 sm:left-15 sm:-bottom-4");
    expect(gameHeader).toContain("<SitePresenceIndicator />");
    expect(indicator).toContain("pinned.current = true; open();");
    expect(indicator).toContain("onMouseEnter={open} onMouseLeave={closeSoon}");
    expect(indicator).toContain('event.key === "Escape"');
    expect(indicator).toContain("aria-expanded={Boolean(position)}");
  });
});
