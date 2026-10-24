import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("icône du Centre de soin", () => {
  it("utilise une croix médicale à la place de la tente", () => {
    const dashboard = readFileSync(
      resolve(process.cwd(), "app/jeu/page.tsx"),
      "utf8",
    );

    expect(dashboard).toContain('href="/jeu/centre-de-soin"');
    expect(dashboard).toContain('icon="medical"');
    expect(dashboard).toContain(
      '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z" />',
    );
    expect(dashboard).not.toContain('icon="camp"');
  });
});
