import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const rosterPage = readFileSync(
  new URL("../../app/jeu/effectif/page.tsx", import.meta.url),
  "utf8",
);

describe("roster rider avatars", () => {
  it("uses the detailed rider portrait on mobile and desktop", () => {
    expect(rosterPage.match(/<RiderAvatar/g)).toHaveLength(2);
    expect(rosterPage).not.toContain('renderMode="compact"');
  });
});
