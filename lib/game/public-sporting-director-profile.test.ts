import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(
    process.cwd(),
    "app/jeu/directeurs-sportifs/[identifiantPublic]/page.tsx",
  ),
  "utf8",
);

describe("public sporting director profile", () => {
  it("shows the director name without the technical public handle", () => {
    expect(source).toContain("{profile.display_name}");
    expect(source).not.toContain("@{profile.public_identifier}");
  });
});
