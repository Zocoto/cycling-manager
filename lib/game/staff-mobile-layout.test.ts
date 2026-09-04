import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const staffPage = readFileSync(
  resolve(process.cwd(), "app/jeu/staff/page.tsx"),
  "utf8",
);

describe("staff mobile layout", () => {
  it("keeps the page and every staff-card grid inside the phone viewport", () => {
    expect(staffPage).toContain("min-h-screen overflow-x-hidden");
    expect(staffPage).toContain("w-full min-w-0 max-w-[1500px]");
    expect(staffPage.match(/grid min-w-0 gap-5/g)).toHaveLength(3);
    expect(staffPage).toContain("min-w-0 max-w-full overflow-hidden");
  });

  it("lets long effects and non-breaking currency values wrap", () => {
    expect(staffPage).toContain("sm:flex-row sm:items-end sm:justify-between");
    expect(staffPage).toContain("sm:text-right");
    expect(staffPage.match(/\[overflow-wrap:anywhere\]/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it("stacks price tiles on the narrowest screens", () => {
    expect(staffPage).toContain(
      "grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2",
    );
  });
});
