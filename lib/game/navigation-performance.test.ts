import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const appLinkSource = readFileSync(
  new URL("../../components/ui/app-link.tsx", import.meta.url),
  "utf8",
);
const objectivesPageSource = readFileSync(
  new URL("../../app/jeu/objectifs/page.tsx", import.meta.url),
  "utf8",
);
const staffPageSource = readFileSync(
  new URL("../../app/jeu/staff/page.tsx", import.meta.url),
  "utf8",
);

describe("game navigation performance", () => {
  it("does not prefetch every visible game link by default", () => {
    expect(appLinkSource).toContain("const resolvedPrefetch = prefetch ?? false");
  });

  it("waits for deliberate hover intent before loading a heavy preview", () => {
    expect(appLinkSource).toContain("const PREVIEW_INTENT_DELAY_MS = 220");
    expect(appLinkSource).toContain("schedulePreview()");
    expect(appLinkSource).toContain("clearPreviewIntentTimer()");
  });

  it("uses the optimized link on list-heavy game pages", () => {
    for (const source of [objectivesPageSource, staffPageSource]) {
      expect(source).toContain('import Link from "@/components/ui/app-link"');
      expect(source).not.toContain('import Link from "next/link"');
    }
  });
});
