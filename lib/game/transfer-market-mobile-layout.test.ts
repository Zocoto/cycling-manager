import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const transferPage = readFileSync(
  resolve(process.cwd(), "app/jeu/transferts/page.tsx"),
  "utf8",
);

describe("transfer market mobile layout", () => {
  it("keeps free-agent cards inside the single mobile grid column", () => {
    expect(transferPage).toMatch(
      /data-tutorial-id="transfer-free-agent-listings"[\s\S]*?mt-5 grid min-w-0 grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3/,
    );
    expect(transferPage).toMatch(
      /function FreeAgentCard[\s\S]*?<article className="min-w-0 max-w-full overflow-hidden/,
    );
  });
});
