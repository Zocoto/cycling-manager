import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const teamProfilePage = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

describe("team profile mobile layout", () => {
  it("keeps recent result tiles inside the narrow viewport", () => {
    expect(teamProfilePage).toContain(
      "grid min-w-0 grid-cols-[minmax(0,1fr)]",
    );
    expect(teamProfilePage).toContain(
      "group flex min-w-0 max-w-full items-center",
    );
    expect(teamProfilePage).toContain(
      "shrink-0 font-black text-[var(--team-secondary)]",
    );
  });
});
