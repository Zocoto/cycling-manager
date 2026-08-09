import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const staffPageSource = readFileSync(
  join(process.cwd(), "app/jeu/staff/page.tsx"),
  "utf8",
);
const staffServiceSource = readFileSync(
  join(process.cwd(), "services/team-staff.ts"),
  "utf8",
);
const filteredPathSource = readFileSync(
  join(process.cwd(), "lib/game/filtered-page-paths.ts"),
  "utf8",
);

describe("staff market availability", () => {
  it("only builds cards from listings that are still available", () => {
    expect(staffServiceSource).toContain(
      'const availableListings = listings.filter(',
    );
    expect(staffServiceSource).toContain(
      '(listing) => listing.status === "available"',
    );
    expect(staffServiceSource).toContain(
      "availableListings.flatMap((listing) =>",
    );
    expect(staffPageSource).not.toContain("Déjà recruté");
  });

  it("removes the private-name filter and its legacy URL parameter", () => {
    expect(staffPageSource).not.toContain('name="recherche"');
    expect(staffPageSource).not.toContain("query.recherche");
    expect(filteredPathSource).not.toContain('"recherche"');
  });
});
